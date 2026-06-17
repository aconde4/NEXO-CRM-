import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { entityLabels, labels } from "@/server/db/schema";

export type Label = { id: string; name: string; color: string };

export async function listLabels(): Promise<Label[]> {
  const user = await requireUser();
  return db
    .select({ id: labels.id, name: labels.name, color: labels.color })
    .from(labels)
    .where(eq(labels.ownerId, user.id))
    .orderBy(labels.name);
}

/** Etiquetas por persona (para varios contactos a la vez, sin N+1). */
export async function getLabelsForPersons(
  personIds: string[],
): Promise<Record<string, Label[]>> {
  const result: Record<string, Label[]> = {};
  if (personIds.length === 0) return result;

  const rows = await db
    .select({
      entityId: entityLabels.entityId,
      id: labels.id,
      name: labels.name,
      color: labels.color,
    })
    .from(entityLabels)
    .innerJoin(labels, eq(entityLabels.labelId, labels.id))
    .where(
      and(
        eq(entityLabels.entityType, "person"),
        inArray(entityLabels.entityId, personIds),
      ),
    );

  for (const row of rows) {
    (result[row.entityId] ??= []).push({
      id: row.id,
      name: row.name,
      color: row.color,
    });
  }
  return result;
}

export async function getLabelsForPerson(personId: string): Promise<Label[]> {
  const map = await getLabelsForPersons([personId]);
  return map[personId] ?? [];
}
