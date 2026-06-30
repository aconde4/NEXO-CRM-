import type { Metadata } from "next";
import Link from "next/link";

import { EmailPerformanceReport } from "@/components/analytics/email-performance-report";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getEmailPerformance } from "@/server/queries/analytics";

export const metadata: Metadata = { title: "Rendimiento de email" };

export default async function AnalyticsEmailPage() {
  const performance = await getEmailPerformance();

  return (
    <>
      <PageHeader
        title="Rendimiento de email"
        description="Aperturas, clics, respuestas, bajas e incidencias de Gmail, secuencias y campañas."
        actions={
          <Button variant="outline" render={<Link href="/analytics" />}>
            Volver a analítica
          </Button>
        }
      />

      <EmailPerformanceReport performance={performance} />
    </>
  );
}
