import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  type AutomationRunLogEntry,
  type AutomationTriggerType,
  automationRuns,
} from "@/server/db/schema";
import { inngest } from "@/server/inngest/client";
import {
  type AutomationEntityType,
  type AutomationEvent,
  findActiveAutomationsForEvent,
} from "@/server/services/automation-events";

export const AUTOMATION_EVENT = "automation/event";

const AUTOMATION_TRIGGER_TYPES = new Set<AutomationTriggerType>([
  "record_created",
  "record_updated",
  "record_deleted",
  "deal_stage_changed",
  "field_changed",
  "email_opened",
  "email_replied",
  "form_submitted",
  "sequence_enrolled",
  "scheduled",
]);

const AUTOMATION_ENTITY_TYPES = new Set<AutomationEntityType>([
  "person",
  "organization",
  "deal",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AutomationEventPayload = AutomationEvent & {
  eventId: string;
  occurredAt: string;
};

export type AutomationFieldChange = {
  field: string;
  from: unknown;
  to: unknown;
};

type AutomationEventInput = AutomationEvent & {
  eventId?: string;
  occurredAt?: Date | string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDate(value: Date | string | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function nullableUuid(value: string | undefined): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

function normalizeJsonValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeJsonValue(entry)]),
    );
  }
  return value;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(normalizeJsonValue(left)) ===
    JSON.stringify(normalizeJsonValue(right))
  );
}

function eventToRecord(event: AutomationEventPayload): Record<string, unknown> {
  return {
    ...(event.entityId ? { entityId: event.entityId } : {}),
    ...(event.entityType ? { entityType: event.entityType } : {}),
    ...(event.payload ? { payload: event.payload } : {}),
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    ownerId: event.ownerId,
    type: event.type,
  };
}

export function createAutomationEvent(
  input: AutomationEventInput,
): AutomationEventPayload {
  return {
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.payload ? { payload: input.payload } : {}),
    eventId: input.eventId ?? randomUUID(),
    occurredAt: normalizeDate(input.occurredAt),
    ownerId: input.ownerId,
    type: input.type,
  };
}

export function diffAutomationFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): AutomationFieldChange[] {
  const changes: AutomationFieldChange[] = [];
  for (const field of fields) {
    const from = normalizeJsonValue(before[field]);
    const to = normalizeJsonValue(after[field]);
    if (jsonEqual(from, to)) continue;
    changes.push({ field, from, to });
  }
  return changes;
}

export function createFieldChangedEvents(input: {
  changes: AutomationFieldChange[];
  entityId: string;
  entityType: AutomationEntityType;
  occurredAt?: Date | string;
  ownerId: string;
}): AutomationEventPayload[] {
  return input.changes.map((change) =>
    createAutomationEvent({
      entityId: input.entityId,
      entityType: input.entityType,
      occurredAt: input.occurredAt,
      ownerId: input.ownerId,
      payload: change,
      type: "field_changed",
    }),
  );
}

export async function emitAutomationEvent(
  event: AutomationEventInput,
): Promise<AutomationEventPayload> {
  const payload = createAutomationEvent(event);
  await inngest.send({ data: payload, name: AUTOMATION_EVENT });
  return payload;
}

export async function emitAutomationEvents(
  events: AutomationEventInput[],
): Promise<AutomationEventPayload[]> {
  if (events.length === 0) return [];
  const payloads = events.map(createAutomationEvent);
  await inngest.send(
    payloads.map((payload) => ({ data: payload, name: AUTOMATION_EVENT })),
  );
  return payloads;
}

export async function emitAutomationEventSafely(
  event: AutomationEventInput | null | undefined,
): Promise<AutomationEventPayload | null> {
  if (!event) return null;
  try {
    return await emitAutomationEvent(event);
  } catch (error) {
    console.error("No se pudo emitir el evento de automatización", error);
    return null;
  }
}

export async function emitAutomationEventsSafely(
  events: AutomationEventInput[],
): Promise<AutomationEventPayload[]> {
  if (events.length === 0) return [];
  try {
    return await emitAutomationEvents(events);
  } catch (error) {
    console.error("No se pudieron emitir eventos de automatización", error);
    return [];
  }
}

export function parseAutomationEvent(
  data: unknown,
): AutomationEventPayload | null {
  if (!isRecord(data)) return null;

  const type = cleanString(data.type);
  const ownerId = cleanString(data.ownerId);
  if (!type || !AUTOMATION_TRIGGER_TYPES.has(type as AutomationTriggerType)) {
    return null;
  }
  if (!ownerId) return null;

  const entityType = cleanString(data.entityType);
  const entityId = cleanString(data.entityId);
  const payload = isRecord(data.payload) ? data.payload : undefined;
  const eventId = cleanString(data.eventId);
  const occurredAt = cleanString(data.occurredAt);

  if (
    entityType &&
    !AUTOMATION_ENTITY_TYPES.has(entityType as AutomationEntityType)
  ) {
    return null;
  }

  return createAutomationEvent({
    ...(entityId ? { entityId } : {}),
    ...(entityType ? { entityType: entityType as AutomationEntityType } : {}),
    ...(eventId ? { eventId } : {}),
    ...(payload ? { payload } : {}),
    occurredAt: occurredAt ?? undefined,
    ownerId,
    type: type as AutomationTriggerType,
  });
}

export async function dispatchAutomationEvent(event: AutomationEventInput) {
  const payload = createAutomationEvent(event);
  const matched = await findActiveAutomationsForEvent(payload);
  if (matched.length === 0) {
    return { matched: 0, runIds: [] as string[] };
  }

  const existing = await db
    .select({
      automationId: automationRuns.automationId,
      id: automationRuns.id,
    })
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.ownerId, payload.ownerId),
        eq(automationRuns.triggerType, payload.type),
        sql`${automationRuns.triggerEvent}->>'eventId' = ${payload.eventId}`,
      ),
    );
  const existingAutomationIds = new Set(
    existing.map((run) => run.automationId),
  );
  const pending = matched.filter(
    (automation) => !existingAutomationIds.has(automation.id),
  );
  if (pending.length === 0) {
    return {
      matched: matched.length,
      runIds: existing.map((run) => run.id),
      skipped: existing.length,
    };
  }

  const now = new Date();
  const runLog: AutomationRunLogEntry[] = [
    {
      at: now.toISOString(),
      detail: {
        phase: "6.4",
        reason: "automation_actions_pending_6_5",
      },
      kind: payload.type,
      message:
        "Disparador recibido; ejecución preparada para el motor de acciones.",
      nodeId: "trigger",
      status: "waiting",
    },
  ];
  const triggerEvent = eventToRecord(payload);

  const inserted = await db
    .insert(automationRuns)
    .values(
      pending.map((automation) => ({
        automationId: automation.id,
        automationVersion: automation.version,
        context: {
          automationName: automation.name,
          graph: automation.graph,
          state: "pending_actions",
        },
        entityId: nullableUuid(payload.entityId),
        entityType: payload.entityType ?? null,
        log: runLog,
        ownerId: payload.ownerId,
        startedAt: now,
        status: "waiting" as const,
        triggerEvent,
        triggerType: payload.type,
      })),
    )
    .returning({ id: automationRuns.id });

  return {
    matched: matched.length,
    runIds: [
      ...existing.map((run) => run.id),
      ...inserted.map((run) => run.id),
    ],
    skipped: existing.length,
  };
}
