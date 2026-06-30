import type { Metadata } from "next";
import Link from "next/link";

import { OutreachReport } from "@/components/analytics/outreach-report";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getOutreachMetrics } from "@/server/queries/analytics-outreach";

export const metadata: Metadata = { title: "Secuencias y campañas" };

export default async function AnalyticsOutreachPage() {
  const metrics = await getOutreachMetrics();

  return (
    <>
      <PageHeader
        title="Secuencias y campañas"
        description="Rendimiento comparado de automatizaciones comerciales, campañas, variantes y audiencias."
        actions={
          <Button variant="outline" render={<Link href="/analytics" />}>
            Volver a analítica
          </Button>
        }
      />

      <OutreachReport metrics={metrics} />
    </>
  );
}
