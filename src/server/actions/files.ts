"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { files } from "@/server/db/schema";
import { removeObject } from "@/server/storage";

export async function deleteAttachment(id: string) {
  const user = await requireUser();

  const [row] = await db
    .delete(files)
    .where(and(eq(files.id, id), eq(files.ownerId, user.id)))
    .returning({
      path: files.path,
      entityType: files.entityType,
      entityId: files.entityId,
    });

  if (!row) throw new Error("Adjunto no encontrado");

  // Borra el objeto del bucket; si falla, el registro ya se quitó (no bloquea).
  try {
    await removeObject(row.path);
  } catch {
    // El objeto puede no existir; ignoramos para no dejar la fila huérfana.
  }

  const base = row.entityType === "person" ? "/contacts" : "/organizations";
  revalidatePath(`${base}/${row.entityId}`);
  return { id };
}
