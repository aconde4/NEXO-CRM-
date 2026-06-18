import "server-only";

import { and, asc, eq } from "drizzle-orm";

import type { CustomEntityType, CustomFieldDef } from "@/lib/custom-fields";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { customFieldDefs } from "@/server/db/schema";

function toDef(row: typeof customFieldDefs.$inferSelect): CustomFieldDef {
  return {
    id: row.id,
    entityType: row.entityType,
    key: row.key,
    label: row.label,
    type: row.type,
    options: row.options ?? [],
    required: row.required,
    position: row.position,
  };
}

export async function listCustomFieldDefs(
  entityType: CustomEntityType,
): Promise<CustomFieldDef[]> {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(customFieldDefs)
    .where(
      and(
        eq(customFieldDefs.ownerId, user.id),
        eq(customFieldDefs.entityType, entityType),
      ),
    )
    .orderBy(asc(customFieldDefs.position), asc(customFieldDefs.createdAt));
  return rows.map(toDef);
}

export async function listAllCustomFieldDefs(): Promise<{
  person: CustomFieldDef[];
  organization: CustomFieldDef[];
}> {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(customFieldDefs)
    .where(eq(customFieldDefs.ownerId, user.id))
    .orderBy(asc(customFieldDefs.position), asc(customFieldDefs.createdAt));
  const defs = rows.map(toDef);
  return {
    person: defs.filter((d) => d.entityType === "person"),
    organization: defs.filter((d) => d.entityType === "organization"),
  };
}
