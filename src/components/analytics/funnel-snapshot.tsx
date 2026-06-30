import { ArrowRight, Filter } from "lucide-react";
import Link from "next/link";

import { formatMoney } from "@/lib/format";
import type { FunnelMetrics } from "@/server/queries/deals";
import { ChartCard } from "@/components/analytics/chart-card";

export function FunnelSnapshot({ metrics }: { metrics: FunnelMetrics }) {
  const { stages, totals } = metrics;
  const pipelineName =
    metrics.pipelines.find((p) => p.id === metrics.activePipelineId)?.name ??
    "Embudo";
  const maxReached = Math.max(1, ...stages.map((s) => s.reached));

  return (
    <ChartCard
      icon={Filter}
      title="Embudo por etapa"
      description={`${pipelineName} · ${totals.open} ${
        totals.open === 1 ? "negocio abierto" : "negocios abiertos"
      } · ${formatMoney(Math.round(totals.value))}${
        totals.winRate == null ? "" : ` · ${totals.winRate}% victoria`
      }`}
      action={
        <Link
          href="/analytics/funnel"
          className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Ver informe
          <ArrowRight className="size-3" />
        </Link>
      }
    >
      {stages.length === 0 || totals.open === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          {stages.length === 0
            ? "Este embudo no tiene etapas todavía."
            : "Aún no hay negocios abiertos en este embudo."}
        </p>
      ) : (
        <ol className="flex flex-col gap-3 px-4 py-4">
          {stages.map((stage) => (
            <li key={stage.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{stage.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {stage.count} · {formatMoney(Math.round(stage.value))}
                </span>
              </div>
              <div className="bg-muted h-5 overflow-hidden rounded-md">
                <div
                  className="bg-primary/70 flex h-full items-center rounded-md px-2 transition-all"
                  style={{
                    width: `${Math.max(2, (stage.reached / maxReached) * 100)}%`,
                  }}
                >
                  <span className="text-primary-foreground text-[10px] font-medium tabular-nums">
                    {stage.reached}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  );
}
