/**
 * Captación / formularios web (Fase 7): formularios embebibles (`forms`), sus envíos
 * (`form_submissions`) y la bandeja de leads previa a negocio (`leads`). El formulario
 * define sus campos y el mapeo a persona/negocio; al recibir un envío se crea/encuentra
 * la persona, se guarda el envío y se genera un lead (y opcionalmente se dispara una
 * automatización). Esta migración (7.1) solo crea las tablas; el constructor (7.2), la
 * página pública (7.3), el endpoint (7.4) y la bandeja (7.5) se construyen encima.
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
import { deals, persons } from "./crm";
import { automations } from "./automations";

export type FormStatus = "draft" | "active" | "archived";

export type FormFieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "select"
  | "checkbox";

/** Campo de un formulario (definición editable en el constructor 7.2). */
export type FormFieldDef = {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

/** Mapeo de un campo del formulario a un campo de persona/negocio (7.2/7.4). */
export type FormMapping = {
  /** Clave del campo del formulario. */
  field: string;
  /** Destino, p. ej. "person.email", "person.firstName", "person.custom:foo". */
  target: string;
};

export type FormEmbedSettings = {
  submitLabel?: string;
  successMessage?: string;
  theme?: "light" | "dark" | "auto";
  /** Texto/encabezado opcional sobre el formulario. */
  intro?: string;
};

export type LeadStatus = "new" | "qualified" | "converted" | "junk";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// --- Formularios ------------------------------------------------------------
export const forms = pgTable(
  "forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").$type<FormStatus>().default("draft").notNull(),
    fields: jsonb("fields").$type<FormFieldDef[]>().default([]).notNull(),
    mappings: jsonb("mappings").$type<FormMapping[]>().default([]).notNull(),
    redirectUrl: text("redirect_url"),
    embedSettings: jsonb("embed_settings")
      .$type<FormEmbedSettings>()
      .default({})
      .notNull(),
    /** Automatización a disparar al recibir un envío (opcional). */
    automationId: uuid("automation_id").references(() => automations.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("forms_owner_idx").on(t.ownerId),
    index("forms_status_idx").on(t.status),
  ],
);

// --- Envíos de formulario ---------------------------------------------------
export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
    /** Persona creada/encontrada a partir del envío. */
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("form_submissions_owner_idx").on(t.ownerId),
    index("form_submissions_form_idx").on(t.formId),
    index("form_submissions_person_idx").on(t.personId),
    index("form_submissions_created_idx").on(t.createdAt),
  ],
);

// --- Leads (bandeja previa a negocio) ---------------------------------------
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    /** Envío de formulario que originó el lead (si aplica). */
    submissionId: uuid("submission_id").references(() => formSubmissions.id, {
      onDelete: "set null",
    }),
    /** Origen del lead (nombre del formulario, "import", "manual"…). */
    source: text("source"),
    status: text("status").$type<LeadStatus>().default("new").notNull(),
    /** Puntuación (lead scoring; lo rellena la IA en la Fase 8). */
    score: integer("score").default(0).notNull(),
    /** Negocio creado al convertir el lead. */
    convertedDealId: uuid("converted_deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("leads_owner_idx").on(t.ownerId),
    index("leads_status_idx").on(t.status),
    index("leads_person_idx").on(t.personId),
    index("leads_submission_idx").on(t.submissionId),
  ],
);

// --- Relaciones -------------------------------------------------------------
export const formsRelations = relations(forms, ({ one, many }) => ({
  owner: one(users, { fields: [forms.ownerId], references: [users.id] }),
  automation: one(automations, {
    fields: [forms.automationId],
    references: [automations.id],
  }),
  submissions: many(formSubmissions),
}));

export const formSubmissionsRelations = relations(
  formSubmissions,
  ({ one }) => ({
    owner: one(users, {
      fields: [formSubmissions.ownerId],
      references: [users.id],
    }),
    form: one(forms, {
      fields: [formSubmissions.formId],
      references: [forms.id],
    }),
    person: one(persons, {
      fields: [formSubmissions.personId],
      references: [persons.id],
    }),
  }),
);

export const leadsRelations = relations(leads, ({ one }) => ({
  owner: one(users, { fields: [leads.ownerId], references: [users.id] }),
  person: one(persons, {
    fields: [leads.personId],
    references: [persons.id],
  }),
  submission: one(formSubmissions, {
    fields: [leads.submissionId],
    references: [formSubmissions.id],
  }),
  convertedDeal: one(deals, {
    fields: [leads.convertedDealId],
    references: [deals.id],
  }),
}));
