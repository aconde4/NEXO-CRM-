import "server-only";

import { and, eq, gte, inArray, isNull, or } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { activities, deals, stages, type DealStatus } from "@/server/db/schema";

// --- Tipos ------------------------------------------------------------------
export type ForecastMonthPoint = {
  key: string;
  label: string;
  /** Ingreso ponderado por la probabilidad de la etapa. */
  weighted: number;
  /** Valor total (sin ponderar) de los negocios con cierre previsto ese mes. */
  value: number;
  count: number;
};

export type ActivityDayPoint = {
  key: string;
  label: string;
  completed: number;
  created: number;
};

export type WonMonthPoint = {
  key: string;
  label: string;
  count: number;
  value: number;
};

export type AnalyticsOverview = {
  kpis: {
    openDeals: number;
    openValue: number;
    forecast: number;
    wonThisMonth: { count: number; value: number };
    lostThisMonth: { count: number };
    /** % de victorias sobre los negocios cerrados en los últimos 90 días. */
    winRate: number | null;
  };
  forecastByMonth: ForecastMonthPoint[];
  activityByDay: ActivityDayPoint[];
  wonByMonth: WonMonthPoint[];
};

export type AnalyticsRawData = {
  openDeals: {
    value: number;
    probability: number;
    expectedCloseDate: Date | null;
  }[];
  closedDeals: {
    status: DealStatus;
    value: number;
    wonAt: Date | null;
    lostAt: Date | null;
  }[];
  activities: { createdAt: Date; doneAt: Date | null }[];
};

const FORECAST_MONTHS = 6;
const WON_MONTHS = 6;
const ACTIVITY_DAYS = 14;
const WIN_RATE_DAYS = 90;

const monthLabelFmt = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  year: "2-digit",
});
const dayLabelFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
});

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Agregación pura del panel de analítica (sin IO). Separada de la consulta para
 * poder verificarla con datos sintéticos y un reloj fijo (`now`). Reparte por
 * meses/días en la zona horaria del servidor, coherente con el resto del CRM.
 */
export function computeAnalyticsOverview(
  data: AnalyticsRawData,
  now: Date = new Date(),
): AnalyticsOverview {
  // --- Negocios abiertos: KPIs + previsión por mes de cierre previsto -------
  let openValue = 0;
  let forecast = 0;

  const forecastByMonth: ForecastMonthPoint[] = [];
  const forecastIndex = new Map<string, ForecastMonthPoint>();
  for (let i = 0; i < FORECAST_MONTHS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const point: ForecastMonthPoint = {
      key: monthKey(d),
      label: monthLabelFmt.format(d),
      weighted: 0,
      value: 0,
      count: 0,
    };
    forecastByMonth.push(point);
    forecastIndex.set(point.key, point);
  }

  for (const deal of data.openDeals) {
    const weighted = deal.value * (deal.probability / 100);
    openValue += deal.value;
    forecast += weighted;
    if (deal.expectedCloseDate) {
      const point = forecastIndex.get(monthKey(deal.expectedCloseDate));
      if (point) {
        point.weighted += weighted;
        point.value += deal.value;
        point.count += 1;
      }
    }
  }

  // --- Cerrados: ganados por mes, este mes y tasa de victoria (90 días) -----
  const wonByMonth: WonMonthPoint[] = [];
  const wonIndex = new Map<string, WonMonthPoint>();
  for (let i = WON_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const point: WonMonthPoint = {
      key: monthKey(d),
      label: monthLabelFmt.format(d),
      count: 0,
      value: 0,
    };
    wonByMonth.push(point);
    wonIndex.set(point.key, point);
  }

  const thisMonth = monthKey(now);
  const winRateSince = new Date(now.getTime() - WIN_RATE_DAYS * 86_400_000);
  let wonThisMonthCount = 0;
  let wonThisMonthValue = 0;
  let lostThisMonthCount = 0;
  let won90 = 0;
  let lost90 = 0;

  for (const deal of data.closedDeals) {
    if (deal.status === "won" && deal.wonAt) {
      const point = wonIndex.get(monthKey(deal.wonAt));
      if (point) {
        point.count += 1;
        point.value += deal.value;
      }
      if (monthKey(deal.wonAt) === thisMonth) {
        wonThisMonthCount += 1;
        wonThisMonthValue += deal.value;
      }
      if (deal.wonAt >= winRateSince) won90 += 1;
    } else if (deal.status === "lost" && deal.lostAt) {
      if (monthKey(deal.lostAt) === thisMonth) lostThisMonthCount += 1;
      if (deal.lostAt >= winRateSince) lost90 += 1;
    }
  }

  const winRate =
    won90 + lost90 > 0 ? Math.round((won90 / (won90 + lost90)) * 100) : null;

  // --- Actividad por día (últimos 14 días) ----------------------------------
  const activityByDay: ActivityDayPoint[] = [];
  const activityIndex = new Map<string, ActivityDayPoint>();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - i,
    );
    const point: ActivityDayPoint = {
      key: dayKey(d),
      label: dayLabelFmt.format(d),
      completed: 0,
      created: 0,
    };
    activityByDay.push(point);
    activityIndex.set(point.key, point);
  }
  for (const act of data.activities) {
    const created = activityIndex.get(dayKey(act.createdAt));
    if (created) created.created += 1;
    if (act.doneAt) {
      const done = activityIndex.get(dayKey(act.doneAt));
      if (done) done.completed += 1;
    }
  }

  return {
    kpis: {
      openDeals: data.openDeals.length,
      openValue,
      forecast,
      wonThisMonth: { count: wonThisMonthCount, value: wonThisMonthValue },
      lostThisMonth: { count: lostThisMonthCount },
      winRate,
    },
    forecastByMonth,
    activityByDay,
    wonByMonth,
  };
}

/** Carga los datos del panel de analítica para un dueño concreto (testeable). */
export async function getAnalyticsOverviewForOwner(
  ownerId: string,
  now: Date = new Date(),
): Promise<AnalyticsOverview> {
  const closedWindowStart = new Date(
    now.getFullYear(),
    now.getMonth() - (WON_MONTHS - 1),
    1,
  );
  const activityStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (ACTIVITY_DAYS - 1),
  );

  const [openDeals, closedDeals, activityRows] = await Promise.all([
    db
      .select({
        value: deals.value,
        probability: stages.probability,
        expectedCloseDate: deals.expectedCloseDate,
      })
      .from(deals)
      .innerJoin(stages, eq(deals.stageId, stages.id))
      .where(
        and(
          eq(deals.ownerId, ownerId),
          eq(deals.status, "open"),
          isNull(deals.deletedAt),
        ),
      ),
    db
      .select({
        status: deals.status,
        value: deals.value,
        wonAt: deals.wonAt,
        lostAt: deals.lostAt,
      })
      .from(deals)
      .where(
        and(
          eq(deals.ownerId, ownerId),
          isNull(deals.deletedAt),
          inArray(deals.status, ["won", "lost"]),
          or(
            gte(deals.wonAt, closedWindowStart),
            gte(deals.lostAt, closedWindowStart),
          ),
        ),
      ),
    db
      .select({ createdAt: activities.createdAt, doneAt: activities.doneAt })
      .from(activities)
      .where(
        and(
          eq(activities.ownerId, ownerId),
          or(
            gte(activities.createdAt, activityStart),
            gte(activities.doneAt, activityStart),
          ),
        ),
      ),
  ]);

  return computeAnalyticsOverview(
    { openDeals, closedDeals, activities: activityRows },
    now,
  );
}

/** Panel de analítica del usuario en sesión (Fase 9.1). */
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const user = await requireUser();
  return getAnalyticsOverviewForOwner(user.id);
}
