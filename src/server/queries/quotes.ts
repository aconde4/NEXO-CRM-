import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type QuoteStatus,
  deals,
  products,
  quoteItems,
  quotes,
  users,
} from "@/server/db/schema";

export type ProductListItem = {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
};

export async function listProducts(): Promise<ProductListItem[]> {
  const user = await requireUser();
  return db
    .select({
      description: products.description,
      id: products.id,
      name: products.name,
      unitPrice: products.unitPrice,
    })
    .from(products)
    .where(eq(products.ownerId, user.id))
    .orderBy(asc(products.name));
}

export type QuoteListItem = {
  id: string;
  seq: number;
  title: string;
  status: QuoteStatus;
  total: number;
  currency: string;
  dealTitle: string | null;
  createdAt: string;
};

export async function listQuotes(): Promise<QuoteListItem[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      createdAt: quotes.createdAt,
      currency: quotes.currency,
      dealTitle: deals.title,
      id: quotes.id,
      seq: quotes.seq,
      status: quotes.status,
      taxRate: quotes.taxRate,
      title: quotes.title,
    })
    .from(quotes)
    .leftJoin(deals, eq(quotes.dealId, deals.id))
    .where(eq(quotes.ownerId, user.id))
    .orderBy(desc(quotes.createdAt));
  if (rows.length === 0) return [];

  const sums = await db
    .select({
      quoteId: quoteItems.quoteId,
      subtotal: sql<number>`coalesce(sum(${quoteItems.quantity} * ${quoteItems.unitPrice}), 0)`,
    })
    .from(quoteItems)
    .where(
      inArray(
        quoteItems.quoteId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(quoteItems.quoteId);
  const subtotalByQuote = new Map(
    sums.map((s) => [s.quoteId, Number(s.subtotal)]),
  );

  return rows.map((row) => {
    const subtotal = subtotalByQuote.get(row.id) ?? 0;
    return {
      createdAt: row.createdAt.toISOString(),
      currency: row.currency,
      dealTitle: row.dealTitle,
      id: row.id,
      seq: row.seq,
      status: row.status,
      title: row.title,
      total: subtotal * (1 + (row.taxRate || 0) / 100),
    };
  });
}

export type QuoteEditorItem = {
  id: string;
  productId: string | null;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuoteEditorData = {
  quote: {
    id: string;
    seq: number;
    title: string;
    dealId: string | null;
    status: QuoteStatus;
    taxRate: number;
    notes: string;
    currency: string;
  };
  items: QuoteEditorItem[];
  productOptions: ProductListItem[];
  dealOptions: { id: string; title: string }[];
};

export async function getQuote(id: string): Promise<QuoteEditorData | null> {
  const user = await requireUser();
  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.ownerId, user.id)))
    .limit(1);
  if (!quote) return null;

  const [items, productOptions, dealOptions] = await Promise.all([
    db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, id))
      .orderBy(asc(quoteItems.position), asc(quoteItems.createdAt)),
    db
      .select({
        description: products.description,
        id: products.id,
        name: products.name,
        unitPrice: products.unitPrice,
      })
      .from(products)
      .where(eq(products.ownerId, user.id))
      .orderBy(asc(products.name)),
    db
      .select({ id: deals.id, title: deals.title })
      .from(deals)
      .where(and(eq(deals.ownerId, user.id), isNull(deals.deletedAt)))
      .orderBy(desc(deals.createdAt))
      .limit(500),
  ]);

  return {
    dealOptions,
    items: items.map((i) => ({
      description: i.description ?? "",
      id: i.id,
      name: i.name,
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    productOptions,
    quote: {
      currency: quote.currency,
      dealId: quote.dealId,
      id: quote.id,
      notes: quote.notes ?? "",
      seq: quote.seq,
      status: quote.status,
      taxRate: quote.taxRate,
      title: quote.title,
    },
  };
}

export type QuotePrintData = {
  quote: {
    seq: number;
    title: string;
    status: QuoteStatus;
    notes: string;
    taxRate: number;
    currency: string;
    createdAt: string;
    ownerName: string | null;
    dealTitle: string | null;
  };
  items: {
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
};

export async function getQuotePrint(
  id: string,
): Promise<QuotePrintData | null> {
  const user = await requireUser();
  const [row] = await db
    .select({
      createdAt: quotes.createdAt,
      currency: quotes.currency,
      dealTitle: deals.title,
      notes: quotes.notes,
      ownerName: users.name,
      seq: quotes.seq,
      status: quotes.status,
      taxRate: quotes.taxRate,
      title: quotes.title,
    })
    .from(quotes)
    .leftJoin(users, eq(quotes.ownerId, users.id))
    .leftJoin(deals, eq(quotes.dealId, deals.id))
    .where(and(eq(quotes.id, id), eq(quotes.ownerId, user.id)))
    .limit(1);
  if (!row) return null;

  const items = await db
    .select({
      description: quoteItems.description,
      name: quoteItems.name,
      quantity: quoteItems.quantity,
      unitPrice: quoteItems.unitPrice,
    })
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, id))
    .orderBy(asc(quoteItems.position));

  return {
    items: items.map((i) => ({
      description: i.description ?? "",
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    quote: {
      createdAt: row.createdAt.toISOString(),
      currency: row.currency,
      dealTitle: row.dealTitle,
      notes: row.notes ?? "",
      ownerName: row.ownerName,
      seq: row.seq,
      status: row.status,
      taxRate: row.taxRate,
      title: row.title,
    },
  };
}
