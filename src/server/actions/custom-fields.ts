"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  customFieldTypeMeta,
  slugifyKey,
  type CustomEntityType,
} from "@/lib/custom-fields";
import { requireUser } from "@/lib/session";
import {
  customFieldDefSchema,
  type CustomFieldDefValues,
} from "@/lib/validations/custom-field";
import { db } from "@/server/db";
import { customFieldDefs } from "@/server/db/schema";

function revalidateAll() {
  revalidatePath("/settings");
  revalidatePath("/contacts");
  revalidatePath("/organizations");
}

/** Genera una clave única (por propietario + entidad) a partir de la etiqueta. */
async function uniqueKey(
  ownerId: string,
  entityType: CustomEntityType,
  label: string,
): Promise<string> {
  const base = slugifyKey(label);
  const existing = await db
    .select({ key: customFieldDefs.key })
    .from(customFieldDefs)
    .where(
      and(
        eq(customFieldDefs.ownerId, ownerId),
        eq(customFieldDefs.entityType, entityType),
      ),
    );
  const taken = new Set(existing.map((r) => r.key));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

function cleanOptions(values: CustomFieldDefValues): string[] {
  if (!customFieldTypeMeta[values.type].hasOptions) return [];
  const opts = (values.options ?? []).map((o) => o.trim()).filter(Boolean);
  // Elimina duplicados conservando el orden.
  return [...new Set(opts)];
}

export async function createCustomFieldDef(raw: CustomFieldDefValues) {
  const user = await requireUser();
  const data = customFieldDefSchema.parse(raw);
  const options = cleanOptions(data);

  if (customFieldTypeMeta[data.type].hasOptions && options.length === 0) {
    throw new Error("Añade al menos una opción para este tipo de campo.");
  }

  const key = await uniqueKey(user.id, data.entityType, data.label);
  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${customFieldDefs.position}), 0)` })
    .from(customFieldDefs)
    .where(
      and(
        eq(customFieldDefs.ownerId, user.id),
        eq(customFieldDefs.entityType, data.entityType),
      ),
    );

  const [row] = await db
    .insert(customFieldDefs)
    .values({
      entityType: data.entityType,
      key,
      label: data.label.trim(),
      type: data.type,
      options,
      required: data.required ?? false,
      position: Number(max) + 1,
      ownerId: user.id,
    })
    .returning({ id: customFieldDefs.id });

  if (!row) throw new Error("No se pudo crear el campo");
  revalidateAll();
  return { id: row.id };
}

export async function updateCustomFieldDef(
  id: string,
  raw: Omit<CustomFieldDefValues, "entityType">,
) {
  const user = await requireUser();
  // entityType y key no se cambian al editar.
  const data = customFieldDefSchema
    .omit({ entityType: true })
    .parse(raw);
  const options = cleanOptions({ ...data, entityType: "person" });

  if (customFieldTypeMeta[data.type].hasOptions && options.length === 0) {
    throw new Error("Añade al menos una opción para este tipo de campo.");
  }

  await db
    .update(customFieldDefs)
    .set({
      label: data.label.trim(),
      type: data.type,
      options,
      required: data.required ?? false,
    })
    .where(
      and(eq(customFieldDefs.id, id), eq(customFieldDefs.ownerId, user.id)),
    );

  revalidateAll();
  return { id };
}

export async function deleteCustomFieldDef(id: string) {
  const user = await requireUser();
  await db
    .delete(customFieldDefs)
    .where(
      and(eq(customFieldDefs.id, id), eq(customFieldDefs.ownerId, user.id)),
    );
  revalidateAll();
  return { id };
}

export async function reorderCustomFieldDefs(orderedIds: string[]) {
  const user = await requireUser();
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(customFieldDefs)
        .set({ position: index })
        .where(
          and(eq(customFieldDefs.id, id), eq(customFieldDefs.ownerId, user.id)),
        ),
    ),
  );
  revalidateAll();
}
