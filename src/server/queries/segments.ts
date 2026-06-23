import "server-only";

import {
  type AnyColumn,
  type SQL,
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  not,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import {
  type SegmentDefinition,
  type SegmentRule,
  type SegmentRuleOp,
  isRuleComplete,
} from "@/lib/segments";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type MarketingStatus,
  entityLabels,
  organizations,
  persons,
  segments,
} from "@/server/db/schema";

export type SegmentAudience = {
  /** Contactos que cumplen la definición. */
  total: number;
  /** De esos, cuántos tienen email. */
  withEmail: number;
  /** De esos, cuántos son alcanzables (con email y marketing «suscrito»). */
  reachable: number;
};

/** Traduce un operador de texto a SQL sobre una columna `text` anulable. */
function textRule(
  column: AnyColumn,
  op: SegmentRuleOp,
  value: string,
): SQL | undefined {
  switch (op) {
    case "is_set":
      return and(isNotNull(column), ne(column, ""));
    case "is_empty":
      return or(isNull(column), eq(column, ""));
    case "eq":
      // Sin comodines: igualdad sin distinguir mayúsculas.
      return ilike(column, value);
    case "contains":
      return ilike(column, `%${value}%`);
    default:
      return undefined;
  }
}

/** Traduce una regla del segmento a una condición SQL sobre `persons`. */
function ruleToSql(rule: SegmentRule): SQL | undefined {
  if (!isRuleComplete(rule)) return undefined;
  const value = (rule.value ?? "").trim();

  switch (rule.field) {
    case "name": {
      const like = `%${value}%`;
      const matches = or(
        ilike(persons.firstName, like),
        ilike(persons.lastName, like),
      );
      if (!matches) return undefined;
      return rule.op === "not_contains" ? not(matches) : matches;
    }
    case "email":
      return textRule(persons.email, rule.op, value);
    case "title":
      return textRule(persons.title, rule.op, value);
    case "source":
      return textRule(persons.source, rule.op, value);
    case "campaign":
      return textRule(persons.campaign, rule.op, value);
    case "marketing_status":
      return rule.op === "neq"
        ? ne(persons.marketingStatus, value as MarketingStatus)
        : eq(persons.marketingStatus, value as MarketingStatus);
    case "label": {
      const labeled = db
        .select({ id: entityLabels.entityId })
        .from(entityLabels)
        .where(
          and(
            eq(entityLabels.entityType, "person"),
            eq(entityLabels.labelId, value),
          ),
        );
      return rule.op === "not_has_label"
        ? notInArray(persons.id, labeled)
        : inArray(persons.id, labeled);
    }
    case "organization":
      return rule.op === "is_empty"
        ? isNull(persons.orgId)
        : isNotNull(persons.orgId);
    case "created": {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return undefined;
      return rule.op === "before"
        ? lt(persons.createdAt, date)
        : gte(persons.createdAt, date);
    }
    default:
      return undefined;
  }
}

/** Construye el `where` de un segmento (propietario + no borrado + reglas/ids). */
function segmentWhere(
  definition: SegmentDefinition,
  ownerId: string,
): SQL | undefined {
  const base: SQL[] = [eq(persons.ownerId, ownerId), isNull(persons.deletedAt)];

  if (definition.personIds && definition.personIds.length > 0) {
    base.push(inArray(persons.id, definition.personIds));
    return and(...base);
  }

  const clauses = (definition.rules ?? [])
    .map(ruleToSql)
    .filter((c): c is SQL => Boolean(c));
  if (clauses.length > 0) {
    const combined =
      definition.match === "any" ? or(...clauses) : and(...clauses);
    if (combined) base.push(combined);
  }
  return and(...base);
}

function segmentConditions(
  definition: SegmentDefinition,
  ownerId: string,
  opts: { reachableOnly?: boolean } = {},
): SQL[] {
  const where = segmentWhere(definition, ownerId);
  const conditions = [where].filter((c): c is SQL => Boolean(c));
  if (opts.reachableOnly) {
    conditions.push(
      isNotNull(persons.email),
      ne(persons.email, ""),
      eq(persons.marketingStatus, "subscribed"),
    );
  }
  return conditions;
}

/** Cuenta la audiencia de un segmento (total / con email / alcanzable). */
export async function countSegmentAudience(
  definition: SegmentDefinition,
): Promise<SegmentAudience> {
  const user = await requireUser();
  return countSegmentAudienceForOwner(definition, user.id);
}

export async function countSegmentAudienceForOwner(
  definition: SegmentDefinition,
  ownerId: string,
): Promise<SegmentAudience> {
  const where = segmentWhere(definition, ownerId);
  const hasEmail = sql`${persons.email} is not null and ${persons.email} <> ''`;
  const [row] = await db
    .select({
      total: sql<string>`count(*)`,
      withEmail: sql<string>`count(*) filter (where ${hasEmail})`,
      reachable: sql<string>`count(*) filter (where ${hasEmail} and ${persons.marketingStatus} = 'subscribed')`,
    })
    .from(persons)
    .where(where);

  return {
    total: Number(row?.total ?? 0),
    withEmail: Number(row?.withEmail ?? 0),
    reachable: Number(row?.reachable ?? 0),
  };
}

export type SegmentMember = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  source: string | null;
  campaign: string | null;
  marketingStatus: MarketingStatus;
};

export type SegmentRecipient = SegmentMember & {
  phone: string | null;
  title: string | null;
  customFields: Record<string, unknown>;
  organization: {
    name: string;
    tradeName: string | null;
    website: string | null;
    industry: string | null;
    customFields: Record<string, unknown>;
  } | null;
};

/**
 * Resuelve los contactos de un segmento. Por defecto devuelve todos los que cumplen;
 * con `reachableOnly` filtra a los alcanzables (con email y suscritos) — la base de un
 * envío de campaña, que luego se cruza con la lista de supresión (RGPD) en la 4.6/4.7.
 */
export async function resolveSegmentPersons(
  definition: SegmentDefinition,
  opts: { limit?: number; reachableOnly?: boolean } = {},
): Promise<SegmentMember[]> {
  const user = await requireUser();
  return resolveSegmentPersonsForOwner(definition, user.id, opts);
}

export async function resolveSegmentPersonsForOwner(
  definition: SegmentDefinition,
  ownerId: string,
  opts: { limit?: number; reachableOnly?: boolean } = {},
): Promise<SegmentMember[]> {
  const conditions = segmentConditions(definition, ownerId, opts);
  return db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      email: persons.email,
      source: persons.source,
      campaign: persons.campaign,
      marketingStatus: persons.marketingStatus,
    })
    .from(persons)
    .where(and(...conditions))
    .orderBy(asc(persons.firstName), asc(persons.lastName))
    .limit(opts.limit ?? 50_000);
}

export async function resolveSegmentRecipientsForOwner(
  definition: SegmentDefinition,
  ownerId: string,
  opts: { limit?: number; reachableOnly?: boolean } = {},
): Promise<SegmentRecipient[]> {
  const conditions = segmentConditions(definition, ownerId, opts);
  const rows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      email: persons.email,
      phone: persons.phone,
      source: persons.source,
      campaign: persons.campaign,
      title: persons.title,
      customFields: persons.customFields,
      marketingStatus: persons.marketingStatus,
      orgName: organizations.name,
      orgTradeName: organizations.tradeName,
      orgWebsite: organizations.website,
      orgIndustry: organizations.industry,
      orgCustomFields: organizations.customFields,
    })
    .from(persons)
    .leftJoin(
      organizations,
      and(
        eq(persons.orgId, organizations.id),
        eq(organizations.ownerId, ownerId),
        isNull(organizations.deletedAt),
      ),
    )
    .where(and(...conditions))
    .orderBy(asc(persons.firstName), asc(persons.lastName))
    .limit(opts.limit ?? 50_000);

  return rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    source: row.source,
    campaign: row.campaign,
    title: row.title,
    customFields: row.customFields,
    marketingStatus: row.marketingStatus,
    organization: row.orgName
      ? {
          name: row.orgName,
          tradeName: row.orgTradeName,
          website: row.orgWebsite,
          industry: row.orgIndustry,
          customFields: row.orgCustomFields ?? {},
        }
      : null,
  }));
}

// --- CRUD de segmentos ------------------------------------------------------
export async function listSegments() {
  const user = await requireUser();
  return db
    .select({
      id: segments.id,
      name: segments.name,
      description: segments.description,
      kind: segments.kind,
      definition: segments.definition,
      updatedAt: segments.updatedAt,
    })
    .from(segments)
    .where(eq(segments.ownerId, user.id))
    .orderBy(desc(segments.updatedAt));
}

export type SegmentListItem = Awaited<ReturnType<typeof listSegments>>[number];

export async function getSegment(id: string) {
  const user = await requireUser();
  const [row] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.id, id), eq(segments.ownerId, user.id)))
    .limit(1);
  return row ?? null;
}

/** Opciones (id + nombre) para selectores de segmento en campañas. */
export async function listSegmentOptions() {
  const user = await requireUser();
  return db
    .select({ id: segments.id, name: segments.name })
    .from(segments)
    .where(eq(segments.ownerId, user.id))
    .orderBy(segments.name)
    .limit(500);
}
