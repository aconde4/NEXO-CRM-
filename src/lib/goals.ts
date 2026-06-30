import type { GoalMetric, GoalPeriod } from "@/server/db/schema";

export type GoalFormat = "money" | "count";

export type GoalMetricMeta = {
  value: GoalMetric;
  label: string;
  format: GoalFormat;
  group: string;
};

/** Métricas medibles desde los datos existentes (Fase 9.5). */
export const GOAL_METRICS: GoalMetricMeta[] = [
  { format: "money", group: "Ingresos", label: "Ingresos ganados", value: "revenue_won" },
  { format: "count", group: "Pipeline", label: "Negocios ganados", value: "deals_won" },
  { format: "count", group: "Pipeline", label: "Negocios creados", value: "deals_created" },
  {
    format: "count",
    group: "Actividad",
    label: "Actividades completadas",
    value: "activities_completed",
  },
  { format: "count", group: "Comunicación", label: "Emails enviados", value: "emails_sent" },
];

const GOAL_METRIC_MAP = new Map(GOAL_METRICS.map((m) => [m.value, m]));

export const GOAL_PERIODS: { value: GoalPeriod; label: string }[] = [
  { label: "Este mes", value: "month" },
  { label: "Este trimestre", value: "quarter" },
];

export function goalMetricLabel(metric: GoalMetric): string {
  return GOAL_METRIC_MAP.get(metric)?.label ?? metric;
}

export function goalMetricFormat(metric: GoalMetric): GoalFormat {
  return GOAL_METRIC_MAP.get(metric)?.format ?? "count";
}

export function goalPeriodLabel(period: GoalPeriod): string {
  return GOAL_PERIODS.find((p) => p.value === period)?.label ?? period;
}

/** Inicio del periodo en curso (zona del servidor), coherente con el resto del CRM. */
export function goalPeriodStart(period: GoalPeriod, now: Date = new Date()): Date {
  if (period === "quarter") {
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterMonth, 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
