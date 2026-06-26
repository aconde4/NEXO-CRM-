"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type AutomationInputValues,
  automationInputSchema,
} from "@/lib/validations/automation";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type AutomationGraph,
  type AutomationRunLogEntry,
  type AutomationStatus,
  type AutomationTrigger,
  type AutomationTriggerType,
  automationRuns,
  automations,
  deals,
  organizations,
  persons,
  sequences,
  stages,
} from "@/server/db/schema";
import { executeAutomationRun } from "@/server/services/automation-executor";

function revalidateAutomations(id?: string) {
  revalidatePath("/automations");
  if (id) revalidatePath(`/automations/${id}`);
}

async function assertOwned(ownerId: string, id: string) {
  const [row] = await db
    .select({ id: automations.id, version: automations.version })
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new Error("Automatización no encontrada");
  return row;
}

type DryRunEntityType = "person" | "organization" | "deal";

const pipelineAutomationTemplateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("stage_task"),
    stageId: z.string().uuid("Etapa no válida"),
    taskSubject: z.string().trim().max(160).optional(),
  }),
  z.object({
    kind: z.literal("stage_sequence"),
    sequenceId: z.string().uuid("Secuencia no válida"),
    stageId: z.string().uuid("Etapa no válida"),
  }),
]);

function asDryRunEntityType(value: unknown): DryRunEntityType | null {
  return value === "person" || value === "organization" || value === "deal"
    ? value
    : null;
}

function inferDryRunEntityType(
  trigger: AutomationTrigger | null,
): DryRunEntityType | null {
  if (!trigger) return null;
  if (trigger.type === "deal_stage_changed") return "deal";
  if (trigger.type === "email_opened" || trigger.type === "email_replied") {
    return "person";
  }
  if (
    trigger.type === "form_submitted" ||
    trigger.type === "sequence_enrolled"
  ) {
    return "person";
  }
  if (
    trigger.type === "record_created" ||
    trigger.type === "record_updated" ||
    trigger.type === "record_deleted" ||
    trigger.type === "field_changed"
  ) {
    return asDryRunEntityType(trigger.config?.entity) ?? "person";
  }
  return null;
}

async function findDryRunEntity(ownerId: string, entityType: DryRunEntityType) {
  if (entityType === "person") {
    const [row] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.ownerId, ownerId), isNull(persons.deletedAt)))
      .orderBy(desc(persons.updatedAt))
      .limit(1);
    return row ?? null;
  }
  if (entityType === "organization") {
    const [row] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(eq(organizations.ownerId, ownerId), isNull(organizations.deletedAt)),
      )
      .orderBy(desc(organizations.updatedAt))
      .limit(1);
    return row ?? null;
  }
  const [row] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.ownerId, ownerId), isNull(deals.deletedAt)))
    .orderBy(desc(deals.updatedAt))
    .limit(1);
  return row ?? null;
}

function dryRunTriggerEvent(input: {
  entityId: string | null;
  entityType: DryRunEntityType | null;
  ownerId: string;
  trigger: AutomationTrigger | null;
  triggerType: AutomationTriggerType | null;
}) {
  const payload: Record<string, unknown> = {};
  if (input.trigger?.type === "deal_stage_changed") {
    payload.toStageId = input.trigger.config?.stageId ?? null;
  }
  if (input.trigger?.type === "field_changed") {
    payload.field = input.trigger.config?.field ?? null;
  }

  return {
    dryRun: true,
    entityId: input.entityId,
    entityType: input.entityType,
    eventId: `dry-run-${randomUUID()}`,
    occurredAt: new Date().toISOString(),
    ownerId: input.ownerId,
    payload,
    type: input.triggerType ?? "dry_run",
  };
}

/** Crea una automatización en borrador y devuelve su id (para abrir el editor). */
export async function createAutomation(input: { name: string }) {
  const user = await requireUser();
  const name = input.name?.trim();
  if (!name) throw new Error("Ponle un nombre a la automatización");

  const [row] = await db
    .insert(automations)
    .values({ name: name.slice(0, 120), ownerId: user.id, status: "draft" })
    .returning({ id: automations.id });
  if (!row) throw new Error("No se pudo crear la automatización");
  revalidateAutomations(row.id);
  return row;
}

/** Crea una automatizacion completa como borrador revisable desde el builder. */
export async function createAutomationDraft(input: AutomationInputValues) {
  const user = await requireUser();
  const data = automationInputSchema.parse({ ...input, status: "draft" });
  const triggerType: AutomationTriggerType | null = data.trigger?.type ?? null;

  const [row] = await db
    .insert(automations)
    .values({
      description: data.description ?? null,
      graph: data.graph,
      name: data.name,
      ownerId: user.id,
      status: "draft",
      trigger: data.trigger ?? null,
      triggerType,
    })
    .returning({ id: automations.id });
  if (!row) throw new Error("No se pudo crear la automatizaciÃ³n");

  revalidateAutomations(row.id);
  return row;
}

export async function createPipelineAutomationTemplate(input: unknown) {
  const user = await requireUser();
  const data = pipelineAutomationTemplateSchema.parse(input);

  const [stage] = await db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(and(eq(stages.id, data.stageId), eq(stages.ownerId, user.id)))
    .limit(1);
  if (!stage) throw new Error("Etapa no encontrada");

  let name = `Al entrar en ${stage.name}: crear tarea`;
  let description = `Crea una tarea cuando un negocio entra en ${stage.name}.`;
  let node: AutomationGraph["nodes"][number] = {
    config: {
      subject:
        data.kind === "stage_task" && data.taskSubject?.trim()
          ? data.taskSubject.trim()
          : `Revisar ${stage.name}`,
    },
    id: "action-create-task",
    kind: "create_task",
    type: "action" as const,
  };

  if (data.kind === "stage_sequence") {
    const [sequence] = await db
      .select({ id: sequences.id, name: sequences.name })
      .from(sequences)
      .where(and(eq(sequences.id, data.sequenceId), eq(sequences.ownerId, user.id)))
      .limit(1);
    if (!sequence) throw new Error("Secuencia no encontrada");

    name = `Al entrar en ${stage.name}: inscribir en ${sequence.name}`;
    description = `Inscribe el contacto en ${sequence.name} cuando el negocio entra en ${stage.name}.`;
    node = {
      config: { sequenceId: sequence.id },
      id: "action-enroll-sequence",
      kind: "enroll_sequence",
      type: "action" as const,
    };
  }

  const [row] = await db
    .insert(automations)
    .values({
      description,
      graph: { edges: [], nodes: [node] },
      name: name.slice(0, 120),
      ownerId: user.id,
      status: "draft",
      trigger: {
        config: { stageId: stage.id },
        type: "deal_stage_changed",
      },
      triggerType: "deal_stage_changed",
    })
    .returning({ id: automations.id });
  if (!row) throw new Error("No se pudo crear la automatización");

  revalidateAutomations(row.id);
  return row;
}

export async function updateAutomation(
  id: string,
  input: AutomationInputValues,
) {
  const user = await requireUser();
  const existing = await assertOwned(user.id, id);
  const data = automationInputSchema.parse(input);

  // Activar requiere un disparador definido.
  if (data.status === "active" && !data.trigger) {
    throw new Error("Elige un disparador antes de activar la automatización.");
  }

  const triggerType: AutomationTriggerType | null = data.trigger?.type ?? null;

  await db
    .update(automations)
    .set({
      description: data.description ?? null,
      graph: data.graph,
      name: data.name,
      status: data.status,
      trigger: data.trigger ?? null,
      triggerType,
      version: existing.version + 1,
    })
    .where(and(eq(automations.id, id), eq(automations.ownerId, user.id)));

  revalidateAutomations(id);
}

/** Cambia solo el estado (activar/pausar) desde la lista. */
export async function setAutomationStatus(
  id: string,
  status: AutomationStatus,
) {
  const user = await requireUser();
  await assertOwned(user.id, id);

  if (status === "active") {
    const [row] = await db
      .select({ triggerType: automations.triggerType })
      .from(automations)
      .where(and(eq(automations.id, id), eq(automations.ownerId, user.id)))
      .limit(1);
    if (!row?.triggerType) {
      throw new Error(
        "Define un disparador en el editor antes de activar la automatización.",
      );
    }
  }

  await db
    .update(automations)
    .set({ status })
    .where(and(eq(automations.id, id), eq(automations.ownerId, user.id)));
  revalidateAutomations(id);
}

export async function dryRunAutomation(id: string) {
  const user = await requireUser();
  const [automation] = await db
    .select({
      graph: automations.graph,
      id: automations.id,
      name: automations.name,
      trigger: automations.trigger,
      triggerType: automations.triggerType,
      version: automations.version,
    })
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.ownerId, user.id)))
    .limit(1);
  if (!automation) throw new Error("Automatización no encontrada");

  const entityType = inferDryRunEntityType(automation.trigger);
  const sample = entityType
    ? await findDryRunEntity(user.id, entityType)
    : null;
  const entityId = sample?.id ?? null;
  const graph: AutomationGraph = automation.graph ?? { edges: [], nodes: [] };
  const now = new Date();
  const log: AutomationRunLogEntry[] = [
    {
      at: now.toISOString(),
      detail: { dryRun: true, entityId, entityType },
      kind: "dry_run",
      message:
        entityType && !entityId
          ? `Prueba en seco iniciada sin ${entityType} de muestra.`
          : "Prueba en seco iniciada.",
      nodeId: "trigger",
      status: "ok",
    },
  ];

  const [run] = await db
    .insert(automationRuns)
    .values({
      automationId: automation.id,
      automationVersion: automation.version,
      context: {
        automationName: automation.name,
        dryRun: true,
        graph,
        state: "dry_run",
      },
      entityId,
      entityType,
      log,
      ownerId: user.id,
      startedAt: now,
      status: "waiting",
      triggerEvent: dryRunTriggerEvent({
        entityId,
        entityType,
        ownerId: user.id,
        trigger: automation.trigger,
        triggerType: automation.triggerType,
      }),
      triggerType: automation.triggerType,
    })
    .returning({ id: automationRuns.id });
  if (!run) throw new Error("No se pudo preparar la prueba en seco");

  const result = await executeAutomationRun(run.id, { dryRun: true });
  revalidateAutomations(id);
  return {
    entityId,
    entityType,
    executed: result.executed ?? 0,
    failed: result.failed ?? 0,
    runId: run.id,
    status: result.status,
  };
}

export async function deleteAutomation(id: string) {
  const user = await requireUser();
  await db
    .delete(automations)
    .where(and(eq(automations.id, id), eq(automations.ownerId, user.id)));
  revalidateAutomations();
}
