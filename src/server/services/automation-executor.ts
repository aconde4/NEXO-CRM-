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
 * Ejecutor de automatizaciones (Fase 6.6). Procesa un `automation_runs` en estado
 * `waiting`: recorre el grafo sobre la entidad que disparó el flujo, evaluando
 * condiciones, respetando esperas duraderas vía Inngest y ejecutando acciones con log
 * por nodo. El executor sigue siendo idempotente en la entrada (`waiting` → `running`).
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
type ConditionResult = {
  matched: boolean;
  message: string;
  value?: unknown;
};
type RunRef = { id: string; automationId: string; triggerEvent: unknown };

export type AutomationSleep = (input: {
  duration: string;
  node: AutomationNode;
}) => Promise<void>;

export type ExecuteAutomationRunOptions = {
  sleep?: AutomationSleep;
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function logEntry(
  node: AutomationNode,
  status: AutomationRunLogEntry["status"],
  message: string,
  detail?: Record<string, unknown>,
): AutomationRunLogEntry {
  return {
    at: new Date().toISOString(),
    ...(detail ? { detail } : {}),
    kind: node.kind ?? node.type,
    message,
    nodeId: node.id,
    status,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPath(value: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((current, part) => {
    if (!isRecord(current)) return undefined;
    return current[part];
  }, value);
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function compareGreater(left: unknown, right: string, op: "gt" | "lt"): boolean {
  const leftNumber =
    typeof left === "number" ? left : Number.parseFloat(asText(left));
  const rightNumber = Number.parseFloat(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return op === "gt" ? leftNumber > rightNumber : leftNumber < rightNumber;
  }

  const leftDate = new Date(asText(left)).getTime();
  const rightDate = new Date(right).getTime();
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    return op === "gt" ? leftDate > rightDate : leftDate < rightDate;
  }

  return false;
}

function conditionBranchValue(value: unknown): "continue" | "stop" {
  return value === "continue" ? "continue" : "stop";
}

function waitDuration(node: AutomationNode): string {
  const days = Math.max(0, Number(node.config?.waitDays ?? 0));
  const hours = Math.max(0, Number(node.config?.waitHours ?? 0));
  const totalHours = days * 24 + hours;
  if (totalHours <= 0) return "1s";
  if (hours === 0) return `${days}d`;
  return `${totalHours}h`;
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

async function loadPersonSnapshot(ownerId: string, personId: string | null) {
  if (!personId) return null;
  const [row] = await db
    .select({
      campaign: persons.campaign,
      customFields: persons.customFields,
      email: persons.email,
      firstName: persons.firstName,
      id: persons.id,
      lastName: persons.lastName,
      marketingStatus: persons.marketingStatus,
      orgId: persons.orgId,
      phone: persons.phone,
      source: persons.source,
      title: persons.title,
    })
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

async function loadOrganizationSnapshot(ownerId: string, orgId: string | null) {
  if (!orgId) return null;
  const [row] = await db
    .select({
      address: organizations.address,
      customFields: organizations.customFields,
      domain: organizations.domain,
      id: organizations.id,
      industry: organizations.industry,
      name: organizations.name,
      phone: organizations.phone,
      size: organizations.size,
      tradeName: organizations.tradeName,
      website: organizations.website,
    })
    .from(organizations)
    .where(and(eq(organizations.id, orgId), eq(organizations.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

async function loadDealSnapshot(ownerId: string, dealId: string | null) {
  if (!dealId) return null;
  const [row] = await db
    .select({
      currency: deals.currency,
      customFields: deals.customFields,
      expectedCloseDate: deals.expectedCloseDate,
      id: deals.id,
      orgId: deals.orgId,
      personId: deals.personId,
      pipelineId: deals.pipelineId,
      stageChangedAt: deals.stageChangedAt,
      stageId: deals.stageId,
      status: deals.status,
      title: deals.title,
      value: deals.value,
    })
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

async function resolveScopedField(input: {
  ctx: EntityContext;
  field: string;
  ownerId: string;
  scope: EntityType;
}) {
  if (input.scope === "person") {
    const person = await loadPersonSnapshot(input.ownerId, input.ctx.personId);
    return readPath(person, input.field);
  }
  if (input.scope === "organization") {
    const org = await loadOrganizationSnapshot(input.ownerId, input.ctx.orgId);
    return readPath(org, input.field);
  }
  const deal = await loadDealSnapshot(input.ownerId, input.ctx.dealId);
  return readPath(deal, input.field);
}

async function resolveConditionValue(input: {
  ctx: EntityContext;
  field: string;
  ownerId: string;
  triggerEvent: unknown;
}): Promise<unknown> {
  const field = input.field.trim();
  if (!field) return undefined;

  if (field.startsWith("payload.")) {
    return readPath(readPath(input.triggerEvent, "payload"), field.slice(8));
  }
  if (field.startsWith("event.")) {
    return readPath(input.triggerEvent, field.slice(6));
  }

  const explicit = field.match(/^(person|organization|deal)\.(.+)$/);
  if (explicit) {
    return resolveScopedField({
      ctx: input.ctx,
      field: explicit[2]!,
      ownerId: input.ownerId,
      scope: explicit[1] as EntityType,
    });
  }

  const custom = field.match(/^custom[:.](.+)$/);
  if (custom) {
    const key = custom[1]!;
    const scope = input.ctx.entityType ?? "person";
    return resolveScopedField({
      ctx: input.ctx,
      field: `customFields.${key}`,
      ownerId: input.ownerId,
      scope,
    });
  }

  if (input.ctx.entityType) {
    const value = await resolveScopedField({
      ctx: input.ctx,
      field,
      ownerId: input.ownerId,
      scope: input.ctx.entityType,
    });
    if (value !== undefined) return value;
  }

  if (input.ctx.personId) {
    const value = await resolveScopedField({
      ctx: input.ctx,
      field,
      ownerId: input.ownerId,
      scope: "person",
    });
    if (value !== undefined) return value;
  }

  if (input.ctx.orgId) {
    const value = await resolveScopedField({
      ctx: input.ctx,
      field,
      ownerId: input.ownerId,
      scope: "organization",
    });
    if (value !== undefined) return value;
  }

  return undefined;
}

async function evaluateCondition(input: {
  ctx: EntityContext;
  node: AutomationNode;
  ownerId: string;
  triggerEvent: unknown;
}): Promise<ConditionResult> {
  const field = clean(input.node.config?.field);
  if (!field) {
    return { matched: false, message: "Condición sin campo configurado." };
  }

  const op = clean(input.node.config?.op) ?? "eq";
  const expected = clean(input.node.config?.value) ?? "";
  const value = await resolveConditionValue({
    ctx: input.ctx,
    field,
    ownerId: input.ownerId,
    triggerEvent: input.triggerEvent,
  });

  let matched = false;
  switch (op) {
    case "is_set":
      matched = !isEmptyValue(value);
      break;
    case "is_empty":
      matched = isEmptyValue(value);
      break;
    case "neq":
      matched = asText(value).toLowerCase() !== expected.toLowerCase();
      break;
    case "contains":
      matched = asText(value).toLowerCase().includes(expected.toLowerCase());
      break;
    case "gt":
    case "lt":
      matched = compareGreater(value, expected, op);
      break;
    case "eq":
    default:
      matched = asText(value).toLowerCase() === expected.toLowerCase();
      break;
  }

  return {
    matched,
    message: matched
      ? `Condición cumplida: ${field}.`
      : `Condición no cumplida: ${field}.`,
    value,
  };
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
  run: RunRef,
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

function nodeLabel(node: AutomationNode, index: number): string {
  if (node.type === "action") return `${index + 1}. Acción ${node.kind ?? ""}`;
  if (node.type === "wait") return `${index + 1}. Espera`;
  return `${index + 1}. Condición`;
}

function nextNodeForBranch(input: {
  branch?: "true" | "false";
  graph: AutomationGraph;
  node: AutomationNode;
}): AutomationNode | null {
  const index = input.graph.nodes.findIndex((node) => node.id === input.node.id);
  const outgoing = input.graph.edges.filter(
    (edge) => edge.source === input.node.id,
  );

  let targetId: string | undefined;
  if (input.node.type === "condition") {
    const branchEdge = outgoing.find((edge) => edge.branch === input.branch);
    const fallbackEdge = outgoing.find((edge) => !edge.branch);
    if (branchEdge) {
      targetId = branchEdge.target;
    } else if (input.branch === "true" && fallbackEdge) {
      targetId = fallbackEdge.target;
    } else if (
      input.branch === "false" &&
      conditionBranchValue(input.node.config?.falseBranch) === "continue" &&
      fallbackEdge
    ) {
      targetId = fallbackEdge.target;
    }
  } else {
    targetId = outgoing.find((edge) => !edge.branch)?.target;
  }

  if (!targetId && index >= 0 && input.node.type !== "condition") {
    targetId = input.graph.nodes[index + 1]?.id;
  }
  return targetId
    ? (input.graph.nodes.find((node) => node.id === targetId) ?? null)
    : null;
}

async function executeWait(
  node: AutomationNode,
  log: AutomationRunLogEntry[],
  sleep?: AutomationSleep,
) {
  const duration = waitDuration(node);
  log.push(
    logEntry(node, "waiting", `Esperando ${duration}.`, {
      duration,
      phase: "wait_started",
    }),
  );
  if (sleep) {
    await sleep({ duration, node });
  }
  log.push(
    logEntry(node, "ok", `Espera completada (${duration}).`, {
      duration,
      phase: "wait_finished",
    }),
  );
}

async function executeAction(
  ownerId: string,
  node: AutomationNode,
  ctx: EntityContext,
  run: RunRef,
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
  options: ExecuteAutomationRunOptions = {},
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

  let node = graph.nodes[0] ?? null;
  const visited = new Map<string, number>();
  let steps = 0;

  while (node && steps < 100) {
    steps += 1;
    visited.set(node.id, (visited.get(node.id) ?? 0) + 1);
    if ((visited.get(node.id) ?? 0) > 3) {
      failed += 1;
      log.push(
        logEntry(node, "failed", "Bucle detectado en el grafo.", {
          label: nodeLabel(node, graph.nodes.indexOf(node)),
        }),
      );
      break;
    }

    if (node.type === "wait") {
      await executeWait(node, log, options.sleep);
      node = nextNodeForBranch({ graph, node });
      continue;
    }

    if (node.type === "condition") {
      const result = await evaluateCondition({
        ctx,
        node,
        ownerId: run.ownerId,
        triggerEvent: run.triggerEvent,
      });
      log.push(
        logEntry(
          node,
          result.matched ? "ok" : "skipped",
          result.message,
          {
            branch: result.matched ? "true" : "false",
            field: clean(node.config?.field),
            value: result.value,
          },
        ),
      );
      node = nextNodeForBranch({
        branch: result.matched ? "true" : "false",
        graph,
        node,
      });
      continue;
    }

    if (node.type === "action") {
      try {
        const result = await executeAction(run.ownerId, node, ctx, runRef);
        log.push(
          logEntry(node, result.skipped ? "skipped" : "ok", result.message),
        );
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
      node = nextNodeForBranch({ graph, node });
      continue;
    }

    log.push(logEntry(node, "skipped", `Nodo no soportado: ${node.type}.`));
    node = nextNodeForBranch({ graph, node });
  }

  if (steps >= 100) {
    failed += 1;
    log.push({
      at: new Date().toISOString(),
      kind: "automation",
      message: "Ejecución detenida por superar 100 pasos.",
      nodeId: "runner",
      status: "failed",
    });
  }

  const status = failed > 0 ? "failed" : "completed";
  await db
    .update(automationRuns)
    .set({
      error: failed > 0 ? `${failed} paso(s) fallaron` : null,
      finishedAt: new Date(),
      log,
      status,
    })
    .where(eq(automationRuns.id, runId));

  return { executed, failed, status };
}
