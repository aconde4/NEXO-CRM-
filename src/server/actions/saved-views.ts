"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { normalizeContactFilters } from "@/lib/contact-filters";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { requireUser } from "@/lib/session";
import {
  savedViewSchema,
  type SavedViewValues,
} from "@/lib/validations/saved-view";
import { db } from "@/server/db";
import { savedViews, type SavedViewEntity } from "@/server/db/schema";
import { listCustomFieldDefs } from "@/server/queries/custom-fields";

function pathFor(entityType: SavedViewEntity) {
  if (entityType === "person") return "/contacts";
  if (entityType === "deal") return "/deals";
  return "/organizations";
}

/** Quita claves vacías de los filtros para no guardar ruido. */
function cleanFilters(
  filters: SavedViewValues["filters"],
  customFieldDefs: CustomFieldDef[] = [],
) {
  const out: SavedViewValues["filters"] = {};
  const conditions = normalizeContactFilters(
    filters.conditions ?? [],
    customFieldDefs,
  );
  if (conditions.length > 0) out.conditions = conditions;
  if (filters.q?.trim()) out.q = filters.q.trim();
  if (filters.label?.trim()) out.label = filters.label.trim();
  if (filters.sort?.trim()) out.sort = filters.sort.trim();
  // Vistas del embudo de Negocios (6.4h): embudo, etapa y vista.
  if (filters.pipeline?.trim()) out.pipeline = filters.pipeline.trim();
  if (filters.stage?.trim()) out.stage = filters.stage.trim();
  if (filters.view?.trim()) out.view = filters.view.trim();
  return out;
}

export async function createSavedView(raw: SavedViewValues) {
  const user = await requireUser();
  const data = savedViewSchema.parse(raw);
  // Las condiciones del embudo de Negocios (`deal`) filtran por contacto, así que
  // se validan/normalizan contra los campos personalizados de persona (igual que
  // hace `/deals` al decodificar el filtro). Sin esto se perderían al guardar.
  const customFieldDefs =
    data.entityType === "person" || data.entityType === "deal"
      ? await listCustomFieldDefs("person")
      : [];

  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${savedViews.position}), 0)` })
    .from(savedViews)
    .where(
      and(
        eq(savedViews.ownerId, user.id),
        eq(savedViews.entityType, data.entityType),
      ),
    );

  const [row] = await db
    .insert(savedViews)
    .values({
      name: data.name.trim(),
      entityType: data.entityType,
      filters: cleanFilters(data.filters, customFieldDefs),
      position: Number(max) + 1,
      ownerId: user.id,
    })
    .returning({ id: savedViews.id });

  if (!row) throw new Error("No se pudo guardar la vista");
  revalidatePath(pathFor(data.entityType));
  return { id: row.id };
}

export async function deleteSavedView(id: string) {
  const user = await requireUser();
  const [row] = await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.ownerId, user.id)))
    .returning({ entityType: savedViews.entityType });
  if (row) revalidatePath(pathFor(row.entityType));
}
