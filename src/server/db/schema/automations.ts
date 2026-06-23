/**
 * Motor de automatizaciones (Fase 6): definición de flujos (disparador → condiciones →
 * esperas → acciones) como un grafo de nodos, y el registro de cada ejecución. La
 * orquestación duradera se hará con Inngest (como campañas y secuencias); aquí vive la
 * definición y la observabilidad. Esta migración (6.1) solo crea las tablas; el canvas
 * (6.2), los disparadores (6.3) y las acciones (6.5) se construyen encima.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export type AutomationStatus = "draft" | "active" | "paused" | "archived";

export type AutomationRunStatus =
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export type AutomationTriggerType =
  | "record_created"
  | "record_updated"
  | "record_deleted"
  | "deal_stage_changed"
  | "field_changed"
  | "email_opened"
  | "email_replied"
  | "form_submitted"
  | "sequence_enrolled"
  | "scheduled";

export type AutomationNodeType = "trigger" | "condition" | "wait" | "action";

export type AutomationTrigger = {
  type: AutomationTriggerType;
  config?: Record<string, unknown>;
};

export type AutomationNode = {
  id: string;
  type: AutomationNodeType;
  /** Subtipo concreto (p. ej. acción "send_email" o disparador "deal_stage_changed"). */
  kind?: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
};

export type AutomationEdge = {
  id: string;
  source: string;
  target: string;
  /** Rama de salida para condiciones if/else. */
  branch?: "true" | "false" | null;
};

export type AutomationGraph = {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
};

export type AutomationRunLogEntry = {
  nodeId: string;
  kind: string;
  status: "ok" | "skipped" | "waiting" | "failed";
  at: string;
  message?: string;
  detail?: Record<string, unknown>;
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// --- Automatizaciones -------------------------------------------------------
export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status")
      .$type<AutomationStatus>()
      .default("draft")
      .notNull(),
    /** Tipo de disparador denormalizado para localizar automatizaciones por evento. */
    triggerType: text("trigger_type").$type<AutomationTriggerType>(),
    trigger: jsonb("trigger").$type<AutomationTrigger>(),
    graph: jsonb("graph")
      .$type<AutomationGraph>()
      .default({ edges: [], nodes: [] })
      .notNull(),
    version: integer("version").default(1).notNull(),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (t) => [
    index("automations_owner_idx").on(t.ownerId),
    index("automations_status_idx").on(t.status),
    index("automations_trigger_type_idx").on(t.triggerType),
  ],
);

// --- Ejecuciones ------------------------------------------------------------
export const automationRuns = pgTable(
  "automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    /** Versión del grafo que se ejecutó (para auditar tras editar la automatización). */
    automationVersion: integer("automation_version").default(1).notNull(),
    status: text("status")
      .$type<AutomationRunStatus>()
      .default("running")
      .notNull(),
    triggerType: text("trigger_type").$type<AutomationTriggerType>(),
    /** Registro que disparó la ejecución (persona/empresa/negocio…). */
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    triggerEvent: jsonb("trigger_event")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    context: jsonb("context")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    log: jsonb("log")
      .$type<AutomationRunLogEntry[]>()
      .default([])
      .notNull(),
    error: text("error"),
    inngestRunId: text("inngest_run_id"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("automation_runs_owner_idx").on(t.ownerId),
    index("automation_runs_automation_idx").on(t.automationId),
    index("automation_runs_status_idx").on(t.status),
    index("automation_runs_entity_idx").on(t.entityType, t.entityId),
    index("automation_runs_trigger_type_idx").on(t.triggerType),
    index("automation_runs_started_idx").on(t.startedAt),
  ],
);

// --- Relaciones -------------------------------------------------------------
export const automationsRelations = relations(automations, ({ one, many }) => ({
  owner: one(users, { fields: [automations.ownerId], references: [users.id] }),
  runs: many(automationRuns),
}));

export const automationRunsRelations = relations(automationRuns, ({ one }) => ({
  owner: one(users, {
    fields: [automationRuns.ownerId],
    references: [users.id],
  }),
  automation: one(automations, {
    fields: [automationRuns.automationId],
    references: [automations.id],
  }),
}));
