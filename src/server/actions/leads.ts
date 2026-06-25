"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { deals, leads } from "@/server/db/schema";
import { addContactToFunnel } from "@/server/services/contact-funnel";

const leadStatusSchema = z.enum(["new", "qualified", "junk"]);

async function assertOwned(ownerId: string, id: string) {
  const [row] = await db
    .select({
      id: leads.id,
      personId: leads.personId,
      status: leads.status,
      convertedDealId: leads.convertedDealId,
    })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new Error("Lead no encontrado");
  return row;
}

/** Califica o descarta un lead (no se usa para "converted", que va por la conversión). */
export async function setLeadStatus(id: string, status: unknown) {
  const user = await requireUser();
  const value = leadStatusSchema.parse(status);
  await assertOwned(user.id, id);
  await db
    .update(leads)
    .set({ status: value })
    .where(and(eq(leads.id, id), eq(leads.ownerId, user.id)));
  revalidatePath("/leads");
}

/**
 * Convierte un lead en negocio: mete a su contacto en el embudo (etapa "Cargadas") y
 * marca el lead como `converted` apuntando al deal creado/existente.
 */
export async function convertLeadToDeal(id: string) {
  const user = await requireUser();
  const lead = await assertOwned(user.id, id);
  if (!lead.personId) {
    throw new Error("Este lead no tiene un contacto asociado.");
  }

  await addContactToFunnel(user.id, lead.personId);

  const [deal] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        eq(deals.ownerId, user.id),
        eq(deals.personId, lead.personId),
        isNull(deals.deletedAt),
      ),
    )
    .orderBy(desc(deals.createdAt))
    .limit(1);

  await db
    .update(leads)
    .set({ status: "converted", convertedDealId: deal?.id ?? null })
    .where(and(eq(leads.id, id), eq(leads.ownerId, user.id)));

  revalidatePath("/leads");
  revalidatePath("/deals");
  return { dealId: deal?.id ?? null };
}

export async function deleteLead(id: string) {
  const user = await requireUser();
  await db
    .delete(leads)
    .where(and(eq(leads.id, id), eq(leads.ownerId, user.id)));
  revalidatePath("/leads");
}
