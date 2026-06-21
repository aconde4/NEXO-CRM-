/**
 * Secuencias / drip (Fase 5): definicion de flujos multi-paso, pasos y
 * contactos inscritos. La ejecucion duradera se orquestara con Inngest, pero el
 * estado operativo vive aqui para poder auditar, pausar y retomar cada contacto.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { deals, organizations, persons } from "./crm";
import { emailMessages, emailTemplates } from "./email";

export type SequenceStatus = "draft" | "active" | "paused" | "archived";
export type SequenceChannel = "gmail_1to1" | "resend";
export type SequenceStepType = "email" | "wait" | "condition" | "task";
export type SequenceEnrollmentStatus =
  | "active"
  | "paused"
  | "completed"
  | "stopped"
  | "bounced"
  | "replied"
  | "unsubscribed"
  | "failed";

export type SequenceSettings = {
  stopOnBounce?: boolean;
  stopOnUnsubscribe?: boolean;
  maxRetries?: number;
  [key: string]: unknown;
};

export type SequenceStepCondition = {
  kind?: "opened" | "clicked" | "replied" | "not_replied" | "field" | "segment";
  operator?: string;
  value?: unknown;
  [key: string]: unknown;
};

export type SequenceStepVariant = {
  id: string;
  name?: string;
  weight?: number;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  templateId?: string | null;
};

export type SequenceEnrollmentContext = {
  variantAssignments?: Record<string, string>;
  counters?: Record<string, number>;
  [key: string]: unknown;
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

// --- Secuencias -------------------------------------------------------------
export const sequences = pgTable(
  "sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").$type<SequenceStatus>().default("draft").notNull(),
    channel: text("channel")
      .$type<SequenceChannel>()
      .default("gmail_1to1")
      .notNull(),
    stopOnReply: boolean("stop_on_reply").default(true).notNull(),
    dailyLimit: integer("daily_limit").default(50).notNull(),
    windowStart: text("window_start").default("09:00").notNull(),
    windowEnd: text("window_end").default("18:00").notNull(),
    timeZone: text("time_zone").default("Europe/Madrid").notNull(),
    settings: jsonb("settings").$type<SequenceSettings>().default({}).notNull(),
    ...timestamps,
  },
  (t) => [
    index("sequences_owner_idx").on(t.ownerId),
    index("sequences_status_idx").on(t.status),
    index("sequences_channel_idx").on(t.channel),
    uniqueIndex("sequences_owner_name_unique").on(t.ownerId, t.name),
  ],
);

// --- Pasos ------------------------------------------------------------------
export const sequenceSteps = pgTable(
  "sequence_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => sequences.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    type: text("type").$type<SequenceStepType>().notNull(),
    name: text("name"),
    channel: text("channel").$type<SequenceChannel>(),
    waitDays: integer("wait_days").default(0).notNull(),
    waitHours: integer("wait_hours").default(0).notNull(),
    templateId: uuid("template_id").references(() => emailTemplates.id, {
      onDelete: "set null",
    }),
    subject: text("subject"),
    preheader: text("preheader"),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    condition: jsonb("condition")
      .$type<SequenceStepCondition>()
      .default({})
      .notNull(),
    variants: jsonb("variants")
      .$type<SequenceStepVariant[]>()
      .default([])
      .notNull(),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (t) => [
    index("sequence_steps_owner_idx").on(t.ownerId),
    index("sequence_steps_sequence_idx").on(t.sequenceId),
    index("sequence_steps_type_idx").on(t.type),
    uniqueIndex("sequence_steps_sequence_position_unique").on(
      t.sequenceId,
      t.position,
    ),
  ],
);

// --- Inscripciones ----------------------------------------------------------
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => sequences.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    dealId: uuid("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    currentStepId: uuid("current_step_id").references(() => sequenceSteps.id, {
      onDelete: "set null",
    }),
    currentStepPosition: integer("current_step_position").default(0).notNull(),
    status: text("status")
      .$type<SequenceEnrollmentStatus>()
      .default("active")
      .notNull(),
    stopReason: text("stop_reason"),
    inngestRunId: text("inngest_run_id"),
    lastMessageId: uuid("last_message_id").references(() => emailMessages.id, {
      onDelete: "set null",
    }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    lastError: text("last_error"),
    retryCount: integer("retry_count").default(0).notNull(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    context: jsonb("context")
      .$type<SequenceEnrollmentContext>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (t) => [
    index("enrollments_owner_idx").on(t.ownerId),
    index("enrollments_sequence_idx").on(t.sequenceId),
    index("enrollments_person_idx").on(t.personId),
    index("enrollments_org_idx").on(t.orgId),
    index("enrollments_deal_idx").on(t.dealId),
    index("enrollments_current_step_idx").on(t.currentStepId),
    index("enrollments_status_idx").on(t.status),
    index("enrollments_next_run_idx").on(t.nextRunAt),
    index("enrollments_inngest_run_idx").on(t.inngestRunId),
    uniqueIndex("enrollments_sequence_person_unique").on(
      t.sequenceId,
      t.personId,
    ),
  ],
);

// --- Relaciones -------------------------------------------------------------
export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  owner: one(users, { fields: [sequences.ownerId], references: [users.id] }),
  steps: many(sequenceSteps),
  enrollments: many(enrollments),
}));

export const sequenceStepsRelations = relations(
  sequenceSteps,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [sequenceSteps.ownerId],
      references: [users.id],
    }),
    sequence: one(sequences, {
      fields: [sequenceSteps.sequenceId],
      references: [sequences.id],
    }),
    template: one(emailTemplates, {
      fields: [sequenceSteps.templateId],
      references: [emailTemplates.id],
    }),
    enrollments: many(enrollments),
  }),
);

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  owner: one(users, { fields: [enrollments.ownerId], references: [users.id] }),
  sequence: one(sequences, {
    fields: [enrollments.sequenceId],
    references: [sequences.id],
  }),
  person: one(persons, {
    fields: [enrollments.personId],
    references: [persons.id],
  }),
  organization: one(organizations, {
    fields: [enrollments.orgId],
    references: [organizations.id],
  }),
  deal: one(deals, { fields: [enrollments.dealId], references: [deals.id] }),
  currentStep: one(sequenceSteps, {
    fields: [enrollments.currentStepId],
    references: [sequenceSteps.id],
  }),
  lastMessage: one(emailMessages, {
    fields: [enrollments.lastMessageId],
    references: [emailMessages.id],
  }),
}));
