import "server-only";

import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";

import { goalPeriodStart } from "@/lib/goals";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type GoalMetric,
  type GoalPeriod,
  activities,
  deals,
  emailEvents,
  goals,
} from "@/server/db/schema";

export type GoalWithProgress = {
  id: string;
  name: string | null;
  metric: GoalMetric;
  period: GoalPeriod;
  target: number;
  actual: number;
  /** % de avance del periodo en curso (puede superar 100). */
  progress: number;
};

type MetricValues = Record<GoalMetric, number>;

/** Valores reales de cada métrica para el periodo en curso (owner-aware). */
async function metricsForPeriod(
  ownerId: string,
  period: GoalPeriod,
  now: Date,
): Promise<MetricValues> {
  const start = goalPeriodStart(period, now);

  const [revenue, dealsWon, dealsCreated, activitiesDone, emailsSent] =
    await Promise.all([
      db
        .select({ value: sql<number>`coalesce(sum(${deals.value}), 0)` })
        .from(deals)
        .where(
          and(
            eq(deals.ownerId, ownerId),
            eq(deals.status, "won"),
            isNull(deals.deletedAt),
            gte(deals.wonAt, start),
          ),
        ),
      db.$count(
        deals,
        and(
          eq(deals.ownerId, ownerId),
          eq(deals.status, "won"),
          isNull(deals.deletedAt),
          gte(deals.wonAt, start),
        ),
      ),
      db.$count(
        deals,
        and(
          eq(deals.ownerId, ownerId),
          isNull(deals.deletedAt),
          gte(deals.createdAt, start),
        ),
      ),
      db.$count(
        activities,
        and(
          eq(activities.ownerId, ownerId),
          eq(activities.done, true),
          gte(activities.doneAt, start),
        ),
      ),
      db.$count(
        emailEvents,
        and(
          eq(emailEvents.ownerId, ownerId),
          eq(emailEvents.type, "sent"),
          gte(emailEvents.occurredAt, start),
        ),
      ),
    ]);

  return {
    activities_completed: activitiesDone,
    deals_created: dealsCreated,
    deals_won: dealsWon,
    emails_sent: emailsSent,
    revenue_won: Number(revenue[0]?.value ?? 0),
  };
}

export async function listGoalsWithProgressForOwner(
  ownerId: string,
  now: Date = new Date(),
): Promise<GoalWithProgress[]> {
  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.ownerId, ownerId))
    .orderBy(asc(goals.createdAt));
  if (rows.length === 0) return [];

  const byPeriod = new Map<GoalPeriod, MetricValues>();
  for (const period of new Set(rows.map((row) => row.period))) {
    byPeriod.set(period, await metricsForPeriod(ownerId, period, now));
  }

  return rows.map((row) => {
    const actual = byPeriod.get(row.period)?.[row.metric] ?? 0;
    const progress =
      row.target > 0 ? Math.round((actual / row.target) * 100) : 0;
    return {
      actual,
      id: row.id,
      metric: row.metric,
      name: row.name,
      period: row.period,
      progress,
      target: row.target,
    };
  });
}

export async function listGoalsWithProgress(): Promise<GoalWithProgress[]> {
  const user = await requireUser();
  return listGoalsWithProgressForOwner(user.id);
}
