/**
 * Tablas de campañas masivas (Fase 4): audiencias (`segments`), campañas
 * (`campaigns`), destinatarios por campaña (`campaign_recipients`) y la lista de
 * supresión RGPD (`suppressions`). El envío real lo hace Resend; aquí guardamos la
 * definición, el estado y las métricas. Reutiliza el motor de merge tags y el modelo
 * de email de la Fase 3.
 */
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { persons } from "./crm";
import { emailTemplates } from "./email";

export type SegmentKind = "dynamic" | "static";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "failed";
export type CampaignProvider = "resend";
export type CampaignRecipientStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "suppressed"
  | "failed";
export type SuppressionReason =
  | "unsubscribe"
  | "bounce"
  | "complaint"
  | "manual";

/**
 * Definición de un segmento: conjunto de reglas sobre contactos. Se concreta en la
 * 4.4 reutilizando el motor de filtros de la Fase 1. `static` congela una lista de
 * ids; `dynamic` se recalcula al usarse.
 */
export type SegmentRule = {
  field: string;
  op: string;
  value?: unknown;
};

export type SegmentDefinition = {
  match?: "all" | "any";
  rules?: SegmentRule[];
  /** Para segmentos estáticos: ids de contacto congelados. */
  personIds?: string[];
};

/** Contadores agregados de una campaña (se actualizan con los webhooks de Resend). */
export type CampaignStats = {
  audience?: number;
  sent?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  bounced?: number;
  complained?: number;
  unsubscribed?: number;
  failed?: number;
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

// --- Audiencias -------------------------------------------------------------
export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    kind: text("kind").$type<SegmentKind>().default("dynamic").notNull(),
    definition: jsonb("definition")
      .$type<SegmentDefinition>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (t) => [
    index("segments_owner_idx").on(t.ownerId),
    uniqueIndex("segments_owner_name_unique").on(t.ownerId, t.name),
  ],
);

// --- Campañas ---------------------------------------------------------------
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    preheader: text("preheader"),
    fromName: text("from_name"),
    fromEmail: text("from_email"),
    replyTo: text("reply_to"),
    provider: text("provider")
      .$type<CampaignProvider>()
      .default("resend")
      .notNull(),
    status: text("status").$type<CampaignStatus>().default("draft").notNull(),
    templateId: uuid("template_id").references(() => emailTemplates.id, {
      onDelete: "set null",
    }),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    segmentId: uuid("segment_id").references(() => segments.id, {
      onDelete: "set null",
    }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    stats: jsonb("stats").$type<CampaignStats>().default({}).notNull(),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (t) => [
    index("campaigns_owner_idx").on(t.ownerId),
    index("campaigns_status_idx").on(t.status),
    index("campaigns_segment_idx").on(t.segmentId),
    index("campaigns_scheduled_idx").on(t.scheduledAt),
  ],
);

// --- Destinatarios por campaña ----------------------------------------------
export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    name: text("name"),
    status: text("status")
      .$type<CampaignRecipientStatus>()
      .default("pending")
      .notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("campaign_recipients_owner_idx").on(t.ownerId),
    index("campaign_recipients_campaign_idx").on(t.campaignId),
    index("campaign_recipients_person_idx").on(t.personId),
    index("campaign_recipients_status_idx").on(t.status),
    index("campaign_recipients_email_idx").on(t.emailNormalized),
    uniqueIndex("campaign_recipients_campaign_email_unique").on(
      t.campaignId,
      t.emailNormalized,
    ),
  ],
);

// --- Lista de supresión global (RGPD) ---------------------------------------
export const suppressions = pgTable(
  "suppressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    reason: text("reason")
      .$type<SuppressionReason>()
      .default("manual")
      .notNull(),
    /** Origen del apunte: id de campaña, "webhook", "manual"… (auditoría). */
    source: text("source"),
    note: text("note"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("suppressions_owner_idx").on(t.ownerId),
    index("suppressions_email_idx").on(t.emailNormalized),
    uniqueIndex("suppressions_owner_email_unique").on(
      t.ownerId,
      t.emailNormalized,
    ),
  ],
);

// --- Relaciones -------------------------------------------------------------
export const segmentsRelations = relations(segments, ({ one, many }) => ({
  owner: one(users, { fields: [segments.ownerId], references: [users.id] }),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  owner: one(users, { fields: [campaigns.ownerId], references: [users.id] }),
  segment: one(segments, {
    fields: [campaigns.segmentId],
    references: [segments.id],
  }),
  template: one(emailTemplates, {
    fields: [campaigns.templateId],
    references: [emailTemplates.id],
  }),
  recipients: many(campaignRecipients),
}));

export const campaignRecipientsRelations = relations(
  campaignRecipients,
  ({ one }) => ({
    owner: one(users, {
      fields: [campaignRecipients.ownerId],
      references: [users.id],
    }),
    campaign: one(campaigns, {
      fields: [campaignRecipients.campaignId],
      references: [campaigns.id],
    }),
    person: one(persons, {
      fields: [campaignRecipients.personId],
      references: [persons.id],
    }),
  }),
);

export const suppressionsRelations = relations(suppressions, ({ one }) => ({
  owner: one(users, { fields: [suppressions.ownerId], references: [users.id] }),
}));
