import "server-only";

import { type SQL, and, desc, eq, gte, isNull, lte } from "drizzle-orm";

import { fullName } from "@/lib/format";
import {
  type ReportParams,
  REPORT_STATUS_LABELS,
} from "@/lib/reports";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type DealStatus,
  deals,
  organizations,
  persons,
  pipelines,
  stages,
} from "@/server/db/schema";

export type ReportDealRow = {
  id: string;
  title: string;
  value: number;
  status: DealStatus;
  createdAt: Date;
  wonAt: Date | null;
  stageName: string | null;
  pipelineName: string | null;
  orgName: string | null;
  personName: string | null;
  campaign: string | null;
};

export type ReportGroupRow = {
  key: string;
  label: string;
  count: number;
  value: number;
  wonValue: number;
};

export type DealsReport = {
  summary: { count: number; value: number; wonCount: number; wonValue: number };
  groups: ReportGroupRow[];
  rowCount: number;
  groupBy: ReportParams["groupBy"];
};

const REPORT_ROW_LIMIT = 5000;

const monthLabelFmt = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  year: "numeric",
});

function dayStart(value: string): Date {
  return new Date(`${value}T00:00:00`);
}
function dayEnd(value: string): Date {
  return new Date(`${value}T23:59:59.999`);
}

/** Filas de negocio que cumplen los filtros del informe (owner-aware). */
export async function fetchDealsReportRows(
  ownerId: string,
  params: ReportParams,
): Promise<ReportDealRow[]> {
  const where: SQL[] = [eq(deals.ownerId, ownerId), isNull(deals.deletedAt)];
  if (params.status !== "all") where.push(eq(deals.status, params.status));
  if (params.pipelineId) where.push(eq(deals.pipelineId, params.pipelineId));

  const dateColumn =
    params.dateField === "won" ? deals.wonAt : deals.createdAt;
  if (params.from) where.push(gte(dateColumn, dayStart(params.from)));
  if (params.to) where.push(lte(dateColumn, dayEnd(params.to)));

  const rows = await db
    .select({
      campaign: persons.campaign,
      createdAt: deals.createdAt,
      id: deals.id,
      orgName: organizations.name,
      personFirstName: persons.firstName,
      personLastName: persons.lastName,
      pipelineName: pipelines.name,
      stageName: stages.name,
      status: deals.status,
      title: deals.title,
      value: deals.value,
      wonAt: deals.wonAt,
    })
    .from(deals)
    .leftJoin(stages, eq(deals.stageId, stages.id))
    .leftJoin(pipelines, eq(deals.pipelineId, pipelines.id))
    .leftJoin(persons, eq(deals.personId, persons.id))
    .leftJoin(organizations, eq(deals.orgId, organizations.id))
    .where(and(...where))
    .orderBy(desc(deals.createdAt))
    .limit(REPORT_ROW_LIMIT);

  return rows.map((row) => ({
    campaign: row.campaign,
    createdAt: row.createdAt,
    id: row.id,
    orgName: row.orgName,
    personName: row.personFirstName
      ? fullName(row.personFirstName, row.personLastName)
      : null,
    pipelineName: row.pipelineName,
    stageName: row.stageName,
    status: row.status,
    title: row.title,
    value: row.value,
    wonAt: row.wonAt,
  }));
}

function groupKeyForRow(
  row: ReportDealRow,
  params: ReportParams,
): { key: string; label: string } {
  switch (params.groupBy) {
    case "status":
      return { key: row.status, label: REPORT_STATUS_LABELS[row.status] };
    case "campaign":
      return row.campaign?.trim()
        ? { key: row.campaign.trim(), label: row.campaign.trim() }
        : { key: "__none__", label: "Sin campaña" };
    case "month": {
      const date = params.dateField === "won" ? row.wonAt : row.createdAt;
      if (!date) return { key: "__nodate__", label: "Sin fecha" };
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        label: monthLabelFmt.format(date),
      };
    }
    case "stage":
    default:
      return {
        key: row.stageName ?? "__none__",
        label: row.stageName ?? "Sin etapa",
      };
  }
}

/** Agregación pura del informe (resumen + grupos), separada para poder verificarla. */
export function buildDealsReport(
  rows: ReportDealRow[],
  params: ReportParams,
): DealsReport {
  let value = 0;
  let wonCount = 0;
  let wonValue = 0;
  const groupMap = new Map<string, ReportGroupRow>();

  for (const row of rows) {
    value += row.value;
    if (row.status === "won") {
      wonCount += 1;
      wonValue += row.value;
    }
    if (params.groupBy !== "none") {
      const { key, label } = groupKeyForRow(row, params);
      const group = groupMap.get(key) ?? {
        count: 0,
        key,
        label,
        value: 0,
        wonValue: 0,
      };
      group.count += 1;
      group.value += row.value;
      if (row.status === "won") group.wonValue += row.value;
      groupMap.set(key, group);
    }
  }

  const groups = [...groupMap.values()];
  if (params.groupBy === "month") {
    groups.sort((a, b) => a.key.localeCompare(b.key));
  } else {
    groups.sort((a, b) => b.value - a.value || b.count - a.count);
  }

  return {
    groupBy: params.groupBy,
    groups,
    rowCount: rows.length,
    summary: { count: rows.length, value, wonCount, wonValue },
  };
}

/** Informe de negocios para el usuario en sesión: filas + agregación. */
export async function getDealsReport(params: ReportParams): Promise<{
  rows: ReportDealRow[];
  report: DealsReport;
}> {
  const user = await requireUser();
  const rows = await fetchDealsReportRows(user.id, params);
  return { report: buildDealsReport(rows, params), rows };
}
