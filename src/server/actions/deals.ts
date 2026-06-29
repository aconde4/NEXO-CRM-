"use server";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import {
  dealFormSchema,
  lostReasonSchema,
  type DealFormValues,
} from "@/lib/validations/deal";
import { db } from "@/server/db";
import {
  activityLog,
  deals,
  enrollments,
  entityLabels,
  labels,
  sequenceSteps,
  sequences,
  stages,
} from "@/server/db/schema";
import {
  type ContactFilterCondition,
  normalizeContactFilters,
} from "@/lib/contact-filters";
import {
  createFieldChangedEvents,
  diffAutomationFields,
  emitAutomationEventsSafely,
} from "@/server/services/automation-runner";
import { backfillContactsIntoFunnel } from "@/server/services/contact-funnel";
import { recordStageChangeSafely } from "@/server/services/deal-stage-events";
import { listPersonIdsByFilters } from "@/server/queries/contacts";
import { listCustomFieldDefs } from "@/server/queries/custom-fields";
import { inngest } from "@/server/inngest/client";
import { SEQUENCE_RUN_EVENT } from "@/server/services/sequence-runner";

const dealIdsSchema = z.array(z.string().uuid()).min(1).max(500);

/** Filas de deal del propietario (no borradas) para una selección. */
async function ownedDealRows(ownerId: string, dealIds: string[]) {
  return db
    .select({ id: deals.id, orgId: deals.orgId, personId: deals.personId })
    .from(deals)
    .where(
      and(
        eq(deals.ownerId, ownerId),
        inArray(deals.id, dealIds),
        isNull(deals.deletedAt),
      ),
    );
}

// --- Acciones masivas del embudo (6.4g) -------------------------------------
export async function bulkMoveDeals(dealIds: string[], stageId: string) {
  const user = await requireUser();
  const ids = dealIdsSchema.parse(dealIds);
  const [stage] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.ownerId, user.id)))
    .limit(1);
  if (!stage) throw new Error("Etapa no encontrada");

  // Etapas previas (para registrar el cambio en el historial, 6.4i).
  const before = await db
    .select({
      id: deals.id,
      stageId: deals.stageId,
      pipelineId: deals.pipelineId,
    })
    .from(deals)
    .where(
      and(
        eq(deals.ownerId, user.id),
        inArray(deals.id, ids),
        isNull(deals.deletedAt),
      ),
    );

  const updated = await db
    .update(deals)
    .set({ stageId, stageChangedAt: new Date() })
    .where(
      and(
        eq(deals.ownerId, user.id),
        inArray(deals.id, ids),
        isNull(deals.deletedAt),
      ),
    )
    .returning({ id: deals.id });

  for (const row of before) {
    if (row.stageId === stageId) continue;
    await recordStageChangeSafely({
      dealId: row.id,
      fromStageId: row.stageId,
      ownerId: user.id,
      pipelineId: row.pipelineId,
      toStageId: stageId,
    });
  }
  revalidatePath("/deals");
  return { updated: updated.length };
}

export async function bulkRemoveDealsFromFunnel(dealIds: string[]) {
  const user = await requireUser();
  const ids = dealIdsSchema.parse(dealIds);
  const removed = await db
    .update(deals)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(deals.ownerId, user.id),
        inArray(deals.id, ids),
        isNull(deals.deletedAt),
      ),
    )
    .returning({ id: deals.id });
  revalidatePath("/deals");
  return { removed: removed.length };
}

export async function bulkAddLabelToDeals(dealIds: string[], labelId: string) {
  const user = await requireUser();
  const ids = dealIdsSchema.parse(dealIds);
  const [label] = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.ownerId, user.id)))
    .limit(1);
  if (!label) throw new Error("Etiqueta no encontrada");

  const rows = await ownedDealRows(user.id, ids);
  const personIds = [
    ...new Set(rows.map((r) => r.personId).filter((x): x is string => !!x)),
  ];
  let added = 0;
  for (const personId of personIds) {
    const [existing] = await db
      .select({ id: entityLabels.id })
      .from(entityLabels)
      .where(
        and(
          eq(entityLabels.labelId, labelId),
          eq(entityLabels.entityType, "person"),
          eq(entityLabels.entityId, personId),
        ),
      )
      .limit(1);
    if (existing) continue;
    await db
      .insert(entityLabels)
      .values({ entityId: personId, entityType: "person", labelId });
    added += 1;
  }
  revalidatePath("/deals");
  revalidatePath("/contacts");
  return { added };
}

export async function bulkEnrollDeals(dealIds: string[], sequenceId: string) {
  const user = await requireUser();
  const ids = dealIdsSchema.parse(dealIds);
  const [seq] = await db
    .select({ status: sequences.status })
    .from(sequences)
    .where(and(eq(sequences.id, sequenceId), eq(sequences.ownerId, user.id)))
    .limit(1);
  if (!seq) throw new Error("Secuencia no encontrada");
  if (seq.status !== "active") throw new Error("La secuencia no está activa");
  const stepCount = await db.$count(
    sequenceSteps,
    and(
      eq(sequenceSteps.sequenceId, sequenceId),
      eq(sequenceSteps.ownerId, user.id),
    ),
  );
  if (stepCount === 0) throw new Error("La secuencia no tiene pasos");

  const rows = await ownedDealRows(user.id, ids);
  const now = new Date();
  let enrolled = 0;
  for (const row of rows) {
    if (!row.personId) continue;
    const [ins] = await db
      .insert(enrollments)
      .values({
        context: { enrolledBy: "bulk" },
        currentStepPosition: 0,
        enrolledAt: now,
        nextRunAt: now,
        orgId: row.orgId,
        ownerId: user.id,
        personId: row.personId,
        sequenceId,
        status: "active",
      })
      .onConflictDoNothing({
        target: [enrollments.sequenceId, enrollments.personId],
      })
      .returning({ id: enrollments.id });
    if (ins) {
      enrolled += 1;
      await inngest.send({
        data: { enrollmentId: ins.id, sequenceId },
        name: SEQUENCE_RUN_EVENT,
      });
    }
  }
  revalidatePath("/deals");
  revalidatePath("/sequences");
  return { enrolled };
}

type AutomationRecord = Record<string, unknown>;

/**
 * Embudo de contactos (6.4c/6.4e): mete en "Cargadas" los contactos sin tarjeta. Si se
 * pasan condiciones de filtro (las activas en el tablero), solo carga los que cumplen.
 */
export async function loadContactsIntoFunnel(
  conditions?: ContactFilterCondition[],
) {
  const user = await requireUser();
  const defs = await listCustomFieldDefs("person");
  const normalized = normalizeContactFilters(conditions ?? [], defs);
  const personIds =
    normalized.length > 0
      ? await listPersonIdsByFilters({ conditions: normalized })
      : undefined;
  const created = await backfillContactsIntoFunnel(user.id, personIds);
  revalidatePath("/deals");
  return { created, filtered: normalized.length > 0 };
}

const DEAL_AUTOMATION_FIELDS = [
  "title",
  "value",
  "currency",
  "pipelineId",
  "stageId",
  "personId",
  "orgId",
  "status",
  "position",
  "expectedCloseDate",
  "wonAt",
  "lostAt",
  "lostReason",
  "customFields",
];

async function logEvent(
  actorId: string,
  verb: string,
  entityId: string,
  payload?: Record<string, unknown>,
) {
  await db
    .insert(activityLog)
    .values({ actorId, verb, entityType: "deal", entityId, payload });
}

function nullify(value: string | undefined | null): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function parseValue(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value.replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function revalidate(id?: string) {
  revalidatePath("/deals");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/deals/${id}`);
}

function dateSnapshot(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function dealSnapshot(row: {
  currency: string;
  customFields: Record<string, unknown>;
  expectedCloseDate: Date | null;
  orgId: string | null;
  personId: string | null;
  pipelineId: string;
  position: number;
  stageId: string;
  status: string;
  title: string;
  value: number;
  wonAt?: Date | null;
  lostAt?: Date | null;
  lostReason?: string | null;
}): AutomationRecord {
  return {
    currency: row.currency,
    customFields: row.customFields,
    expectedCloseDate: dateSnapshot(row.expectedCloseDate),
    lostAt: dateSnapshot(row.lostAt),
    lostReason: row.lostReason ?? null,
    orgId: row.orgId,
    personId: row.personId,
    pipelineId: row.pipelineId,
    position: row.position,
    stageId: row.stageId,
    status: row.status,
    title: row.title,
    value: row.value,
    wonAt: dateSnapshot(row.wonAt),
  };
}

async function emitDealUpdatedEvents(input: {
  after: AutomationRecord;
  before: AutomationRecord;
  dealId: string;
  ownerId: string;
  stageChanged?: boolean;
}) {
  const changes = diffAutomationFields(
    input.before,
    input.after,
    DEAL_AUTOMATION_FIELDS,
  );
  await emitAutomationEventsSafely([
    {
      entityId: input.dealId,
      entityType: "deal",
      ownerId: input.ownerId,
      payload: { after: input.after, before: input.before },
      type: "record_updated",
    },
    ...createFieldChangedEvents({
      changes,
      entityId: input.dealId,
      entityType: "deal",
      ownerId: input.ownerId,
    }),
    ...(input.stageChanged
      ? [
          {
            entityId: input.dealId,
            entityType: "deal" as const,
            ownerId: input.ownerId,
            payload: {
              deal: input.after,
              fromStageId: input.before.stageId,
              toStageId: input.after.stageId,
            },
            type: "deal_stage_changed" as const,
          },
        ]
      : []),
  ]);
}

/** Comprueba que la etapa pertenece al embudo y al usuario. */
async function assertStage(
  userId: string,
  pipelineId: string,
  stageId: string,
) {
  const [row] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(
      and(
        eq(stages.id, stageId),
        eq(stages.pipelineId, pipelineId),
        eq(stages.ownerId, userId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Etapa no válida para este embudo");
}

export async function createDeal(raw: DealFormValues) {
  const user = await requireUser();
  const data = dealFormSchema.parse(raw);
  await assertStage(user.id, data.pipelineId, data.stageId);

  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${deals.position}), 0)` })
    .from(deals)
    .where(and(eq(deals.ownerId, user.id), eq(deals.stageId, data.stageId)));
  const position = Number(max) + 1;
  const expectedCloseDate = data.expectedCloseDate
    ? new Date(data.expectedCloseDate)
    : null;
  const values = {
    currency: nullify(data.currency) ?? "EUR",
    expectedCloseDate,
    orgId: nullify(data.orgId),
    personId: nullify(data.personId),
    pipelineId: data.pipelineId,
    position,
    stageId: data.stageId,
    title: data.title.trim(),
    value: parseValue(data.value),
  };

  const [row] = await db
    .insert(deals)
    .values({
      ...values,
      ownerId: user.id,
    })
    .returning({ id: deals.id });

  if (!row) throw new Error("No se pudo crear el negocio");
  await recordStageChangeSafely({
    dealId: row.id,
    fromStageId: null,
    ownerId: user.id,
    pipelineId: data.pipelineId,
    toStageId: data.stageId,
  });
  await logEvent(user.id, "created", row.id, { title: data.title });
  await emitAutomationEventsSafely([
    {
      entityId: row.id,
      entityType: "deal",
      ownerId: user.id,
      payload: {
        record: dealSnapshot({
          ...values,
          customFields: {},
          lostAt: null,
          lostReason: null,
          status: "open",
          wonAt: null,
        }),
      },
      type: "record_created",
    },
  ]);
  revalidate();
  return { id: row.id };
}

export async function updateDeal(id: string, raw: DealFormValues) {
  const user = await requireUser();
  const data = dealFormSchema.parse(raw);
  await assertStage(user.id, data.pipelineId, data.stageId);

  // Si cambia de etapa desde el formulario, actualiza la marca de tiempo.
  const [current] = await db
    .select({
      currency: deals.currency,
      customFields: deals.customFields,
      expectedCloseDate: deals.expectedCloseDate,
      lostAt: deals.lostAt,
      lostReason: deals.lostReason,
      orgId: deals.orgId,
      personId: deals.personId,
      pipelineId: deals.pipelineId,
      position: deals.position,
      stageId: deals.stageId,
      status: deals.status,
      title: deals.title,
      value: deals.value,
      wonAt: deals.wonAt,
    })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)))
    .limit(1);
  const stageChanged = current && current.stageId !== data.stageId;
  const values = {
    currency: nullify(data.currency) ?? "EUR",
    expectedCloseDate: data.expectedCloseDate
      ? new Date(data.expectedCloseDate)
      : null,
    orgId: nullify(data.orgId),
    personId: nullify(data.personId),
    pipelineId: data.pipelineId,
    stageId: data.stageId,
    title: data.title.trim(),
    value: parseValue(data.value),
  };

  await db
    .update(deals)
    .set({
      ...values,
      ...(stageChanged ? { stageChangedAt: new Date() } : {}),
    })
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)));

  await logEvent(user.id, "updated", id);
  if (stageChanged && current) {
    await recordStageChangeSafely({
      dealId: id,
      fromStageId: current.stageId,
      ownerId: user.id,
      pipelineId: data.pipelineId,
      toStageId: data.stageId,
    });
  }
  if (current) {
    await emitDealUpdatedEvents({
      after: dealSnapshot({
        ...current,
        ...values,
      }),
      before: dealSnapshot(current),
      dealId: id,
      ownerId: user.id,
      stageChanged: Boolean(stageChanged),
    });
  }
  revalidate(id);
  return { id };
}

export async function deleteDeal(id: string) {
  const user = await requireUser();
  const [current] = await db
    .select({
      currency: deals.currency,
      customFields: deals.customFields,
      expectedCloseDate: deals.expectedCloseDate,
      lostAt: deals.lostAt,
      lostReason: deals.lostReason,
      orgId: deals.orgId,
      personId: deals.personId,
      pipelineId: deals.pipelineId,
      position: deals.position,
      stageId: deals.stageId,
      status: deals.status,
      title: deals.title,
      value: deals.value,
      wonAt: deals.wonAt,
    })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)))
    .limit(1);
  const deletedAt = new Date();
  await db
    .update(deals)
    .set({ deletedAt })
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)));
  await logEvent(user.id, "deleted", id);
  if (current) {
    await emitAutomationEventsSafely([
      {
        entityId: id,
        entityType: "deal",
        ownerId: user.id,
        payload: {
          deletedAt: deletedAt.toISOString(),
          previous: dealSnapshot(current),
        },
        type: "record_deleted",
      },
    ]);
  }
  revalidate();
  return { id };
}

/** Mueve un negocio a una etapa y posición (reordena la columna destino). */
export async function moveDeal(
  dealId: string,
  toStageId: string,
  newIndex: number,
) {
  const user = await requireUser();

  const [deal] = await db
    .select({
      currency: deals.currency,
      customFields: deals.customFields,
      expectedCloseDate: deals.expectedCloseDate,
      lostAt: deals.lostAt,
      lostReason: deals.lostReason,
      orgId: deals.orgId,
      personId: deals.personId,
      pipelineId: deals.pipelineId,
      position: deals.position,
      stageId: deals.stageId,
      status: deals.status,
      title: deals.title,
      value: deals.value,
      wonAt: deals.wonAt,
    })
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.ownerId, user.id)))
    .limit(1);
  if (!deal) throw new Error("Negocio no encontrado");
  await assertStage(user.id, deal.pipelineId, toStageId);

  const stageChanged = deal.stageId !== toStageId;

  // Orden actual de la columna destino (sin el negocio movido).
  const columnDeals = await db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        eq(deals.ownerId, user.id),
        eq(deals.stageId, toStageId),
        eq(deals.status, "open"),
        isNull(deals.deletedAt),
      ),
    )
    .orderBy(asc(deals.position));

  const order = columnDeals.map((d) => d.id).filter((id) => id !== dealId);
  const clamped = Math.max(0, Math.min(newIndex, order.length));
  order.splice(clamped, 0, dealId);

  // Reescribe posiciones de la columna destino.
  await Promise.all(
    order.map((id, index) =>
      db
        .update(deals)
        .set({
          position: index,
          ...(id === dealId
            ? {
                stageId: toStageId,
                ...(stageChanged ? { stageChangedAt: new Date() } : {}),
              }
            : {}),
        })
        .where(and(eq(deals.id, id), eq(deals.ownerId, user.id))),
    ),
  );

  if (stageChanged) {
    await logEvent(user.id, "stage_changed", dealId, { stageId: toStageId });
    await recordStageChangeSafely({
      dealId,
      fromStageId: deal.stageId,
      ownerId: user.id,
      pipelineId: deal.pipelineId,
      toStageId,
    });
  }
  await emitDealUpdatedEvents({
    after: dealSnapshot({
      ...deal,
      position: clamped,
      stageId: toStageId,
    }),
    before: dealSnapshot(deal),
    dealId,
    ownerId: user.id,
    stageChanged,
  });
  revalidate();
}

export async function setDealWon(id: string) {
  const user = await requireUser();
  const [current] = await db
    .select({
      currency: deals.currency,
      customFields: deals.customFields,
      expectedCloseDate: deals.expectedCloseDate,
      lostAt: deals.lostAt,
      lostReason: deals.lostReason,
      orgId: deals.orgId,
      personId: deals.personId,
      pipelineId: deals.pipelineId,
      position: deals.position,
      stageId: deals.stageId,
      status: deals.status,
      title: deals.title,
      value: deals.value,
      wonAt: deals.wonAt,
    })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)))
    .limit(1);
  const wonAt = new Date();
  await db
    .update(deals)
    .set({ lostAt: null, lostReason: null, status: "won", wonAt })
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)));
  await logEvent(user.id, "won", id);
  if (current) {
    await emitDealUpdatedEvents({
      after: dealSnapshot({
        ...current,
        lostAt: null,
        lostReason: null,
        status: "won",
        wonAt,
      }),
      before: dealSnapshot(current),
      dealId: id,
      ownerId: user.id,
    });
  }
  revalidate(id);
  return { id };
}

export async function setDealLost(id: string, reason?: string) {
  const user = await requireUser();
  const { reason: cleanReason } = lostReasonSchema.parse({ reason });
  const [current] = await db
    .select({
      currency: deals.currency,
      customFields: deals.customFields,
      expectedCloseDate: deals.expectedCloseDate,
      lostAt: deals.lostAt,
      lostReason: deals.lostReason,
      orgId: deals.orgId,
      personId: deals.personId,
      pipelineId: deals.pipelineId,
      position: deals.position,
      stageId: deals.stageId,
      status: deals.status,
      title: deals.title,
      value: deals.value,
      wonAt: deals.wonAt,
    })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)))
    .limit(1);
  const lostAt = new Date();
  const lostReason = nullify(cleanReason);
  await db
    .update(deals)
    .set({
      lostAt,
      lostReason,
      status: "lost",
      wonAt: null,
    })
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)));
  await logEvent(user.id, "lost", id, { reason: cleanReason });
  if (current) {
    await emitDealUpdatedEvents({
      after: dealSnapshot({
        ...current,
        lostAt,
        lostReason,
        status: "lost",
        wonAt: null,
      }),
      before: dealSnapshot(current),
      dealId: id,
      ownerId: user.id,
    });
  }
  revalidate(id);
  return { id };
}

export async function reopenDeal(id: string) {
  const user = await requireUser();
  const [current] = await db
    .select({
      currency: deals.currency,
      customFields: deals.customFields,
      expectedCloseDate: deals.expectedCloseDate,
      lostAt: deals.lostAt,
      lostReason: deals.lostReason,
      orgId: deals.orgId,
      personId: deals.personId,
      pipelineId: deals.pipelineId,
      position: deals.position,
      stageId: deals.stageId,
      status: deals.status,
      title: deals.title,
      value: deals.value,
      wonAt: deals.wonAt,
    })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)))
    .limit(1);
  await db
    .update(deals)
    .set({
      status: "open",
      wonAt: null,
      lostAt: null,
      lostReason: null,
      stageChangedAt: new Date(),
    })
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)));
  await logEvent(user.id, "reopened", id);
  if (current) {
    await emitDealUpdatedEvents({
      after: dealSnapshot({
        ...current,
        lostAt: null,
        lostReason: null,
        status: "open",
        wonAt: null,
      }),
      before: dealSnapshot(current),
      dealId: id,
      ownerId: user.id,
    });
  }
  revalidate(id);
  return { id };
}
