import type { Metadata } from "next";
import Link from "next/link";

import { getFunnelMetrics } from "@/server/queries/deals";
import { FunnelConversionReport } from "@/components/analytics/funnel-conversion-report";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Embudo de conversión" };

type FunnelSearchParams = {
  pipeline?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AnalyticsFunnelPage({
  searchParams,
}: {
  searchParams: Promise<FunnelSearchParams>;
}) {
  const params = await searchParams;
  const metrics = await getFunnelMetrics(firstParam(params.pipeline));

  return (
    <>
      <PageHeader
        title="Embudo de conversión"
        description="Conversión histórica por etapa y tasa de victoria por embudo."
        actions={
          <Button variant="outline" render={<Link href="/analytics" />}>
            Volver a analítica
          </Button>
        }
      />
      <FunnelConversionReport metrics={metrics} />
    </>
  );
}
