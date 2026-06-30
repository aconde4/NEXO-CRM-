import { ArrowRight, MailCheck } from "lucide-react";
import Link from "next/link";

import { ChartCard } from "@/components/analytics/chart-card";
import type { EmailPerformance } from "@/server/queries/analytics";

export function EmailPerformanceSnapshot({
  performance,
}: {
  performance: EmailPerformance;
}) {
  const { rates, totals } = performance;
  const hasData = Object.values(totals).some((value) => value > 0);

  return (
    <ChartCard
      icon={MailCheck}
      title="Rendimiento de email"
      description={`Últimos ${performance.period.days} días · ${totals.sent} enviados · ${formatPercent(
        rates.openRate,
      )} apertura`}
      action={
        <Link
          href="/analytics/email"
          className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Ver informe
          <ArrowRight className="size-3" />
        </Link>
      }
    >
      {!hasData ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          Todavía no hay señales de email en el periodo.
        </p>
      ) : (
        <div className="grid gap-2 px-4 py-4 sm:grid-cols-5">
          <SmallMetric label="Enviados" value={String(totals.sent)} />
          <SmallMetric
            label="Apertura"
            value={formatPercent(rates.openRate)}
            detail={`${totals.opened} únicos`}
          />
          <SmallMetric
            label="Clic"
            value={formatPercent(rates.clickRate)}
            detail={`${totals.clicked} únicos`}
          />
          <SmallMetric
            label="Respuesta"
            value={formatPercent(rates.replyRate)}
            detail={`${totals.replied} únicas`}
          />
          <SmallMetric
            label="Bajas"
            value={formatPercent(rates.unsubscribeRate)}
            detail={`${totals.unsubscribed} contactos`}
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
  detail?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/60 min-w-0 rounded-md px-3 py-2">
      <p className="text-muted-foreground truncate text-[11px]">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      {detail ? (
        <p className="text-muted-foreground truncate text-[11px]">{detail}</p>
      ) : null}
    </div>
  );
}

function formatPercent(value: number | null): string {
  return value == null ? "Sin datos" : `${value}%`;
}
