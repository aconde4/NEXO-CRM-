import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  deals,
  organizations,
  persons,
  pipelines,
  stages,
} from "@/server/db/schema";
import { ensureDefaultPipeline } from "@/server/queries/deals";

/**
 * Embudo de contactos (Fase 6.4c): el tablero de Negocios es el embudo de prospección.
 * Cada contacto entra automáticamente como un `deal` en la **primera etapa** ("Cargadas")
 * del embudo por defecto al darlo de alta (manual o importación). Reutiliza
 * `deals`+`stages`+Kanban; el título del deal = empresa (para que la tarjeta muestre la
 * empresa arriba y el contacto debajo). No emite eventos de automatización (inserta
 * directo) para no provocar cascadas en las altas.
 */

type FunnelEntry = { pipelineId: string; stageId: string };

/** Embudo por defecto + su primera etapa (la de "Cargadas"). Idempotente. */
export async function getDefaultFunnelEntry(
  userId: string,
): Promise<FunnelEntry | null> {
  await ensureDefaultPipeline(userId);

  const [pipeline] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.ownerId, userId))
    .orderBy(desc(pipelines.isDefault), asc(pipelines.position))
    .limit(1);
  if (!pipeline) return null;

  const [stage] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(and(eq(stages.pipelineId, pipeline.id), eq(stages.ownerId, userId)))
    .orderBy(asc(stages.position))
    .limit(1);
  if (!stage) return null;

  return { pipelineId: pipeline.id, stageId: stage.id };
}

async function dealTitleForPerson(
  userId: string,
  person: { firstName: string; lastName: string | null; orgId: string | null },
): Promise<string> {
  if (person.orgId) {
    const [org] = await db
      .select({ name: organizations.name, tradeName: organizations.tradeName })
      .from(organizations)
      .where(
        and(
          eq(organizations.id, person.orgId),
          eq(organizations.ownerId, userId),
        ),
      )
      .limit(1);
    const orgName = org?.tradeName?.trim() || org?.name?.trim();
    if (orgName) return orgName;
  }
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    "Contacto"
  );
}

/**
 * Mete un contacto en el embudo (etapa "Cargadas") si no tiene ya un deal en ese
 * embudo. Devuelve `true` si creó la tarjeta. Es best-effort para quien la llame.
 */
export async function addContactToFunnel(
  userId: string,
  personId: string,
): Promise<boolean> {
  const entry = await getDefaultFunnelEntry(userId);
  if (!entry) return false;

  // Dedupe: un contacto = una tarjeta por embudo.
  const [existing] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        eq(deals.ownerId, userId),
        eq(deals.personId, personId),
        eq(deals.pipelineId, entry.pipelineId),
        isNull(deals.deletedAt),
      ),
    )
    .limit(1);
  if (existing) return false;

  const [person] = await db
    .select({
      firstName: persons.firstName,
      lastName: persons.lastName,
      orgId: persons.orgId,
    })
    .from(persons)
    .where(
      and(
        eq(persons.id, personId),
        eq(persons.ownerId, userId),
        isNull(persons.deletedAt),
      ),
    )
    .limit(1);
  if (!person) return false;

  const title = await dealTitleForPerson(userId, person);
  const [{ maxPos } = { maxPos: 0 }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${deals.position}), 0)` })
    .from(deals)
    .where(and(eq(deals.ownerId, userId), eq(deals.stageId, entry.stageId)));

  await db.insert(deals).values({
    currency: "EUR",
    orgId: person.orgId,
    ownerId: userId,
    personId,
    pipelineId: entry.pipelineId,
    position: Number(maxPos) + 1,
    stageId: entry.stageId,
    status: "open",
    title,
    value: 0,
  });
  return true;
}

/** Versión best-effort: nunca lanza (no debe romper el alta del contacto). */
export async function addContactToFunnelSafely(
  userId: string,
  personId: string,
): Promise<void> {
  try {
    await addContactToFunnel(userId, personId);
  } catch (error) {
    console.error("No se pudo añadir el contacto al embudo", error);
  }
}

/**
 * Backfill: mete en el embudo todos los contactos del usuario que aún no tienen tarjeta
 * (los importados/creados antes de activar el embudo). Devuelve cuántos se crearon.
 */
export async function backfillContactsIntoFunnel(
  userId: string,
): Promise<number> {
  const entry = await getDefaultFunnelEntry(userId);
  if (!entry) return 0;

  const rows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.ownerId, userId), isNull(persons.deletedAt)));

  let created = 0;
  for (const row of rows) {
    if (await addContactToFunnel(userId, row.id)) created += 1;
  }
  return created;
}
