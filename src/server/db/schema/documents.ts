/**
 * Documentos y firma electrónica simple (Fase 10.1). Cada documento se redacta, se
 * "envía" (recibe un token público) y el firmante lo firma escribiendo su nombre en
 * `/sign/[token]`. Firma de tipo "type-to-sign" (no criptográfica), suficiente para un
 * CRM personal; queda registrado quién firmó y cuándo.
 */
import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { deals, persons } from "./crm";

export type DocumentStatus = "draft" | "sent" | "signed";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    body: text("body").default("").notNull(),
    status: text("status").$type<DocumentStatus>().default("draft").notNull(),
    token: text("token"),
    signerEmail: text("signer_email"),
    signerName: text("signer_name"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("documents_owner_idx").on(t.ownerId),
    uniqueIndex("documents_token_unique").on(t.token),
  ],
);

export const documentsRelations = relations(documents, ({ one }) => ({
  owner: one(users, { fields: [documents.ownerId], references: [users.id] }),
  deal: one(deals, { fields: [documents.dealId], references: [deals.id] }),
  person: one(persons, {
    fields: [documents.personId],
    references: [persons.id],
  }),
}));
