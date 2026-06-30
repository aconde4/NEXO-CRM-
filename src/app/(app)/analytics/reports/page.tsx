import type { Metadata } from "next";

import { parseReportParams, reportParamsToQuery } from "@/lib/reports";
import { listPipelines } from "@/server/queries/deals";
import { getDealsReport } from "@/server/queries/reports";
import { DealsReportResults } from "@/components/reports/deals-report-results";
import { ReportFilters } from "@/components/reports/report-filters";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Informes" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const params = parseReportParams((key) => first(sp[key]));

  const [{ rows, report }, pipelines] = await Promise.all([
    getDealsReport(params),
    listPipelines(),
  ]);

  const query = reportParamsToQuery(params);
  const exportHref = `/api/analytics/reports/deals/export${
    query ? `?${query}` : ""
  }`;

  return (
    <>
      <PageHeader
        title="Informes"
        description="Construye informes de negocios con filtros y agrupación, y expórtalos a CSV."
      />
      <ReportFilters
        key={query}
        params={params}
        pipelines={pipelines}
        exportHref={exportHref}
      />
      <DealsReportResults report={report} rows={rows} />
    </>
  );
}
