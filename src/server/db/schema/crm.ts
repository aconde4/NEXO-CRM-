/**
 * Tablas del CRM (Fase 1): empresas, contactos, etiquetas, actividades, notas y
 * registro de actividad. Con índices en claves foráneas y columnas de búsqueda
 * para mantener los listados fluidos al crecer los datos.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  ContactFilterCondition,
} from "@/lib/contact-filters";
import type {
  CustomEntityType,
  CustomFieldType,
} from "@/lib/custom-fields";
import { users } from "./auth";

// Tipos reutilizables (validados además con Zod en la capa de datos).
export type MarketingStatus =
  | "subscribed"
  | "unsubscribed"
  | "bounced"
  | "complained";
export type ActivityType =
  | "task"
  | "call"
  | "meeting"
  | "email"
  | "deadline"
  | "lunch";
export type DealStatus = "open" | "won" | "lost";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// --- Empresas ---------------------------------------------------------------
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    tradeName: text("trade_name"),
    domain: text("domain"),
    website: text("website"),
    phone: text("phone"),
    address: text("address"),
    industry: text("industry"),
    size: text("size"),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    customFields: jsonb("custom_fields")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("organizations_owner_idx").on(t.ownerId),
    index("organizations_name_idx").on(t.name),
    index("organizations_domain_idx").on(t.domain),
    index("organizations_created_idx").on(t.createdAt),
  ],
);

// --- Contactos --------------------------------------------------------------
export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    title: text("title"),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    source: text("source"),
    campaign: text("campaign"),
    marketingStatus: text("marketing_status")
      .$type<MarketingStatus>()
      .default("subscribed")
      .notNull(),
    customFields: jsonb("custom_fields")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("persons_owner_idx").on(t.ownerId),
    index("persons_org_idx").on(t.orgId),
    index("persons_email_idx").on(t.email),
    index("persons_last_name_idx").on(t.lastName),
    index("persons_campaign_idx").on(t.ownerId, t.campaign),
    index("persons_created_idx").on(t.createdAt),
  ],
);

// --- Etiquetas --------------------------------------------------------------
export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6366f1"),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("labels_owner_idx").on(t.ownerId)],
);

export const entityLabels = pgTable(
  "entity_labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
    entityType: text("entity_type")
      .$type<"person" | "organization" | "deal">()
      .notNull(),
    entityId: uuid("entity_id").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("entity_labels_entity_idx").on(t.entityType, t.entityId),
    index("entity_labels_label_idx").on(t.labelId),
  ],
);

// --- Actividades / tareas ---------------------------------------------------
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").$type<ActivityType>().default("task").notNull(),
    subject: text("subject").notNull(),
    notes: text("notes"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    done: boolean("done").default(false).notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "cascade",
    }),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    dealId: uuid("deal_id").references(() => deals.id, {
      onDelete: "cascade",
    }),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("activities_owner_idx").on(t.ownerId),
    index("activities_person_idx").on(t.personId),
    index("activities_org_idx").on(t.orgId),
    index("activities_deal_idx").on(t.dealId),
    index("activities_due_idx").on(t.dueAt),
    index("activities_done_idx").on(t.done),
  ],
);

// --- Notas ------------------------------------------------------------------
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    body: text("body").notNull(),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "cascade",
    }),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    dealId: uuid("deal_id").references(() => deals.id, {
      onDelete: "cascade",
    }),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("notes_person_idx").on(t.personId),
    index("notes_org_idx").on(t.orgId),
    index("notes_deal_idx").on(t.dealId),
    index("notes_owner_idx").on(t.ownerId),
  ],
);

// --- Registro de actividad (timeline / auditoría) ---------------------------
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    verb: text("verb").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("activity_log_entity_idx").on(t.entityType, t.entityId),
    index("activity_log_created_idx").on(t.createdAt),
  ],
);

// --- Pipeline / Negocios (Fase 2) -------------------------------------------
export const pipelines = pgTable(
  "pipelines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    position: integer("position").default(0).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    ...timestamps,
  },
  (t) => [index("pipelines_owner_idx").on(t.ownerId)],
);

export const stages = pgTable(
  "stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").default(0).notNull(),
    /** Probabilidad de cierre (0-100) para la previsión ponderada. */
    probability: integer("probability").default(0).notNull(),
    /** Días sin avanzar para marcar el negocio como "estancado" (null = nunca). */
    rottingDays: integer("rotting_days"),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    ...timestamps,
  },
  (t) => [index("stages_pipeline_idx").on(t.pipelineId)],
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    value: doublePrecision("value").default(0).notNull(),
    currency: text("currency").default("EUR").notNull(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "restrict" }),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status").$type<DealStatus>().default("open").notNull(),
    /** Orden manual dentro de una columna (permite reordenar al arrastrar). */
    position: doublePrecision("position").default(0).notNull(),
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
    wonAt: timestamp("won_at", { withTimezone: true }),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    customFields: jsonb("custom_fields")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("deals_owner_idx").on(t.ownerId),
    index("deals_pipeline_idx").on(t.pipelineId),
    index("deals_stage_idx").on(t.stageId),
    index("deals_status_idx").on(t.status),
    index("deals_person_idx").on(t.personId),
    index("deals_org_idx").on(t.orgId),
  ],
);

export const dealContacts = pgTable(
  "deal_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    role: text("role"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("deal_contacts_deal_idx").on(t.dealId),
    uniqueIndex("deal_contacts_unique").on(t.dealId, t.personId),
  ],
);

// --- Campos personalizados (definiciones) -----------------------------------
export const customFieldDefs = pgTable(
  "custom_field_defs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").$type<CustomEntityType>().notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: text("type").$type<CustomFieldType>().default("text").notNull(),
    options: jsonb("options").$type<string[]>().default([]).notNull(),
    required: boolean("required").default(false).notNull(),
    position: integer("position").default(0).notNull(),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    ...timestamps,
  },
  (t) => [
    index("custom_field_defs_owner_idx").on(t.ownerId),
    index("custom_field_defs_entity_idx").on(t.entityType),
    uniqueIndex("custom_field_defs_key_unique").on(
      t.ownerId,
      t.entityType,
      t.key,
    ),
  ],
);

// --- Vistas guardadas (saved views) -----------------------------------------
export type SavedViewFilters = {
  conditions?: ContactFilterCondition[];
  q?: string;
  label?: string;
  sort?: string;
};

export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    entityType: text("entity_type").$type<CustomEntityType>().notNull(),
    filters: jsonb("filters")
      .$type<SavedViewFilters>()
      .default({})
      .notNull(),
    position: integer("position").default(0).notNull(),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    ...timestamps,
  },
  (t) => [
    index("saved_views_owner_idx").on(t.ownerId),
    index("saved_views_entity_idx").on(t.entityType),
  ],
);

// --- Adjuntos (Supabase Storage) --------------------------------------------
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    path: text("path").notNull(),
    size: integer("size").default(0).notNull(),
    mime: text("mime"),
    entityType: text("entity_type").$type<CustomEntityType>().notNull(),
    entityId: uuid("entity_id").notNull(),
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("files_entity_idx").on(t.entityType, t.entityId),
    index("files_owner_idx").on(t.ownerId),
  ],
);

// --- Relaciones (para consultas con `with`) ---------------------------------
export const organizationsRelations = relations(organizations, ({ many }) => ({
  persons: many(persons),
  activities: many(activities),
  notes: many(notes),
}));

export const personsRelations = relations(persons, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [persons.orgId],
    references: [organizations.id],
  }),
  activities: many(activities),
  notes: many(notes),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  person: one(persons, {
    fields: [activities.personId],
    references: [persons.id],
  }),
  organization: one(organizations, {
    fields: [activities.orgId],
    references: [organizations.id],
  }),
  deal: one(deals, {
    fields: [activities.dealId],
    references: [deals.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  person: one(persons, { fields: [notes.personId], references: [persons.id] }),
  organization: one(organizations, {
    fields: [notes.orgId],
    references: [organizations.id],
  }),
  deal: one(deals, { fields: [notes.dealId], references: [deals.id] }),
}));

export const pipelinesRelations = relations(pipelines, ({ many }) => ({
  stages: many(stages),
  deals: many(deals),
}));

export const stagesRelations = relations(stages, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [stages.pipelineId],
    references: [pipelines.id],
  }),
  deals: many(deals),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  stage: one(stages, { fields: [deals.stageId], references: [stages.id] }),
  person: one(persons, { fields: [deals.personId], references: [persons.id] }),
  organization: one(organizations, {
    fields: [deals.orgId],
    references: [organizations.id],
  }),
  contacts: many(dealContacts),
  activities: many(activities),
  notes: many(notes),
}));

export const dealContactsRelations = relations(dealContacts, ({ one }) => ({
  deal: one(deals, { fields: [dealContacts.dealId], references: [deals.id] }),
  person: one(persons, {
    fields: [dealContacts.personId],
    references: [persons.id],
  }),
}));
