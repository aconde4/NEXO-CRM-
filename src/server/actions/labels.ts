"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { entityLabels, labels } from "@/server/db/schema";

const labelSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido"),
});

export async function createLabel(input: { name: string; color: string }) {
  const user = await requireUser();
  const data = labelSchema.parse(input);

  const [row] = await db
    .insert(labels)
    .values({ name: data.name, color: data.color, ownerId: user.id })
    .returning({ id: labels.id, name: labels.name, color: labels.color });

  if (!row) throw new Error("No se pudo crear la etiqueta");
  return row;
}

/** Asigna la etiqueta a la persona si no la tiene; la quita si ya la tiene. */
export async function togglePersonLabel(personId: string, labelId: string) {
  const user = await requireUser();

  // La etiqueta debe pertenecer al usuario (autorización).
  const owned = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.ownerId, user.id)))
    .limit(1);
  if (!owned[0]) throw new Error("Etiqueta no encontrada");

  const existing = await db
    .select({ id: entityLabels.id })
    .from(entityLabels)
    .where(
      and(
        eq(entityLabels.labelId, labelId),
        eq(entityLabels.entityType, "person"),
        eq(entityLabels.entityId, personId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db.delete(entityLabels).where(eq(entityLabels.id, existing[0].id));
  } else {
    await db.insert(entityLabels).values({
      labelId,
      entityType: "person",
      entityId: personId,
    });
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${personId}`);
}
