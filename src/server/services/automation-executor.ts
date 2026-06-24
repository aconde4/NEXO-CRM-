import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  type AutomationGraph,
  type AutomationNode,
  type AutomationRunLogEntry,
  activities,
  automationRuns,
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
import { SEQUENCE_RUN_EVENT } from "@/server/services/sequence-runner";

/**
 * Ejecutor de automatizaciones (Fase 6.5). Procesa un `automation_runs` en estado
 * `waiting`: recorre el grafo y ejecuta cada nodo de **acción** sobre la entidad que
 * disparó el flujo, registrando el resultado en `log` y dejando el run en `completed`
 * (o `failed` si alguna acción falla). Las esperas y condiciones (nodos wait/condition)
 * se resuelven en 6.6; aquí se omiten dejando traza.
 */

type EntityType = "person" | "organization" | "deal";

type EntityContext = {
  entityType: EntityType | null;
  entityId: string | null;
  personId: string | null;
  orgId: string | null;
  dealId: string | null;
};

type ActionResult = { skipped: boolean; message: string };

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function logEntry(
  node: AutomationNode,
  status: AutomationRunLogEntry["status"],
  message: string,
): AutomationRunLogEntry {
  return {
    at: new Date().toISOString(),
    kind: node.kind ?? node.type,
    message,
    nodeId: node.id,
    status,
  };
}

/** Resuelve persona/empresa/negocio relacionados con la entidad disparadora. */
async function resolveEntityContext(
  ownerId: string,
  entityType: string | null,
  entityId: string | null,
): Promise<EntityContext> {
  const base: EntityContext = {
    dealId: null,
    entityId,
    entityType: (entityType as EntityType) ?? null,
    orgId: null,
    personId: null,
  };
  if (!entityId) return base;

  if (entityType === "person") {
    const [p] = await db
      .select({ orgId: persons.orgId })
      .from(persons)
      .where(and(eq(persons.id, entityId), eq(persons.ownerId, ownerId)))
      .limit(1);
    return { ...base, orgId: p?.orgId ?? null, personId: entityId };
  }
  if (entityType === "organization") {
    return { ...base, orgId: entityId };
  }
  if (entityType === "deal") {
    const [d] = await db
      .select({ orgId: deals.orgId, personId: deals.personId })
      .from(deals)
      .where(and(eq(deals.id, entityId), eq(deals.ownerId, ownerId)))
      .limit(1);
    return {
      ...base,
      dealId: entityId,
      orgId: d?.orgId ?? null,
      personId: d?.personId ?? null,
    };
  }
  return base;
}

/** Aplica `customFields[field] = value` a la entidad principal del contexto. */
async function updateEntityField(
  ownerId: string,
  ctx: EntityContext,
  field: string,
  value: string,
): Promise<ActionResult> {
  const patch = sql`coalesce(custom_fields, '{}'::jsonb) || ${JSON.stringify({
    [field]: value,
  })}::jsonb`;

  if (ctx.personId) {
    await db
      .update(persons)
      .set({ customFields: patch })
      .where(and(eq(persons.id, ctx.personId), eq(persons.ownerId, ownerId)));
  } else if (ctx.orgId) {
    await db
      .update(organizations)
      .set({ customFields: patch })
      .where(
        and(eq(organizations.id, ctx.orgId), eq(organizations.ownerId, ownerId)),
      );
  } else if (ctx.dealId) {
    await db
      .update(deals)
      .set({ customFields: patch })
      .where(and(eq(deals.id, ctx.dealId), eq(deals.ownerId, ownerId)));
  } else {
    return { message: "Sin entidad sobre la que actualizar el campo.", skipped: true };
  }
  return { message: `Campo "${field}" actualizado.`, skipped: false };
}

async function addLabel(
  ownerId: string,
  ctx: EntityContext,
  labelId: string,
): Promise<ActionResult> {
  if (!ctx.entityType || !ctx.entityId) {
    return { message: "Sin entidad a la que etiquetar.", skipped: true };
  }
  const [label] = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.ownerId, ownerId)))
    .limit(1);
  if (!label) return { message: "Etiqueta no encontrada.", skipped: true };

  const [existing] = await db
    .select({ id: entityLabels.id })
    .from(entityLabels)
    .where(
      and(
        eq(entityLabels.labelId, labelId),
        eq(entityLabels.entityType, ctx.entityType),
        eq(entityLabels.entityId, ctx.entityId),
      ),
    )
    .limit(1);
  if (existing) return { message: "La entidad ya tenía la etiqueta.", skipped: true };

  await db.insert(entityLabels).values({
    entityId: ctx.entityId,
    entityType: ctx.entityType,
    labelId,
  });
  return { message: "Etiqueta añadida.", skipped: false };
}

async function moveStage(
  ownerId: string,
  ctx: EntityContext,
  stageId: string,
): Promise<ActionResult> {
  if (!ctx.dealId) {
    return { message: "Mover de etapa solo aplica a negocios.", skipped: true };
  }
  const [stage] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.ownerId, ownerId)))
    .limit(1);
  if (!stage) return { message: "Etapa destino no encontrada.", skipped: true };

  await db
    .update(deals)
    .set({ stageId, stageChangedAt: new Date() })
    .where(and(eq(deals.id, ctx.dealId), eq(deals.ownerId, ownerId)));
  return { message: "Negocio movido de etapa.", skipped: false };
}

async function enrollSequence(
  ownerId: string,
  ctx: EntityContext,
  sequenceId: string,
): Promise<ActionResult> {
  if (!ctx.personId) {
    return { message: "Inscribir requiere un contacto.", skipped: true };
  }
  const [sequence] = await db
    .select({ status: sequences.status })
    .from(sequences)
    .where(and(eq(sequences.id, sequenceId), eq(sequences.ownerId, ownerId)))
    .limit(1);
  if (!sequence) return { message: "Secuencia no encontrada.", skipped: true };
  if (sequence.status !== "active") {
    return { message: "La secuencia no está activa.", skipped: true };
  }
  const stepCount = await db.$count(
    sequenceSteps,
    and(
      eq(sequenceSteps.sequenceId, sequenceId),
      eq(sequenceSteps.ownerId, ownerId),
    ),
  );
  if (stepCount === 0) {
    return { message: "La secuencia no tiene pasos.", skipped: true };
  }

  const now = new Date();
  const [enrollment] = await db
    .insert(enrollments)
    .values({
      context: { enrolledBy: "automation" },
      currentStepPosition: 0,
      enrolledAt: now,
      nextRunAt: now,
      orgId: ctx.orgId,
      ownerId,
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

async function callWebhook(
  url: string,
  run: { id: string; automationId: string; triggerEvent: unknown },
): Promise<ActionResult> {
  const response = await fetch(url, {
    body: JSON.stringify({
      automationId: run.automationId,
      event: run.triggerEvent,
      runId: run.id,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Webhook respondió ${response.status}`);
  }
  return { message: `Webhook llamado (${response.status}).`, skipped: false };
}

async function executeAction(
  ownerId: string,
  node: AutomationNode,
  ctx: EntityContext,
  run: { id: string; automationId: string; triggerEvent: unknown },
): Promise<ActionResult> {
  const config = node.config ?? {};
  switch (node.kind) {
    case "create_task": {
      const subject = clean(config.subject) ?? "Tarea de automatización";
      await db.insert(activities).values({
        dealId: ctx.dealId,
        dueAt: new Date(),
        orgId: ctx.orgId,
        ownerId,
        personId: ctx.personId,
        subject,
        type: "task",
      });
      return { message: `Tarea creada: ${subject}`, skipped: false };
    }
    case "add_label": {
      const labelId = clean(config.labelId);
      if (!labelId) return { message: "Sin etiqueta configurada.", skipped: true };
      return addLabel(ownerId, ctx, labelId);
    }
    case "move_stage": {
      const stageId = clean(config.stageId);
      if (!stageId) return { message: "Sin etapa configurada.", skipped: true };
      return moveStage(ownerId, ctx, stageId);
    }
    case "update_field": {
      const field = clean(config.field);
      if (!field) return { message: "Sin campo configurado.", skipped: true };
      return updateEntityField(ownerId, ctx, field, clean(config.value) ?? "");
    }
    case "enroll_sequence": {
      const sequenceId = clean(config.sequenceId);
      if (!sequenceId)
        return { message: "Sin secuencia configurada.", skipped: true };
      return enrollSequence(ownerId, ctx, sequenceId);
    }
    case "webhook": {
      const url = clean(config.url);
      if (!url || !/^https?:\/\//i.test(url)) {
        return { message: "URL de webhook no válida.", skipped: true };
      }
      return callWebhook(url, run);
    }
    case "notify": {
      const message = clean(config.message) ?? "Notificación de automatización";
      return { message: `Notificación: ${message}`, skipped: false };
    }
    case "send_email":
      return {
        message: "Envío de email desde automatización: pendiente.",
        skipped: true,
      };
    case "ai_summary":
      return { message: "Resumen con IA: pendiente (Fase 8).", skipped: true };
    default:
      return { message: `Acción no soportada: ${node.kind}`, skipped: true };
  }
}

export type AutomationRunResult = {
  status: "completed" | "failed" | "skipped" | "not_found";
  executed?: number;
  failed?: number;
  reason?: string;
};

/** Ejecuta un run (idempotente: solo actúa si está en `waiting`). */
export async function executeAutomationRun(
  runId: string,
): Promise<AutomationRunResult> {
  const [run] = await db
    .select({
      automationId: automationRuns.automationId,
      context: automationRuns.context,
      entityId: automationRuns.entityId,
      entityType: automationRuns.entityType,
      log: automationRuns.log,
      ownerId: automationRuns.ownerId,
      status: automationRuns.status,
      triggerEvent: automationRuns.triggerEvent,
    })
    .from(automationRuns)
    .where(eq(automationRuns.id, runId))
    .limit(1);

  if (!run) return { status: "not_found" };
  if (run.status !== "waiting") {
    return { reason: run.status, status: "skipped" };
  }

  // Marca en ejecución solo si seguía en waiting (evita doble ejecución por carrera).
  const claimed = await db
    .update(automationRuns)
    .set({ status: "running" })
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.status, "waiting")))
    .returning({ id: automationRuns.id });
  if (claimed.length === 0) return { reason: "race", status: "skipped" };

  const graph = (run.context?.graph as AutomationGraph | undefined) ?? {
    edges: [],
    nodes: [],
  };
  const ctx = await resolveEntityContext(
    run.ownerId,
    run.entityType,
    run.entityId,
  );
  const runRef = {
    automationId: run.automationId,
    id: runId,
    triggerEvent: run.triggerEvent,
  };

  const log: AutomationRunLogEntry[] = [...(run.log ?? [])];
  let executed = 0;
  let failed = 0;

  for (const node of graph.nodes) {
    if (node.type !== "action") {
      log.push(
        logEntry(
          node,
          "skipped",
          node.type === "wait"
            ? "Espera (se ejecuta en 6.6)."
            : "Condición (se evalúa en 6.6).",
        ),
      );
      continue;
    }
    try {
      const result = await executeAction(run.ownerId, node, ctx, runRef);
      log.push(logEntry(node, result.skipped ? "skipped" : "ok", result.message));
      if (!result.skipped) executed += 1;
    } catch (error) {
      failed += 1;
      log.push(
        logEntry(
          node,
          "failed",
          error instanceof Error ? error.message : "Error en la acción.",
        ),
      );
    }
  }

  const status = failed > 0 ? "failed" : "completed";
  await db
    .update(automationRuns)
    .set({
      error: failed > 0 ? `${failed} acción(es) fallaron` : null,
      finishedAt: new Date(),
      log,
      status,
    })
    .where(eq(automationRuns.id, runId));

  return { executed, failed, status };
}
