import "server-only";

import { and, asc, eq } from "drizzle-orm";

import type { CustomEntityType } from "@/lib/custom-fields";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { savedViews, type SavedViewFilters } from "@/server/db/schema";

export type SavedView = {
  id: string;
  name: string;
  entityType: CustomEntityType;
  filters: SavedViewFilters;
};

export async function listSavedViews(
  entityType: CustomEntityType,
): Promise<SavedView[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      id: savedViews.id,
      name: savedViews.name,
      entityType: savedViews.entityType,
      filters: savedViews.filters,
    })
    .from(savedViews)
    .where(
      and(
        eq(savedViews.ownerId, user.id),
        eq(savedViews.entityType, entityType),
      ),
    )
    .orderBy(asc(savedViews.position), asc(savedViews.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    entityType: r.entityType,
    filters: r.filters ?? {},
  }));
}
