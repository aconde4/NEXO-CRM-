import "server-only";

import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import type {
  ContactFilterCondition,
  ContactFilterOperator,
} from "@/lib/contact-filters";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type MarketingStatus,
  activities,
  entityLabels,
  notes,
  organizations,
  persons,
} from "@/server/db/schema";

export type PersonSort = "recent" | "oldest" | "name";

export type ContactListFilters = {
  conditions?: ContactFilterCondition[];
  labelId?: string;
  search?: string;
  sort?: string;
};

const MARKETING_STATUS_VALUES = new Set<MarketingStatus>([
  "subscribed",
  "unsubscribed",
  "bounced",
  "complained",
]);

/** Criterio de orden para el listado de contactos. */
function personOrderBy(sort?: string): SQL[] {
  switch (sort) {
    case "name":
      return [
        sql`${persons.lastName} asc nulls last`,
        asc(persons.firstName),
      ];
    case "oldest":
      return [asc(persons.createdAt)];
    default:
      return [desc(persons.createdAt)];
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function textPattern(
  value: string,
  op: Extract<ContactFilterOperator, "contains" | "starts_with">,
): string {
  const escaped = escapeLike(value.trim());
  return op === "starts_with" ? `${escaped}%` : `%${escaped}%`;
}

function nullableTextCondition(
  expr: SQL<string | null>,
  op: ContactFilterOperator,
  value?: string,
): SQL | undefined {
  switch (op) {
    case "is_set":
      return sql`${expr} is not null and ${expr} <> ''`;
    case "is_empty":
      return sql`${expr} is null or ${expr} = ''`;
    case "eq":
      return value?.trim()
        ? sql`lower(${expr}) = lower(${value.trim()})`
        : undefined;
    case "neq":
      return value?.trim()
        ? sql`(${expr} is null or lower(${expr}) <> lower(${value.trim()}))`
        : undefined;
    case "contains":
    case "starts_with":
      return value?.trim()
        ? sql`${expr} ilike ${textPattern(value, op)} escape '\\'`
        : undefined;
    default:
      return undefined;
  }
}

function nameCondition(condition: ContactFilterCondition): SQL | undefined {
  const firstName = nullableTextCondition(
    sql<string | null>`${persons.firstName}`,
    condition.op,
    condition.value,
  );
  const lastName = nullableTextCondition(
    sql<string | null>`${persons.lastName}`,
    condition.op,
    condition.value,
  );
  const fullName = nullableTextCondition(
    sql<string | null>`trim(concat_ws(' ', ${persons.firstName}, ${persons.lastName}))`,
    condition.op,
    condition.value,
  );
  return or(firstName, lastName, fullName);
}

function organizationCondition(
  condition: ContactFilterCondition,
  ownerId: string,
): SQL | undefined {
  if (condition.op === "is_empty") return isNull(persons.orgId);
  if (condition.op === "is_set") return isNotNull(persons.orgId);

  const name = nullableTextCondition(
    sql<string | null>`${organizations.name}`,
    condition.op,
    condition.value,
  );
  const tradeName = nullableTextCondition(
    sql<string | null>`${organizations.tradeName}`,
    condition.op,
    condition.value,
  );
  const orgMatch = or(name, tradeName);
  if (!orgMatch) return undefined;

  const orgIds = db
    .select({ id: organizations.id })
    .from(organizations)
    .where(
      and(
        eq(organizations.ownerId, ownerId),
        isNull(organizations.deletedAt),
        orgMatch,
      ),
    );

  return inArray(persons.orgId, orgIds);
}

function marketingStatusCondition(
  condition: ContactFilterCondition,
): SQL | undefined {
  if (condition.op === "is_set") return sql`true`;
  if (condition.op === "is_empty") return sql`false`;
  if (
    !condition.value ||
    !MARKETING_STATUS_VALUES.has(condition.value as MarketingStatus)
  ) {
    return undefined;
  }

  return condition.op === "neq"
    ? ne(persons.marketingStatus, condition.value as MarketingStatus)
    : eq(persons.marketingStatus, condition.value as MarketingStatus);
}

function customFieldCondition(
  key: string,
  condition: ContactFilterCondition,
): SQL | undefined {
  return nullableTextCondition(
    sql<string | null>`${persons.customFields}->>${key}`,
    condition.op,
    condition.value,
  );
}

function contactConditionToSql(
  condition: ContactFilterCondition,
  ownerId: string,
): SQL | undefined {
  switch (condition.field) {
    case "name":
      return nameCondition(condition);
    case "email":
      return nullableTextCondition(
        sql<string | null>`${persons.email}`,
        condition.op,
        condition.value,
      );
    case "phone":
      return nullableTextCondition(
        sql<string | null>`${persons.phone}`,
        condition.op,
        condition.value,
      );
    case "title":
      return nullableTextCondition(
        sql<string | null>`${persons.title}`,
        condition.op,
        condition.value,
      );
    case "organization":
      return organizationCondition(condition, ownerId);
    case "source":
      return nullableTextCondition(
        sql<string | null>`${persons.source}`,
        condition.op,
        condition.value,
      );
    case "campaign":
      return nullableTextCondition(
        sql<string | null>`${persons.campaign}`,
        condition.op,
        condition.value,
      );
    case "marketingStatus":
      return marketingStatusCondition(condition);
    default:
      return condition.field.startsWith("custom:")
        ? customFieldCondition(condition.field.slice("custom:".length), condition)
        : undefined;
  }
}

function personWhere(input: ContactListFilters, ownerId: string): SQL | undefined {
  const filters: SQL[] = [eq(persons.ownerId, ownerId), isNull(persons.deletedAt)];

  if (input.search?.trim()) {
    const q = textPattern(input.search, "contains");
    const match = or(
      sql`${persons.firstName} ilike ${q} escape '\\'`,
      sql`${persons.lastName} ilike ${q} escape '\\'`,
      sql`${persons.email} ilike ${q} escape '\\'`,
      sql`${persons.phone} ilike ${q} escape '\\'`,
      sql`${persons.title} ilike ${q} escape '\\'`,
      sql`${persons.source} ilike ${q} escape '\\'`,
      sql`${persons.campaign} ilike ${q} escape '\\'`,
    );
    if (match) filters.push(match);
  }

  if (input.labelId) {
    const labeled = db
      .select({ id: entityLabels.entityId })
      .from(entityLabels)
      .where(
        and(
          eq(entityLabels.entityType, "person"),
          eq(entityLabels.labelId, input.labelId),
        ),
      );
    filters.push(inArray(persons.id, labeled));
  }

  for (const condition of input.conditions ?? []) {
    const conditionSql = contactConditionToSql(condition, ownerId);
    if (conditionSql) filters.push(conditionSql);
  }

  return and(...filters);
}

// --- Contactos --------------------------------------------------------------
export async function listPersons(input: ContactListFilters = {}) {
  const user = await requireUser();

  return db.query.persons.findMany({
    where: personWhere(input, user.id),
    with: { organization: { columns: { id: true, name: true } } },
    orderBy: personOrderBy(input.sort),
    limit: 200,
  });
}

/**
 * Solo los ids de contacto que cumplen los filtros (sin límite bajo). Lo usa el embudo
 * de Negocios (6.4d) para acotar las tarjetas por contacto reutilizando el motor de
 * filtros de 6.4b.
 */
export async function listPersonIdsByFilters(
  input: ContactListFilters,
): Promise<string[]> {
  const user = await requireUser();
  const rows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(personWhere(input, user.id))
    .limit(50_000);
  return rows.map((row) => row.id);
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
export async function listPersonsForExport(input: ContactListFilters = {}) {
  const user = await requireUser();

  return db.query.persons.findMany({
    where: personWhere(input, user.id),
    with: { organization: { columns: { name: true } } },
    orderBy: personOrderBy(input.sort),
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
