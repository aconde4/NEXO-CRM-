import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import {
  type CrmActionConfig,
  crmActionConfigSchema,
} from "@/lib/validations/sequence";
import { db } from "@/server/db";
import {
  activities,
  deals,
  enrollments,
  entityLabels,
  labels,
  organizations,
  persons,
  sequenceSteps,
  sequences,
  stages,
} from "@/server/db/schema";
import { inngest } from "@/server/inngest/client";
import { recordStageChangeSafely } from "@/server/services/deal-stage-events";
import {
  SEQUENCE_RUN_EVENT,
  SequenceRunError,
  type SequenceRunState,
  loadSequenceRun,
} from "@/server/services/sequence-runner";

/**
 * Acciones CRM internas (Fase T.3). Reutilizables desde el motor de secuencias (paso
 * "Acción CRM"): mover de etapa/embudo, etiquetar, actualizar campo, crear tarea,
 * inscribir/parar otra secuencia, notificar y webhook. El contexto es la entidad de la
 * inscripción (siempre hay contacto; opcionalmente empresa y negocio).
 */
export type CrmActionContext = {
  ownerId: string;
  personId: string | null;
  orgId: string | null;
  dealId: string | null;
};

export type CrmActionResult = { skipped: boolean; message: string };

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// --- Helpers de embudo (mover a otro embudo, crear entrada si falta) --------
async function findDealInPipeline(
  ownerId: string,
  personId: string,
  pipelineId: string,
): Promise<{ id: string; stageId: string } | null> {
  const [row] = await db
    .select({ id: deals.id, stageId: deals.stageId })
    .from(deals)
    .where(
      and(
        eq(deals.ownerId, ownerId),
        eq(deals.personId, personId),
        eq(deals.pipelineId, pipelineId),
        isNull(deals.deletedAt),
      ),
    )
    .orderBy(asc(deals.createdAt))
    .limit(1);
  return row ?? null;
}

async function firstStageOfPipeline(
  ownerId: string,
  pipelineId: string,
): Promise<string | null> {
  const [stage] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(and(eq(stages.pipelineId, pipelineId), eq(stages.ownerId, ownerId)))
    .orderBy(asc(stages.position), asc(stages.createdAt))
    .limit(1);
  return stage?.id ?? null;
}

/** Título del negocio: nombre comercial/empresa o, en su defecto, el contacto. */
async function dealTitleForPerson(
  ownerId: string,
  personId: string,
  orgId: string | null,
): Promise<string> {
  if (orgId) {
    const [org] = await db
      .select({ name: organizations.name, tradeName: organizations.tradeName })
      .from(organizations)
      .where(and(eq(organizations.id, orgId), eq(organizations.ownerId, ownerId)))
      .limit(1);
    const orgName = org?.tradeName?.trim() || org?.name?.trim();
    if (orgName) return orgName;
  }
  const [person] = await db
    .select({ firstName: persons.firstName, lastName: persons.lastName })
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.ownerId, ownerId)))
    .limit(1);
  return (
    [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim() ||
    "Contacto"
  );
}

async function createDealInPipeline(
  ownerId: string,
  personId: string,
  orgId: string | null,
  pipelineId: string,
  stageId: string,
): Promise<string | null> {
  const title = await dealTitleForPerson(ownerId, personId, orgId);
  const [{ maxPos } = { maxPos: 0 }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${deals.position}), 0)` })
    .from(deals)
    .where(and(eq(deals.ownerId, ownerId), eq(deals.stageId, stageId)));

  const [created] = await db
    .insert(deals)
    .values({
      currency: "EUR",
      orgId,
      ownerId,
      personId,
      pipelineId,
      position: Number(maxPos) + 1,
      stageId,
      status: "open",
      title,
      value: 0,
    })
    .returning({ id: deals.id });
  if (!created) return null;
  await recordStageChangeSafely({
    dealId: created.id,
    fromStageId: null,
    ownerId,
    pipelineId,
    toStageId: stageId,
  });
  return created.id;
}

// --- Acciones individuales --------------------------------------------------
async function moveStageAction(
  ctx: CrmActionContext,
  action: Extract<CrmActionConfig, { kind: "move_stage" }>,
): Promise<CrmActionResult> {
  if (!ctx.personId) {
    return { message: "Mover de etapa requiere un contacto.", skipped: true };
  }

  const [stage] = await db
    .select({ id: stages.id, name: stages.name, pipelineId: stages.pipelineId })
    .from(stages)
    .where(and(eq(stages.id, action.stageId), eq(stages.ownerId, ctx.ownerId)))
    .limit(1);
  if (!stage) return { message: "Etapa destino no encontrada.", skipped: true };
  if (stage.pipelineId !== action.pipelineId) {
    return {
      message: "La etapa no pertenece al embudo elegido.",
      skipped: true,
    };
  }

  let deal = await findDealInPipeline(
    ctx.ownerId,
    ctx.personId,
    action.pipelineId,
  );
  let prefix = "";
  if (!deal) {
    if (!action.createIfMissing) {
      return {
        message:
          "El contacto no tiene negocio en el embudo destino; acción omitida.",
        skipped: true,
      };
    }
    const firstStageId = await firstStageOfPipeline(
      ctx.ownerId,
      action.pipelineId,
    );
    if (!firstStageId) {
      return { message: "El embudo destino no tiene etapas.", skipped: true };
    }
    const newId = await createDealInPipeline(
      ctx.ownerId,
      ctx.personId,
      ctx.orgId,
      action.pipelineId,
      firstStageId,
    );
    if (!newId) {
      return {
        message: "No se pudo crear la entrada en el embudo.",
        skipped: true,
      };
    }
    deal = { id: newId, stageId: firstStageId };
    prefix = "Entrada creada en el embudo destino. ";
  }

  if (deal.stageId === stage.id) {
    return {
      message: `${prefix}El negocio ya estaba en "${stage.name}".`,
      skipped: false,
    };
  }

  await db
    .update(deals)
    .set({ stageId: stage.id, stageChangedAt: new Date() })
    .where(and(eq(deals.id, deal.id), eq(deals.ownerId, ctx.ownerId)));
  await recordStageChangeSafely({
    dealId: deal.id,
    fromStageId: deal.stageId,
    ownerId: ctx.ownerId,
    pipelineId: action.pipelineId,
    toStageId: stage.id,
  });
  return {
    message: `${prefix}Negocio movido a "${stage.name}".`,
    skipped: false,
  };
}

async function labelAction(
  ctx: CrmActionContext,
  labelId: string,
  mode: "add" | "remove",
): Promise<CrmActionResult> {
  if (!ctx.personId) {
    return { message: "Etiquetar requiere un contacto.", skipped: true };
  }
  const [label] = await db
    .select({ id: labels.id, name: labels.name })
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.ownerId, ctx.ownerId)))
    .limit(1);
  if (!label) return { message: "Etiqueta no encontrada.", skipped: true };

  if (mode === "remove") {
    const removed = await db
      .delete(entityLabels)
      .where(
        and(
          eq(entityLabels.labelId, labelId),
          eq(entityLabels.entityType, "person"),
          eq(entityLabels.entityId, ctx.personId),
        ),
      )
      .returning({ id: entityLabels.id });
    return removed.length > 0
      ? { message: `Etiqueta "${label.name}" quitada.`, skipped: false }
      : { message: "El contacto no tenía la etiqueta.", skipped: true };
  }

  const [existing] = await db
    .select({ id: entityLabels.id })
    .from(entityLabels)
    .where(
      and(
        eq(entityLabels.labelId, labelId),
        eq(entityLabels.entityType, "person"),
        eq(entityLabels.entityId, ctx.personId),
      ),
    )
    .limit(1);
  if (existing) {
    return { message: "El contacto ya tenía la etiqueta.", skipped: true };
  }
  await db.insert(entityLabels).values({
    entityId: ctx.personId,
    entityType: "person",
    labelId,
  });
  return { message: `Etiqueta "${label.name}" añadida.`, skipped: false };
}

async function updateFieldAction(
  ctx: CrmActionContext,
  action: Extract<CrmActionConfig, { kind: "update_field" }>,
): Promise<CrmActionResult> {
  const patch = sql`coalesce(custom_fields, '{}'::jsonb) || ${JSON.stringify({
    [action.field]: action.value,
  })}::jsonb`;

  if (action.scope === "person") {
    if (!ctx.personId) {
      return { message: "Sin contacto sobre el que actualizar.", skipped: true };
    }
    await db
      .update(persons)
      .set({ customFields: patch })
      .where(and(eq(persons.id, ctx.personId), eq(persons.ownerId, ctx.ownerId)));
  } else if (action.scope === "organization") {
    if (!ctx.orgId) {
      return { message: "El contacto no tiene empresa.", skipped: true };
    }
    await db
      .update(organizations)
      .set({ customFields: patch })
      .where(
        and(eq(organizations.id, ctx.orgId), eq(organizations.ownerId, ctx.ownerId)),
      );
  } else {
    if (!ctx.dealId) {
      return { message: "No hay negocio vinculado a la inscripción.", skipped: true };
    }
    await db
      .update(deals)
      .set({ customFields: patch })
      .where(and(eq(deals.id, ctx.dealId), eq(deals.ownerId, ctx.ownerId)));
  }
  return { message: `Campo "${action.field}" actualizado.`, skipped: false };
}

async function createTaskAction(
  ctx: CrmActionContext,
  action: Extract<CrmActionConfig, { kind: "create_task" }>,
): Promise<CrmActionResult> {
  await db.insert(activities).values({
    dealId: ctx.dealId,
    dueAt: new Date(),
    notes: clean(action.taskNotes),
    orgId: ctx.orgId,
    ownerId: ctx.ownerId,
    personId: ctx.personId,
    subject: action.taskSubject,
    type: "task",
  });
  return { message: `Tarea creada: ${action.taskSubject}`, skipped: false };
}

async function enrollSequenceAction(
  ctx: CrmActionContext,
  sequenceId: string,
): Promise<CrmActionResult> {
  if (!ctx.personId) {
    return { message: "Inscribir requiere un contacto.", skipped: true };
  }
  const [sequence] = await db
    .select({ status: sequences.status })
    .from(sequences)
    .where(and(eq(sequences.id, sequenceId), eq(sequences.ownerId, ctx.ownerId)))
    .limit(1);
  if (!sequence) return { message: "Secuencia no encontrada.", skipped: true };
  if (sequence.status !== "active") {
    return { message: "La secuencia no está activa.", skipped: true };
  }
  const stepCount = await db.$count(
    sequenceSteps,
    and(
      eq(sequenceSteps.sequenceId, sequenceId),
      eq(sequenceSteps.ownerId, ctx.ownerId),
    ),
  );
  if (stepCount === 0) {
    return { message: "La secuencia no tiene pasos.", skipped: true };
  }

  const now = new Date();
  const [enrollment] = await db
    .insert(enrollments)
    .values({
      context: { enrolledBy: "sequence_action" },
      currentStepPosition: 0,
      enrolledAt: now,
      nextRunAt: now,
      orgId: ctx.orgId,
      ownerId: ctx.ownerId,
      personId: ctx.personId,
      sequenceId,
      status: "active",
    })
    .onConflictDoNothing({
      target: [enrollments.sequenceId, enrollments.personId],
    })
    .returning({ id: enrollments.id });
  if (!enrollment) {
    return { message: "El contacto ya estaba inscrito.", skipped: true };
  }
  await inngest.send({
    data: { enrollmentId: enrollment.id, sequenceId },
    name: SEQUENCE_RUN_EVENT,
  });
  return { message: "Contacto inscrito en la secuencia.", skipped: false };
}

async function stopSequenceAction(
  ctx: CrmActionContext,
  sequenceId: string,
): Promise<CrmActionResult> {
  if (!ctx.personId) {
    return { message: "Parar requiere un contacto.", skipped: true };
  }
  const stopped = await db
    .update(enrollments)
    .set({
      lastEventAt: new Date(),
      nextRunAt: null,
      status: "stopped",
      stopReason: "crm_action_stop",
      stoppedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(enrollments.ownerId, ctx.ownerId),
        eq(enrollments.sequenceId, sequenceId),
        eq(enrollments.personId, ctx.personId),
        eq(enrollments.status, "active"),
      ),
    )
    .returning({ id: enrollments.id });
  return stopped.length > 0
    ? { message: "Inscripción detenida en la otra secuencia.", skipped: false }
    : {
        message: "El contacto no tenía una inscripción activa que parar.",
        skipped: true,
      };
}

async function webhookAction(
  ctx: CrmActionContext,
  url: string,
): Promise<CrmActionResult> {
  const response = await fetch(url, {
    body: JSON.stringify({
      dealId: ctx.dealId,
      orgId: ctx.orgId,
      ownerId: ctx.ownerId,
      personId: ctx.personId,
      source: "sequence_crm_action",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Webhook respondió ${response.status}`);
  }
  return { message: `Webhook llamado (${response.status}).`, skipped: false };
}

/** Ejecuta una acción CRM sobre el contexto dado. No lanza salvo errores de IO. */
export async function executeCrmAction(
  ctx: CrmActionContext,
  action: CrmActionConfig,
): Promise<CrmActionResult> {
  switch (action.kind) {
    case "move_stage":
      return moveStageAction(ctx, action);
    case "add_label":
      return labelAction(ctx, action.labelId, "add");
    case "remove_label":
      return labelAction(ctx, action.labelId, "remove");
    case "update_field":
      return updateFieldAction(ctx, action);
    case "create_task":
      return createTaskAction(ctx, action);
    case "enroll_sequence":
      return enrollSequenceAction(ctx, action.sequenceId);
    case "stop_sequence":
      return stopSequenceAction(ctx, action.sequenceId);
    case "notify":
      return { message: `Aviso: ${action.message}`, skipped: false };
    case "webhook":
      return webhookAction(ctx, action.url);
    default:
      return { message: "Acción CRM no soportada.", skipped: true };
  }
}

export type SequenceCrmActionOutcome =
  | { reason: string; state: "noop" }
  | { state: "executed"; skipped: boolean; message: string };

/** Glue del paso "Acción CRM" de una secuencia (Fase T.3). */
export async function runSequenceCrmActionStep(input: {
  enrollmentId: string;
  stepId: string;
}): Promise<SequenceCrmActionOutcome> {
  const state: SequenceRunState = await loadSequenceRun(input.enrollmentId);
  if (state.state !== "ready") return state;

  const step = state.steps.find((item) => item.id === input.stepId);
  if (!step || step.type !== "crm_action") {
    throw new SequenceRunError("Paso de acción CRM no encontrado.", "not_found");
  }

  const parsed = crmActionConfigSchema.safeParse(step.settings.action);
  if (!parsed.success) {
    return {
      message: "Acción CRM mal configurada; se omite.",
      skipped: true,
      state: "executed",
    };
  }

  const result = await executeCrmAction(
    {
      dealId: state.dealId,
      orgId: state.orgId,
      ownerId: state.ownerId,
      personId: state.person.id,
    },
    parsed.data,
  );
  return { ...result, state: "executed" };
}
