"use server";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  dealFormSchema,
  lostReasonSchema,
  type DealFormValues,
} from "@/lib/validations/deal";
import { db } from "@/server/db";
import { activityLog, deals, stages } from "@/server/db/schema";

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

  const [row] = await db
    .insert(deals)
    .values({
      title: data.title.trim(),
      value: parseValue(data.value),
      currency: nullify(data.currency) ?? "EUR",
      pipelineId: data.pipelineId,
      stageId: data.stageId,
      personId: nullify(data.personId),
      orgId: nullify(data.orgId),
      expectedCloseDate: data.expectedCloseDate
        ? new Date(data.expectedCloseDate)
        : null,
      position: Number(max) + 1,
      ownerId: user.id,
    })
    .returning({ id: deals.id });

  if (!row) throw new Error("No se pudo crear el negocio");
  await logEvent(user.id, "created", row.id, { title: data.title });
  revalidate();
  return { id: row.id };
}

export async function updateDeal(id: string, raw: DealFormValues) {
  const user = await requireUser();
  const data = dealFormSchema.parse(raw);
  await assertStage(user.id, data.pipelineId, data.stageId);

  // Si cambia de etapa desde el formulario, actualiza la marca de tiempo.
  const [current] = await db
    .select({ stageId: deals.stageId })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)))
    .limit(1);
  const stageChanged = current && current.stageId !== data.stageId;

  await db
    .update(deals)
    .set({
      title: data.title.trim(),
      value: parseValue(data.value),
      currency: nullify(data.currency) ?? "EUR",
      pipelineId: data.pipelineId,
      stageId: data.stageId,
      personId: nullify(data.personId),
      orgId: nullify(data.orgId),
      expectedCloseDate: data.expectedCloseDate
        ? new Date(data.expectedCloseDate)
        : null,
      ...(stageChanged ? { stageChangedAt: new Date() } : {}),
    })
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)));

  await logEvent(user.id, "updated", id);
  revalidate(id);
  return { id };
}

export async function deleteDeal(id: string) {
  const user = await requireUser();
  await db
    .update(deals)
    .set({ deletedAt: new Date() })
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)));
  await logEvent(user.id, "deleted", id);
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
    .select({ stageId: deals.stageId, pipelineId: deals.pipelineId })
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
  }
  revalidate();
}

export async function setDealWon(id: string) {
  const user = await requireUser();
  await db
    .update(deals)
    .set({ status: "won", wonAt: new Date(), lostAt: null, lostReason: null })
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)));
  await logEvent(user.id, "won", id);
  revalidate(id);
  return { id };
}

export async function setDealLost(id: string, reason?: string) {
  const user = await requireUser();
  const { reason: cleanReason } = lostReasonSchema.parse({ reason });
  await db
    .update(deals)
    .set({
      status: "lost",
      lostAt: new Date(),
      lostReason: nullify(cleanReason),
      wonAt: null,
    })
    .where(and(eq(deals.id, id), eq(deals.ownerId, user.id)));
  await logEvent(user.id, "lost", id, { reason: cleanReason });
  revalidate(id);
  return { id };
}

export async function reopenDeal(id: string) {
  const user = await requireUser();
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
  revalidate(id);
  return { id };
}
