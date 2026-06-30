import { ArrowRight, Send } from "lucide-react";
import Link from "next/link";

import { ChartCard } from "@/components/analytics/chart-card";
import type { OutreachMetrics } from "@/server/queries/analytics-outreach";

export function OutreachSnapshot({ metrics }: { metrics: OutreachMetrics }) {
  const sequenceTotals = metrics.sequences.totals;
  const campaignTotals = metrics.campaigns.totals;
  const totalSent = sequenceTotals.sent + campaignTotals.sent;
  const hasData =
    sequenceTotals.total +
      campaignTotals.total +
      totalSent +
      campaignTotals.audience >
    0;

  return (
    <ChartCard
      icon={Send}
      title="Secuencias y campañas"
      description={`${sequenceTotals.statuses.active} secuencias activas · ${campaignTotals.statuses.sent} campañas enviadas · ${formatNumber(totalSent)} emails`}
      action={
        <Link
          href="/analytics/outreach"
          className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Ver informe
          <ArrowRight className="size-3" />
        </Link>
      }
    >
      {!hasData ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          Todavía no hay secuencias o campañas con actividad.
        </p>
      ) : (
        <div className="grid gap-2 px-4 py-4 sm:grid-cols-5">
          <SmallMetric
            label="Secuencias"
            value={String(sequenceTotals.total)}
            detail={`${sequenceTotals.activeEnrollments} activos`}
          />
          <SmallMetric
            label="Inscritos"
            value={formatNumber(sequenceTotals.enrolled)}
            detail={`${sequenceTotals.completedEnrollments} completados`}
          />
          <SmallMetric
            label="Respuesta"
            value={formatPercent(sequenceTotals.rates.replyRate)}
            detail={`${sequenceTotals.replied} respuestas`}
          />
          <SmallMetric
            label="Campañas"
            value={String(campaignTotals.total)}
            detail={`${campaignTotals.statuses.sent} enviadas`}
          />
          <SmallMetric
            label="Audiencia"
            value={formatNumber(campaignTotals.audience)}
            detail={`${formatPercent(campaignTotals.rates.openRate)} apertura`}
          />
        </div>
      )}
    </ChartCard>
  );
}

function SmallMetric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/60 min-w-0 rounded-md px-3 py-2">
      <p className="text-muted-foreground truncate text-[11px]">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground truncate text-[11px]">{detail}</p>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(value);
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? "Sin datos" : `${value}%`;
}
