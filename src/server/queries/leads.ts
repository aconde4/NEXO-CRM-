import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { type LeadStatus, leads, organizations, persons } from "@/server/db/schema";

export type LeadListItem = {
  id: string;
  status: LeadStatus;
  source: string;
  score: number;
  createdAt: string;
  convertedDealId: string | null;
  person: { id: string; name: string; email: string | null } | null;
  organization: { id: string; name: string } | null;
};

export type LeadCounts = Record<LeadStatus, number> & { all: number };

export async function listLeads(
  status?: LeadStatus,
): Promise<LeadListItem[]> {
  const user = await requireUser();
  const where = status
    ? and(eq(leads.ownerId, user.id), eq(leads.status, status))
    : eq(leads.ownerId, user.id);

  const rows = await db
    .select({
      id: leads.id,
      status: leads.status,
      source: leads.source,
      score: leads.score,
      createdAt: leads.createdAt,
      convertedDealId: leads.convertedDealId,
      personId: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      email: persons.email,
      orgId: organizations.id,
      orgName: organizations.name,
    })
    .from(leads)
    .leftJoin(persons, eq(leads.personId, persons.id))
    .leftJoin(organizations, eq(persons.orgId, organizations.id))
    .where(where)
    .orderBy(desc(leads.createdAt))
    .limit(300);

  return rows.map((row) => ({
    convertedDealId: row.convertedDealId,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    organization: row.orgId
      ? { id: row.orgId, name: row.orgName ?? "Empresa" }
      : null,
    person: row.personId
      ? {
          email: row.email,
          id: row.personId,
          name:
            [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
            "Contacto",
        }
      : null,
    score: row.score,
    source: row.source ?? "",
    status: row.status,
  }));
}

/** Conteo de leads por estado, para las pestañas de la bandeja. */
export async function getLeadCounts(): Promise<LeadCounts> {
  const user = await requireUser();
  const rows = await db
    .select({ status: leads.status, count: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.ownerId, user.id))
    .groupBy(leads.status);

  const counts: LeadCounts = {
    all: 0,
    converted: 0,
    junk: 0,
    new: 0,
    qualified: 0,
  };
  for (const row of rows) {
    counts[row.status] = row.count;
    counts.all += row.count;
  }
  return counts;
}
