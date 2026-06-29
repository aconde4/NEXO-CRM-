"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Columns3,
  List,
  Megaphone,
  Target,
  Trophy,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

import type { ContactFilterCondition } from "@/lib/contact-filters";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FunnelMetrics } from "@/server/queries/deals";
import { Button } from "@/components/ui/button";
import { ContactFiltersBar } from "@/components/contacts/contact-filters-bar";
import { PipelineCombobox } from "@/components/deals/pipeline-combobox";

export function DealsMetrics({
  metrics,
  conditions,
  customFieldDefs,
}: {
  metrics: FunnelMetrics;
  conditions: ContactFilterCondition[];
  customFieldDefs: CustomFieldDef[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { totals, stages, byCampaign } = metrics;

  // Preserva el resto de parámetros (filtro, etc.) al cambiar de vista o embudo.
  function viewHref(view: "board" | "list") {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "board") params.delete("view");
    else params.set("view", view);
    return `/deals${params.size ? `?${params}` : ""}`;
  }
  function selectPipeline(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "metrics");
    params.set("pipeline", id);
    router.push(`/deals?${params}`);
  }

  const maxReached = Math.max(1, ...stages.map((s) => s.reached));
  const maxCampaign = Math.max(1, ...byCampaign.map((c) => c.count));

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PipelineCombobox
          pipelines={metrics.pipelines}
          value={metrics.activePipelineId ?? ""}
          onSelect={selectPipeline}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="shrink-0"
            render={<Link href={viewHref("board")} />}
          >
            <Columns3 />
            Kanban
          </Button>
          <Button
            variant="outline"
            className="shrink-0"
            render={<Link href={viewHref("list")} />}
          >
            <List />
            Lista
          </Button>
          <Button variant="secondary" className="shrink-0" aria-current="page">
            <BarChart3 />
            Métricas
          </Button>
        </div>
      </div>

      <ContactFiltersBar
        conditions={conditions}
        customFieldDefs={customFieldDefs}
        basePath="/deals"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat icon={Users} label="En el embudo" value={String(totals.open)} />
        <Stat icon={Wallet} label="Valor en juego" value={formatMoney(totals.value)} />
        <Stat
          icon={Target}
          label="Previsión"
          value={formatMoney(Math.round(totals.forecast))}
        />
        <Stat
          icon={AlertTriangle}
          label="Estancados"
          value={String(totals.stalled)}
          tone={totals.stalled > 0 ? "warn" : undefined}
        />
        <Stat icon={Trophy} label="Ganados" value={String(totals.won)} tone="good" />
        <Stat icon={XCircle} label="Perdidos" value={String(totals.lost)} />
      </div>

      <section className="rounded-xl border">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-medium">Embudo por etapa</h2>
            <p className="text-muted-foreground text-xs">
              Instantánea del estado actual (negocios abiertos).
            </p>
          </div>
        </header>
        {stages.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            Este embudo no tiene etapas. Añádelas en{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Ajustes
            </Link>
            .
          </p>
        ) : totals.open === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            Aún no hay negocios abiertos en este embudo.
          </p>
        ) : (
          <ol className="flex flex-col gap-4 p-4">
            {stages.map((stage) => (
              <li key={stage.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">
                    {stage.name}{" "}
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {stage.probability}%
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {stage.count}{" "}
                    {stage.count === 1 ? "negocio" : "negocios"} ·{" "}
                    {formatMoney(stage.value)}
                  </span>
                </div>
                <div className="bg-muted h-6 overflow-hidden rounded-md">
                  <div
                    className="bg-primary/80 flex h-full items-center rounded-md px-2 transition-all"
                    style={{
                      width: `${Math.max(2, (stage.reached / maxReached) * 100)}%`,
                    }}
                  >
                    <span className="text-primary-foreground text-xs font-medium tabular-nums">
                      {stage.reached}
                    </span>
                  </div>
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  <span>
                    {stage.reached} llegaron a esta etapa o más adelante
                  </span>
                  {stage.conversionFromPrev != null ? (
                    <span className="tabular-nums">
                      {stage.conversionFromPrev}% desde la etapa anterior
                    </span>
                  ) : null}
                  {stage.entered != null ? (
                    <span className="tabular-nums">
                      {stage.entered} entraron (histórico
                      {stage.historicalConversion != null
                        ? ` · ${stage.historicalConversion}%`
                        : ""}
                      )
                    </span>
                  ) : null}
                  {stage.stalled > 0 ? (
                    <span className="text-destructive inline-flex items-center gap-1">
                      <AlertTriangle className="size-3" />
                      {stage.stalled} estancado{stage.stalled === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-xl border">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <Megaphone className="text-muted-foreground size-4" />
          <div>
            <h2 className="text-sm font-medium">Por campaña</h2>
            <p className="text-muted-foreground text-xs">
              Reparto de negocios abiertos según la campaña del contacto.
            </p>
          </div>
        </header>
        {byCampaign.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            Sin negocios abiertos que mostrar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5 p-4">
            {byCampaign.map((c) => (
              <li
                key={c.campaign ?? "__none__"}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  className={cn(
                    "w-32 shrink-0 truncate",
                    c.campaign ? "" : "text-muted-foreground italic",
                  )}
                  title={c.campaign ?? "Sin campaña"}
                >
                  {c.campaign ?? "Sin campaña"}
                </span>
                <div className="bg-muted h-4 flex-1 overflow-hidden rounded-full">
                  <div
                    className="bg-primary/70 h-full rounded-full"
                    style={{
                      width: `${Math.max(3, (c.count / maxCampaign) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-muted-foreground w-28 shrink-0 text-right tabular-nums">
                  {c.count} · {formatMoney(c.value)}
                </span>
              </li>
            ))}
            {metrics.hasMoreCampaigns ? (
              <li className="text-muted-foreground pt-1 text-center text-xs">
                Mostrando las {byCampaign.length} campañas con más negocios.
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="bg-card flex flex-col gap-1 rounded-xl border p-3">
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}
