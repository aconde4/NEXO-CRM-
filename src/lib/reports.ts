/**
 * Informes personalizados (Fase 9.6). Catálogo de opciones y parseo de parámetros del
 * informe de negocios, compartido por la página, la barra de filtros y la exportación CSV
 * para que todos interpreten la URL igual.
 */
export type ReportStatus = "all" | "open" | "won" | "lost";
export type ReportDateField = "created" | "won";
export type ReportGroupBy = "none" | "stage" | "status" | "month" | "campaign";

export type ReportParams = {
  status: ReportStatus;
  /** "" = todos los embudos. */
  pipelineId: string;
  dateField: ReportDateField;
  /** "" o yyyy-mm-dd. */
  from: string;
  to: string;
  groupBy: ReportGroupBy;
};

export const REPORT_STATUSES: { value: ReportStatus; label: string }[] = [
  { label: "Todos", value: "all" },
  { label: "Abiertos", value: "open" },
  { label: "Ganados", value: "won" },
  { label: "Perdidos", value: "lost" },
];

export const REPORT_DATE_FIELDS: { value: ReportDateField; label: string }[] = [
  { label: "Fecha de creación", value: "created" },
  { label: "Fecha de cierre (ganado)", value: "won" },
];

export const REPORT_GROUP_BY: { value: ReportGroupBy; label: string }[] = [
  { label: "Etapa", value: "stage" },
  { label: "Estado", value: "status" },
  { label: "Mes", value: "month" },
  { label: "Campaña", value: "campaign" },
  { label: "Sin agrupar (detalle)", value: "none" },
];

export const REPORT_STATUS_LABELS: Record<Exclude<ReportStatus, "all">, string> =
  {
    lost: "Perdido",
    open: "Abierto",
    won: "Ganado",
  };

function oneOf<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function normalizeDate(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

/** Lee los parámetros del informe desde un accesor genérico (page o URLSearchParams). */
export function parseReportParams(
  get: (key: string) => string | null | undefined,
): ReportParams {
  return {
    dateField: oneOf(get("dateField"), ["created", "won"] as const, "created"),
    from: normalizeDate(get("from")),
    groupBy: oneOf(
      get("groupBy"),
      ["none", "stage", "status", "month", "campaign"] as const,
      "stage",
    ),
    pipelineId: (get("pipeline") ?? "").trim(),
    status: oneOf(get("status"), ["all", "open", "won", "lost"] as const, "all"),
    to: normalizeDate(get("to")),
  };
}

/** Serializa los parámetros (omite los valores por defecto) para enlaces y export. */
export function reportParamsToQuery(params: ReportParams): string {
  const sp = new URLSearchParams();
  if (params.status !== "all") sp.set("status", params.status);
  if (params.pipelineId) sp.set("pipeline", params.pipelineId);
  if (params.dateField !== "created") sp.set("dateField", params.dateField);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.groupBy !== "stage") sp.set("groupBy", params.groupBy);
  return sp.toString();
}
