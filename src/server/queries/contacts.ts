import "server-only";

import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  activities,
  entityLabels,
  notes,
  organizations,
  persons,
} from "@/server/db/schema";

// --- Contactos --------------------------------------------------------------
export async function listPersons(search?: string, labelId?: string) {
  const user = await requireUser();
  const filters = [eq(persons.ownerId, user.id), isNull(persons.deletedAt)];

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    const match = or(
      ilike(persons.firstName, q),
      ilike(persons.lastName, q),
      ilike(persons.email, q),
    );
    if (match) filters.push(match);
  }

  if (labelId) {
    const labeled = db
      .select({ id: entityLabels.entityId })
      .from(entityLabels)
      .where(
        and(
          eq(entityLabels.entityType, "person"),
          eq(entityLabels.labelId, labelId),
        ),
      );
    filters.push(inArray(persons.id, labeled));
  }

  return db.query.persons.findMany({
    where: and(...filters),
    with: { organization: { columns: { id: true, name: true } } },
    orderBy: [desc(persons.createdAt)],
    limit: 200,
  });
}

export async function getPerson(id: string) {
  const user = await requireUser();
  return db.query.persons.findFirst({
    where: and(
      eq(persons.id, id),
      eq(persons.ownerId, user.id),
      isNull(persons.deletedAt),
    ),
    with: {
      organization: true,
      notes: { orderBy: [desc(notes.createdAt)], limit: 50 },
      activities: { orderBy: [desc(activities.createdAt)], limit: 50 },
    },
  });
}

export type PersonListItem = Awaited<ReturnType<typeof listPersons>>[number];
export type PersonDetail = Awaited<ReturnType<typeof getPerson>>;

/** Contactos completos para exportar a CSV (mismos filtros, sin límite bajo). */
export async function listPersonsForExport(search?: string, labelId?: string) {
  const user = await requireUser();
  const filters = [eq(persons.ownerId, user.id), isNull(persons.deletedAt)];

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    const match = or(
      ilike(persons.firstName, q),
      ilike(persons.lastName, q),
      ilike(persons.email, q),
    );
    if (match) filters.push(match);
  }

  if (labelId) {
    const labeled = db
      .select({ id: entityLabels.entityId })
      .from(entityLabels)
      .where(
        and(
          eq(entityLabels.entityType, "person"),
          eq(entityLabels.labelId, labelId),
        ),
      );
    filters.push(inArray(persons.id, labeled));
  }

  return db.query.persons.findMany({
    where: and(...filters),
    with: { organization: { columns: { name: true } } },
    orderBy: [desc(persons.createdAt)],
    limit: 50_000,
  });
}

// --- Empresas ---------------------------------------------------------------
export async function listOrganizations(search?: string) {
  const user = await requireUser();
  const filters = [
    eq(organizations.ownerId, user.id),
    isNull(organizations.deletedAt),
  ];

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    const match = or(
      ilike(organizations.name, q),
      ilike(organizations.domain, q),
      ilike(organizations.industry, q),
    );
    if (match) filters.push(match);
  }

  return db.query.organizations.findMany({
    where: and(...filters),
    with: { persons: { columns: { id: true }, where: isNull(persons.deletedAt) } },
    orderBy: [desc(organizations.createdAt)],
    limit: 200,
  });
}

export async function getOrganization(id: string) {
  const user = await requireUser();
  return db.query.organizations.findFirst({
    where: and(
      eq(organizations.id, id),
      eq(organizations.ownerId, user.id),
      isNull(organizations.deletedAt),
    ),
    with: {
      persons: {
        where: isNull(persons.deletedAt),
        orderBy: [desc(persons.createdAt)],
      },
      notes: { orderBy: [desc(notes.createdAt)], limit: 50 },
      activities: { orderBy: [desc(activities.createdAt)], limit: 100 },
    },
  });
}

export type OrganizationListItem = Awaited<
  ReturnType<typeof listOrganizations>
>[number];
export type OrganizationDetail = Awaited<ReturnType<typeof getOrganization>>;

/** Empresas completas para exportar a CSV (con nº de contactos). */
export async function listOrganizationsForExport(search?: string) {
  const user = await requireUser();
  const filters = [
    eq(organizations.ownerId, user.id),
    isNull(organizations.deletedAt),
  ];

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    const match = or(
      ilike(organizations.name, q),
      ilike(organizations.domain, q),
      ilike(organizations.industry, q),
    );
    if (match) filters.push(match);
  }

  return db.query.organizations.findMany({
    where: and(...filters),
    with: {
      persons: { columns: { id: true }, where: isNull(persons.deletedAt) },
    },
    orderBy: [desc(organizations.createdAt)],
    limit: 50_000,
  });
}

// --- Contadores -------------------------------------------------------------
export async function countPersons() {
  const user = await requireUser();
  return db.$count(
    persons,
    and(eq(persons.ownerId, user.id), isNull(persons.deletedAt)),
  );
}

export async function countOrganizations() {
  const user = await requireUser();
  return db.$count(
    organizations,
    and(eq(organizations.ownerId, user.id), isNull(organizations.deletedAt)),
  );
}

/** Opciones (id + nombre) para selectores de empresa en formularios. */
export async function listOrganizationOptions() {
  const user = await requireUser();
  return db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(
      and(
        eq(organizations.ownerId, user.id),
        isNull(organizations.deletedAt),
      ),
    )
    .orderBy(organizations.name)
    .limit(500);
}

/** Opciones (id + nombre completo) para selectores de contacto en formularios. */
export async function listPersonOptions() {
  const user = await requireUser();
  const rows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(persons)
    .where(and(eq(persons.ownerId, user.id), isNull(persons.deletedAt)))
    .orderBy(persons.firstName, persons.lastName)
    .limit(500);
  return rows.map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(" ").trim(),
  }));
}

export type EntityOption = { id: string; name: string };
