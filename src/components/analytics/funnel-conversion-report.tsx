import {
  ArrowRight,
  BarChart3,
  Filter,
  Target,
  Trophy,
  Wallet,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FunnelMetrics } from "@/server/queries/deals";
import { ChartCard } from "@/components/analytics/chart-card";

export function FunnelConversionReport({
  metrics,
}: {
  metrics: FunnelMetrics;
}) {
  const activePipelineId = metrics.activePipelineId;
  const pipelineName =
    metrics.pipelines.find((pipeline) => pipeline.id === activePipelineId)
      ?.name ?? "Embudo";
  const firstEntered = metrics.stages[0]?.entered ?? 0;
  const lastEntered = metrics.stages.at(-1)?.entered ?? 0;
  const fullFunnelConversion =
    firstEntered > 0 ? Math.round((lastEntered / firstEntered) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      {metrics.pipelines.length > 1 ? (
        <PipelineTabs
          activePipelineId={activePipelineId}
          pipelines={metrics.pipelines}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <ReportStat icon={Filter} label="Embudo" value={pipelineName} />
        <ReportStat
          icon={Target}
          label="Conversión completa"
          value={formatPercent(fullFunnelConversion)}
          detail={`${lastEntered} de ${firstEntered} llegan al final`}
        />
        <ReportStat
          icon={Trophy}
          label="Tasa de victoria"
          value={formatPercent(metrics.totals.winRate)}
          detail={`${metrics.totals.won} de ${metrics.totals.closed} cerrados`}
          tone="good"
        />
        <ReportStat
          icon={Wallet}
          label="Valor en juego"
          value={formatMoney(Math.round(metrics.totals.value))}
          detail={`${metrics.totals.open} abiertos`}
        />
        <ReportStat
          icon={XCircle}
          label="Perdidos"
          value={String(metrics.totals.lost)}
          detail={formatMoney(Math.round(metrics.totals.lostValue))}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <StageConversionCard metrics={metrics} />
        <WinRateCard metrics={metrics} />
      </div>
    </div>
  );
}

function PipelineTabs({
  activePipelineId,
  pipelines,
}: {
  activePipelineId: string | null;
  pipelines: FunnelMetrics["pipelines"];
}) {
  return (
    <nav
      aria-label="Seleccionar embudo"
      className="bg-card flex flex-wrap gap-2 rounded-lg border p-1"
    >
      {pipelines.map((pipeline) => (
        <Link
          key={pipeline.id}
          href={`/analytics/funnel?pipeline=${pipeline.id}`}
          className={cn(
            "inline-flex h-8 max-w-full items-center rounded-md px-3 text-sm font-medium transition-colors",
            activePipelineId === pipeline.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          aria-current={activePipelineId === pipeline.id ? "page" : undefined}
        >
          <span className="truncate">{pipeline.name}</span>
        </Link>
      ))}
    </nav>
  );
}

function StageConversionCard({ metrics }: { metrics: FunnelMetrics }) {
  const maxEntered = Math.max(
    1,
    ...metrics.stages.map((stage) => stage.entered ?? 0),
  );

  return (
    <ChartCard
      icon={BarChart3}
      title="Conversión por etapa"
      description="Entradas históricas desde el registro de cambios de etapa."
      action={
        metrics.activePipelineId ? (
          <Link
            href={`/deals?view=metrics&pipeline=${metrics.activePipelineId}`}
            className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            Ver en negocios
            <ArrowRight className="size-3" />
          </Link>
        ) : null
      }
    >
      {metrics.stages.length === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          Este embudo no tiene etapas todavía.
        </p>
      ) : (
        <ol className="divide-y">
          {metrics.stages.map((stage, index) => {
            const entered = stage.entered ?? 0;
            const pct = (entered / maxEntered) * 100;
            return (
              <li
                key={stage.id}
                className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_220px]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {index + 1}. {stage.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Probabilidad comercial {stage.probability}%
                      </p>
                    </div>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {stage.count} ahora ·{" "}
                      {formatMoney(Math.round(stage.value))}
                    </span>
                  </div>

                  <div className="bg-muted mt-3 h-6 overflow-hidden rounded-md">
                    <div
                      className="bg-primary/75 flex h-full items-center rounded-md px-2"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    >
                      <span className="text-primary-foreground text-xs font-medium tabular-nums">
                        {entered}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-1">
                  <SmallMetric label="Entraron" value={String(entered)} />
                  <SmallMetric
                    label="Desde anterior"
                    value={
                      stage.historicalConversion == null
                        ? "Inicio"
                        : formatPercent(stage.historicalConversion)
                    }
                  />
                  <SmallMetric
                    label="Abiertos acumulados"
                    value={String(stage.reached)}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </ChartCard>
  );
}

function WinRateCard({ metrics }: { metrics: FunnelMetrics }) {
  const winRate = metrics.totals.winRate ?? 0;
  const lostRate =
    metrics.totals.winRate == null ? 0 : 100 - metrics.totals.winRate;

  return (
    <ChartCard
      icon={Trophy}
      title="Victoria del embudo"
      description="Ganados frente a negocios cerrados en el embudo seleccionado."
    >
      {metrics.totals.closed === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          Aún no hay negocios ganados o perdidos en este embudo.
        </p>
      ) : (
        <div className="flex flex-col gap-5 px-4 py-5">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-4xl font-semibold tabular-nums">
                {formatPercent(metrics.totals.winRate)}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {metrics.totals.closed} cerrados
              </span>
            </div>
            <div className="bg-muted mt-4 flex h-3 overflow-hidden rounded-full">
              <div
                className="bg-emerald-500"
                style={{ width: `${Math.max(0, winRate)}%` }}
              />
              <div
                className="bg-destructive/70"
                style={{ width: `${Math.max(0, lostRate)}%` }}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <WinLossRow
              label="Ganados"
              count={metrics.totals.won}
              value={metrics.totals.wonValue}
              className="text-emerald-600 dark:text-emerald-400"
            />
            <WinLossRow
              label="Perdidos"
              count={metrics.totals.lost}
              value={metrics.totals.lostValue}
              className="text-destructive"
            />
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function ReportStat({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tone?: "good";
}) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-1 rounded-lg border p-3">
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span
        className={cn(
          "truncate text-xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
        )}
        title={value}
      >
        {value}
      </span>
      {detail ? (
        <span className="text-muted-foreground truncate text-xs" title={detail}>
          {detail}
        </span>
      ) : null}
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/60 rounded-md px-2.5 py-2">
      <p className="text-muted-foreground truncate text-[11px]">{label}</p>
      <p className="truncate text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function WinLossRow({
  label,
  count,
  value,
  className,
}: {
  label: string;
  count: number;
  value: number;
  className?: string;
}) {
  return (
    <div className="bg-muted/60 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm">
      <span className={cn("font-medium", className)}>{label}</span>
      <span className="text-muted-foreground text-right tabular-nums">
        {count} · {formatMoney(Math.round(value))}
      </span>
    </div>
  );
}

function formatPercent(value: number | null): string {
  return value == null ? "Sin datos" : `${value}%`;
}
