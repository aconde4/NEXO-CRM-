import type { Metadata } from "next";

import {
  getAnalyticsOverview,
  getEmailPerformance,
} from "@/server/queries/analytics";
import { getOutreachMetrics } from "@/server/queries/analytics-outreach";
import { getFunnelMetrics } from "@/server/queries/deals";
import { ActivityChart } from "@/components/analytics/activity-chart";
import { AnalyticsKpis } from "@/components/analytics/analytics-kpis";
import { EmailPerformanceSnapshot } from "@/components/analytics/email-performance-snapshot";
import { ForecastChart } from "@/components/analytics/forecast-chart";
import { FunnelSnapshot } from "@/components/analytics/funnel-snapshot";
import { OutreachSnapshot } from "@/components/analytics/outreach-snapshot";
import { WonChart } from "@/components/analytics/won-chart";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Analítica" };

export default async function AnalyticsPage() {
  const [overview, funnel, emailPerformance, outreach] = await Promise.all([
    getAnalyticsOverview(),
    getFunnelMetrics(),
    getEmailPerformance(),
    getOutreachMetrics(),
  ]);

  // El mes/día actual se deriva de los propios datos (sin recomputar fechas):
  // la previsión empieza en el mes actual y la actividad/ganados terminan en él.
  const currentMonthKey = overview.forecastByMonth[0]?.key ?? "";
  const todayKey = overview.activityByDay.at(-1)?.key ?? "";

  return (
    <>
      <PageHeader
        title="Analítica"
        description="Un vistazo a tu pipeline, la previsión de ingresos y tu actividad."
      />

      <AnalyticsKpis kpis={overview.kpis} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ForecastChart
          data={overview.forecastByMonth}
          forecastTotal={overview.kpis.forecast}
          currentKey={currentMonthKey}
        />
        <FunnelSnapshot metrics={funnel} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EmailPerformanceSnapshot performance={emailPerformance} />
        <OutreachSnapshot metrics={outreach} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityChart data={overview.activityByDay} currentKey={todayKey} />
        <WonChart data={overview.wonByMonth} currentKey={currentMonthKey} />
      </div>
    </>
  );
}
