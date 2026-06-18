"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  dealContactSchema,
  type DealContactValues,
} from "@/lib/validations/deal";
import { db } from "@/server/db";
import { dealContacts, deals, persons } from "@/server/db/schema";

/** Comprueba que el negocio pertenece al usuario y devuelve su id. */
async function assertDealOwner(userId: string, dealId: string) {
  const [row] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        eq(deals.id, dealId),
        eq(deals.ownerId, userId),
        isNull(deals.deletedAt),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Negocio no encontrado");
}

export async function addDealContact(dealId: string, raw: DealContactValues) {
  const user = await requireUser();
  const data = dealContactSchema.parse(raw);
  await assertDealOwner(user.id, dealId);

  // El contacto debe pertenecer al usuario.
  const [owned] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(
      and(
        eq(persons.id, data.personId),
        eq(persons.ownerId, user.id),
        isNull(persons.deletedAt),
      ),
    )
    .limit(1);
  if (!owned) throw new Error("Contacto no encontrado");

  await db
    .insert(dealContacts)
    .values({
      dealId,
      personId: data.personId,
      role: data.role?.trim() || null,
    })
    .onConflictDoNothing();

  revalidatePath(`/deals/${dealId}`);
  return { dealId };
}

export async function removeDealContact(id: string) {
  const user = await requireUser();

  // Solo se borra si el negocio pertenece al usuario.
  const [row] = await db
    .select({ dealId: dealContacts.dealId })
    .from(dealContacts)
    .innerJoin(deals, eq(dealContacts.dealId, deals.id))
    .where(and(eq(dealContacts.id, id), eq(deals.ownerId, user.id)))
    .limit(1);
  if (!row) throw new Error("Participante no encontrado");

  await db.delete(dealContacts).where(eq(dealContacts.id, id));
  revalidatePath(`/deals/${row.dealId}`);
  return { id };
}
