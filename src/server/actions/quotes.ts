"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  type ProductFormValues,
  type QuoteFormValues,
  productFormSchema,
  productIdSchema,
  quoteFormSchema,
  quoteIdSchema,
} from "@/lib/validations/quote";
import { db } from "@/server/db";
import { products, quoteItems, quotes } from "@/server/db/schema";

export async function saveProduct(raw: ProductFormValues) {
  const user = await requireUser();
  const data = productFormSchema.parse(raw);
  const values = {
    description: data.description.trim() ? data.description.trim() : null,
    name: data.name,
    unitPrice: data.unitPrice,
  };
  if (data.id) {
    await db
      .update(products)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(products.id, data.id), eq(products.ownerId, user.id)));
    revalidatePath("/products");
    return { id: data.id };
  }
  const [created] = await db
    .insert(products)
    .values({ ...values, ownerId: user.id })
    .returning({ id: products.id });
  revalidatePath("/products");
  return { id: created?.id };
}

export async function deleteProduct(id: string) {
  const user = await requireUser();
  const productId = productIdSchema.parse(id);
  await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.ownerId, user.id)));
  revalidatePath("/products");
  return { id: productId };
}

/** Crea un presupuesto en borrador (con número secuencial por dueño) y lo devuelve. */
export async function createQuote() {
  const user = await requireUser();
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quotes)
    .where(eq(quotes.ownerId, user.id));
  const [created] = await db
    .insert(quotes)
    .values({ ownerId: user.id, seq: Number(count) + 1, title: "Presupuesto" })
    .returning({ id: quotes.id });
  revalidatePath("/quotes");
  return { id: created?.id };
}

export async function saveQuote(raw: QuoteFormValues) {
  const user = await requireUser();
  const data = quoteFormSchema.parse(raw);

  const [owned] = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(and(eq(quotes.id, data.id), eq(quotes.ownerId, user.id)))
    .limit(1);
  if (!owned) throw new Error("Presupuesto no encontrado");

  await db.transaction(async (tx) => {
    await tx
      .update(quotes)
      .set({
        dealId: data.dealId,
        notes: data.notes.trim() ? data.notes.trim() : null,
        status: data.status,
        taxRate: data.taxRate,
        title: data.title,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, data.id));

    await tx.delete(quoteItems).where(eq(quoteItems.quoteId, data.id));
    if (data.items.length > 0) {
      await tx.insert(quoteItems).values(
        data.items.map((item, index) => ({
          description: item.description.trim() ? item.description.trim() : null,
          name: item.name,
          position: index,
          productId: item.productId,
          quantity: item.quantity,
          quoteId: data.id,
          unitPrice: item.unitPrice,
        })),
      );
    }
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${data.id}`);
  return { id: data.id };
}

export async function deleteQuote(id: string) {
  const user = await requireUser();
  const quoteId = quoteIdSchema.parse(id);
  await db
    .delete(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.ownerId, user.id)));
  revalidatePath("/quotes");
  return { id: quoteId };
}
