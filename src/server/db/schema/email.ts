/**
 * Tablas de email (Fase 3): buzones conectados, hilos, mensajes, plantillas y
 * eventos. Los tokens OAuth siguen viviendo en Auth.js (`account`); aquí guardamos
 * metadatos operativos, sincronización y tracking.
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

export type EmailProvider = "gmail" | "resend";
export type MailboxStatus = "active" | "needs_reauth" | "paused" | "error";
export type EmailThreadStatus = "active" | "archived" | "trash" | "spam";
export type EmailDirection = "inbound" | "outbound";
/** Sentimiento de un email entrante clasificado por IA (8.7). */
export type EmailSentiment = "positive" | "neutral" | "negative";
export type EmailMessageStatus =
  | "draft"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "received"
  | "bounced";
export type EmailEventType =
  | "delivery_delayed"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "open"
  | "click"
  | "bounce"
  | "complaint"
  | "suppressed"
  | "unsubscribe"
  | "reply"
  | "sync";

export type EmailAddress = {
  email: string;
  name?: string | null;
};

export type EmailAttachmentMeta = {
  attachmentId?: string;
  contentId?: string;
  filename: string;
  inline?: boolean;
  mimeType?: string | null;
  size?: number | null;
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

export const mailboxes = pgTable(
  "mailboxes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider")
      .$type<EmailProvider>()
      .default("gmail")
      .notNull(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    displayName: text("display_name"),
    fromName: text("from_name"),
    status: text("status").$type<MailboxStatus>().default("active").notNull(),
    accountProvider: text("account_provider").default("google").notNull(),
    accountProviderAccountId: text("account_provider_account_id"),
    gmailHistoryId: text("gmail_history_id"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncStartedAt: timestamp("last_sync_started_at", {
      withTimezone: true,
    }),
    lastSyncError: text("last_sync_error"),
    dailyLimit: integer("daily_limit").default(50).notNull(),
    sentToday: integer("sent_today").default(0).notNull(),
    sentTodayResetAt: timestamp("sent_today_reset_at", { withTimezone: true }),
    signatureHtml: text("signature_html"),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (t) => [
    index("mailboxes_owner_idx").on(t.ownerId),
    index("mailboxes_provider_idx").on(t.provider),
    index("mailboxes_status_idx").on(t.status),
    index("mailboxes_account_idx").on(
      t.accountProvider,
      t.accountProviderAccountId,
    ),
    uniqueIndex("mailboxes_owner_provider_email_unique").on(
      t.ownerId,
      t.provider,
      t.emailNormalized,
    ),
  ],
);

export const emailThreads = pgTable(
  "email_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mailboxId: uuid("mailbox_id")
      .notNull()
      .references(() => mailboxes.id, { onDelete: "cascade" }),
    providerThreadId: text("provider_thread_id").notNull(),
    subject: text("subject"),
    snippet: text("snippet"),
    status: text("status")
      .$type<EmailThreadStatus>()
      .default("active")
      .notNull(),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    dealId: uuid("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
    messageCount: integer("message_count").default(0).notNull(),
    unread: boolean("unread").default(false).notNull(),
    providerLabels: jsonb("provider_labels")
      .$type<string[]>()
      .default([])
      .notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("email_threads_owner_idx").on(t.ownerId),
    index("email_threads_mailbox_idx").on(t.mailboxId),
    index("email_threads_person_idx").on(t.personId),
    index("email_threads_org_idx").on(t.orgId),
    index("email_threads_deal_idx").on(t.dealId),
    index("email_threads_last_message_idx").on(t.lastMessageAt),
    uniqueIndex("email_threads_mailbox_provider_unique").on(
      t.mailboxId,
      t.providerThreadId,
    ),
  ],
);

export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mailboxId: uuid("mailbox_id")
      .notNull()
      .references(() => mailboxes.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => emailThreads.id, { onDelete: "cascade" }),
    provider: text("provider")
      .$type<EmailProvider>()
      .default("gmail")
      .notNull(),
    providerMessageId: text("provider_message_id").notNull(),
    providerThreadId: text("provider_thread_id").notNull(),
    rfcMessageId: text("rfc_message_id"),
    inReplyTo: text("in_reply_to"),
    referencesHeader: text("references_header"),
    direction: text("direction").$type<EmailDirection>().notNull(),
    status: text("status").$type<EmailMessageStatus>().notNull(),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name"),
    toRecipients: jsonb("to_recipients")
      .$type<EmailAddress[]>()
      .default([])
      .notNull(),
    ccRecipients: jsonb("cc_recipients")
      .$type<EmailAddress[]>()
      .default([])
      .notNull(),
    bccRecipients: jsonb("bcc_recipients")
      .$type<EmailAddress[]>()
      .default([])
      .notNull(),
    replyToRecipients: jsonb("reply_to_recipients")
      .$type<EmailAddress[]>()
      .default([])
      .notNull(),
    subject: text("subject"),
    snippet: text("snippet"),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    attachments: jsonb("attachments")
      .$type<EmailAttachmentMeta[]>()
      .default([])
      .notNull(),
    headers: jsonb("headers").$type<Record<string, string | string[]>>(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    trackingId: text("tracking_id"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    openCount: integer("open_count").default(0).notNull(),
    clickCount: integer("click_count").default(0).notNull(),
    /** Sentimiento del email entrante clasificado por IA (8.7). */
    sentiment: text("sentiment").$type<EmailSentiment>(),
    sentimentAt: timestamp("sentiment_at", { withTimezone: true }),
    error: text("error"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (t) => [
    index("email_messages_owner_idx").on(t.ownerId),
    index("email_messages_mailbox_idx").on(t.mailboxId),
    index("email_messages_thread_idx").on(t.threadId),
    index("email_messages_direction_idx").on(t.direction),
    index("email_messages_status_idx").on(t.status),
    index("email_messages_from_idx").on(t.fromEmail),
    index("email_messages_sent_idx").on(t.sentAt),
    index("email_messages_received_idx").on(t.receivedAt),
    uniqueIndex("email_messages_mailbox_provider_unique").on(
      t.mailboxId,
      t.providerMessageId,
    ),
    uniqueIndex("email_messages_tracking_unique").on(t.trackingId),
  ],
);

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category"),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text"),
    variables: jsonb("variables").$type<string[]>().default([]).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("email_templates_owner_idx").on(t.ownerId),
    index("email_templates_category_idx").on(t.category),
    uniqueIndex("email_templates_owner_name_unique").on(t.ownerId, t.name),
  ],
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mailboxId: uuid("mailbox_id").references(() => mailboxes.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => emailMessages.id, {
      onDelete: "cascade",
    }),
    provider: text("provider")
      .$type<EmailProvider>()
      .default("gmail")
      .notNull(),
    providerEventId: text("provider_event_id"),
    type: text("type").$type<EmailEventType>().notNull(),
    recipientEmail: text("recipient_email"),
    trackingId: text("tracking_id"),
    url: text("url"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("email_events_owner_idx").on(t.ownerId),
    index("email_events_mailbox_idx").on(t.mailboxId),
    index("email_events_message_idx").on(t.messageId),
    index("email_events_type_idx").on(t.type),
    index("email_events_occurred_idx").on(t.occurredAt),
    index("email_events_tracking_idx").on(t.trackingId),
    uniqueIndex("email_events_provider_unique").on(
      t.provider,
      t.providerEventId,
    ),
  ],
);

export const mailboxesRelations = relations(mailboxes, ({ one, many }) => ({
  owner: one(users, { fields: [mailboxes.ownerId], references: [users.id] }),
  threads: many(emailThreads),
  messages: many(emailMessages),
  events: many(emailEvents),
}));

export const emailThreadsRelations = relations(
  emailThreads,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [emailThreads.ownerId],
      references: [users.id],
    }),
    mailbox: one(mailboxes, {
      fields: [emailThreads.mailboxId],
      references: [mailboxes.id],
    }),
    person: one(persons, {
      fields: [emailThreads.personId],
      references: [persons.id],
    }),
    organization: one(organizations, {
      fields: [emailThreads.orgId],
      references: [organizations.id],
    }),
    deal: one(deals, { fields: [emailThreads.dealId], references: [deals.id] }),
    messages: many(emailMessages),
  }),
);

export const emailMessagesRelations = relations(
  emailMessages,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [emailMessages.ownerId],
      references: [users.id],
    }),
    mailbox: one(mailboxes, {
      fields: [emailMessages.mailboxId],
      references: [mailboxes.id],
    }),
    thread: one(emailThreads, {
      fields: [emailMessages.threadId],
      references: [emailThreads.id],
    }),
    events: many(emailEvents),
  }),
);

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  owner: one(users, {
    fields: [emailTemplates.ownerId],
    references: [users.id],
  }),
}));

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  owner: one(users, { fields: [emailEvents.ownerId], references: [users.id] }),
  mailbox: one(mailboxes, {
    fields: [emailEvents.mailboxId],
    references: [mailboxes.id],
  }),
  message: one(emailMessages, {
    fields: [emailEvents.messageId],
    references: [emailMessages.id],
  }),
}));
