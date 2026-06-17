import "server-only";

import { type SQL, and, asc, desc, eq, isNotNull, lt, lte, sql } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { activities } from "@/server/db/schema";

export type ActivityFilter = "today" | "open" | "done" | "all";

export const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "open", label: "Pendientes" },
  { value: "done", label: "Hechas" },
  { value: "all", label: "Todas" },
];

export function normalizeFilter(value?: string): ActivityFilter {
  return ACTIVITY_FILTERS.some((f) => f.value === value)
    ? (value as ActivityFilter)
    : "open";
}

const withEntities = {
  person: {
    columns: { id: true, firstName: true, lastName: true },
  },
  organization: {
    columns: { id: true, name: true },
  },
} as const;

/** Fin del día de hoy (zona horaria del servidor). */
function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function listActivities(
  filter: ActivityFilter = "open",
  limit = 200,
) {
  const user = await requireUser();
  const owner = eq(activities.ownerId, user.id);

  let where: SQL | undefined;
  let orderBy: SQL[];

  switch (filter) {
    case "today":
      // Pendientes para hoy y vencidas: lo accionable ahora mismo.
      where = and(
        owner,
        eq(activities.done, false),
        isNotNull(activities.dueAt),
        lte(activities.dueAt, endOfToday()),
      );
      orderBy = [asc(activities.dueAt)];
      break;
    case "done":
      where = and(owner, eq(activities.done, true));
      orderBy = [desc(activities.doneAt)];
      break;
    case "all":
      where = owner;
      orderBy = [desc(activities.createdAt)];
      break;
    case "open":
    default:
      where = and(owner, eq(activities.done, false));
      orderBy = [
        sql`${activities.dueAt} asc nulls last`,
        desc(activities.createdAt),
      ];
      break;
  }

  return db.query.activities.findMany({
    where,
    orderBy,
    with: withEntities,
    limit,
  });
}

export type ActivityListItem = Awaited<
  ReturnType<typeof listActivities>
>[number];

/** Agenda del panel: vencidas + de hoy, sin completar, ascendente. */
export async function listAgenda(limit = 6) {
  return listActivities("today", limit);
}

/** Contadores para el panel y las pestañas. */
export async function getActivityCounts() {
  const user = await requireUser();
  const owner = eq(activities.ownerId, user.id);
  const now = new Date();

  const [open, today, overdue] = await Promise.all([
    db.$count(activities, and(owner, eq(activities.done, false))),
    db.$count(
      activities,
      and(
        owner,
        eq(activities.done, false),
        isNotNull(activities.dueAt),
        lte(activities.dueAt, endOfToday()),
      ),
    ),
    db.$count(
      activities,
      and(
        owner,
        eq(activities.done, false),
        isNotNull(activities.dueAt),
        lt(activities.dueAt, now),
      ),
    ),
  ]);

  return { open, today, overdue };
}
