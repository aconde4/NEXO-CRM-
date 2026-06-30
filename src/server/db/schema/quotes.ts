/**
 * Productos y presupuestos (Fase 10.2). `products` es un catálogo opcional; `quotes` son
 * presupuestos con líneas (`quote_items`). Los totales (subtotal, impuesto, total) se
 * calculan al vuelo desde las líneas. El "PDF" es una vista imprimible (print-to-PDF del
 * navegador), sin dependencias añadidas.
 */
import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { deals } from "./crm";

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    unitPrice: doublePrecision("unit_price").default(0).notNull(),
    ...timestamps,
  },
  (t) => [index("products_owner_idx").on(t.ownerId)],
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    seq: integer("seq").default(1).notNull(),
    title: text("title").notNull(),
    status: text("status").$type<QuoteStatus>().default("draft").notNull(),
    notes: text("notes"),
    taxRate: doublePrecision("tax_rate").default(0).notNull(),
    currency: text("currency").default("EUR").notNull(),
    ...timestamps,
  },
  (t) => [index("quotes_owner_idx").on(t.ownerId)],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    quantity: doublePrecision("quantity").default(1).notNull(),
    unitPrice: doublePrecision("unit_price").default(0).notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("quote_items_quote_idx").on(t.quoteId)],
);

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  owner: one(users, { fields: [quotes.ownerId], references: [users.id] }),
  deal: one(deals, { fields: [quotes.dealId], references: [deals.id] }),
  items: many(quoteItems),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteItems.quoteId], references: [quotes.id] }),
  product: one(products, {
    fields: [quoteItems.productId],
    references: [products.id],
  }),
}));
