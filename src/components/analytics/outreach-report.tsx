import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Eye,
  MailCheck,
  MousePointerClick,
  Send,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { ChartCard } from "@/components/analytics/chart-card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  OutreachCampaignRow,
  OutreachMetrics,
  OutreachSequenceRow,
  OutreachVariantInsight,
} from "@/server/queries/analytics-outreach";
import type { CampaignStatus, SequenceStatus } from "@/server/db/schema";

export function OutreachReport({ metrics }: { metrics: OutreachMetrics }) {
  return (
    <div className="flex flex-col gap-4">
      <OutreachKpis metrics={metrics} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <ChannelComparisonCard metrics={metrics} />
        <StatusCard metrics={metrics} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SequencesTable rows={metrics.sequences.rows} />
        <CampaignsTable rows={metrics.campaigns.rows} />
      </div>

      <VariantInsightsCard variants={metrics.sequences.variants} />
    </div>
  );
}

function OutreachKpis({ metrics }: { metrics: OutreachMetrics }) {
  const sequenceTotals = metrics.sequences.totals;
  const campaignTotals = metrics.campaigns.totals;
  const stats: {
    hint: string;
    icon: LucideIcon;
    label: string;
    value: string;
  }[] = [
    {
      hint: `${sequenceTotals.activeEnrollments} inscripciones activas`,
      icon: Activity,
      label: "Secuencias activas",
      value: String(sequenceTotals.statuses.active),
    },
    {
      hint: `${sequenceTotals.completedEnrollments} completadas · ${sequenceTotals.failedEnrollments} fallidas`,
      icon: Users,
      label: "Inscritos",
      value: formatNumber(sequenceTotals.enrolled),
    },
    {
      hint: `${sequenceTotals.replied} respuestas detectadas`,
      icon: MailCheck,
      label: "Respuesta secuencias",
      value: formatPercent(sequenceTotals.rates.replyRate),
    },
    {
      hint: `${sequenceTotals.opened} aperturas · ${sequenceTotals.clicked} clics`,
      icon: Send,
      label: "Emails de secuencia",
      value: formatNumber(sequenceTotals.sent),
    },
    {
      hint: `${campaignTotals.statuses.scheduled} programadas · ${campaignTotals.statuses.sending} enviando`,
      icon: BarChart3,
      label: "Campañas enviadas",
      value: String(campaignTotals.statuses.sent),
    },
    {
      hint: `${campaignTotals.sent} enviados · ${campaignTotals.delivered} entregados`,
      icon: Users,
      label: "Audiencia campañas",
      value: formatNumber(campaignTotals.audience),
    },
    {
      hint: `${campaignTotals.opened} aperturas sobre entregados/enviados`,
      icon: Eye,
      label: "Apertura campañas",
      value: formatPercent(campaignTotals.rates.openRate),
    },
    {
      hint: `${campaignTotals.bounced + campaignTotals.complained} incidencias · ${campaignTotals.unsubscribed} bajas`,
      icon: AlertTriangle,
      label: "Riesgo campañas",
      value: formatPercent(campaignTotals.rates.bounceRate),
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </section>
  );
}

function ChannelComparisonCard({ metrics }: { metrics: OutreachMetrics }) {
  const sequenceTotals = metrics.sequences.totals;
  const campaignTotals = metrics.campaigns.totals;
  const rows = [
    {
      clicked: sequenceTotals.clicked,
      label: "Secuencias",
      opened: sequenceTotals.opened,
      repliedOrBajas: sequenceTotals.replied,
      sent: sequenceTotals.sent,
    },
    {
      clicked: campaignTotals.clicked,
      label: "Campañas",
      opened: campaignTotals.opened,
      repliedOrBajas: campaignTotals.unsubscribed,
      sent: campaignTotals.sent,
    },
  ];
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [row.sent, row.opened, row.clicked]),
  );

  return (
    <ChartCard
      icon={BarChart3}
      title="Comparativa de canales"
      description="Volumen y señales principales de secuencias frente a campañas."
    >
      <div className="divide-y">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid gap-3 px-4 py-4 md:grid-cols-[120px_1fr]"
          >
            <div>
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {formatNumber(row.sent)} enviados
              </p>
            </div>
            <div className="grid gap-2">
              <MetricBar label="Enviados" value={row.sent} max={max} />
              <MetricBar label="Aperturas" value={row.opened} max={max} />
              <MetricBar label="Clics" value={row.clicked} max={max} />
              <MetricBar
                label={row.label === "Secuencias" ? "Respuestas" : "Bajas"}
                value={row.repliedOrBajas}
                max={max}
                tone="muted"
              />
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function StatusCard({ metrics }: { metrics: OutreachMetrics }) {
  return (
    <ChartCard
      icon={CheckCircle2}
      title="Estado operativo"
      description="Distribución de estados de secuencias y campañas."
    >
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 xl:grid-cols-1">
        <StatusGroup
          title="Secuencias"
          rows={[
            ["Activas", metrics.sequences.totals.statuses.active],
            ["Borradores", metrics.sequences.totals.statuses.draft],
            ["Pausadas", metrics.sequences.totals.statuses.paused],
            ["Archivadas", metrics.sequences.totals.statuses.archived],
          ]}
        />
        <StatusGroup
          title="Campañas"
          rows={[
            ["Enviadas", metrics.campaigns.totals.statuses.sent],
            ["Borradores", metrics.campaigns.totals.statuses.draft],
            ["Programadas", metrics.campaigns.totals.statuses.scheduled],
            [
              "Enviando/pausadas",
              metrics.campaigns.totals.statuses.sending +
                metrics.campaigns.totals.statuses.paused,
            ],
            ["Con error", metrics.campaigns.totals.statuses.failed],
          ]}
        />
      </div>
    </ChartCard>
  );
}

function SequencesTable({ rows }: { rows: OutreachSequenceRow[] }) {
  return (
    <ChartCard
      icon={MailCheck}
      title="Secuencias con más volumen"
      description="Ordenadas por emails enviados; cada nombre abre su panel."
    >
      {rows.length === 0 ? (
        <EmptyState text="Aún no hay secuencias con métricas." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-muted-foreground border-b text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Secuencia</th>
                <th className="px-3 py-3 text-right font-medium">Inscritos</th>
                <th className="px-3 py-3 text-right font-medium">Enviados</th>
                <th className="px-3 py-3 text-right font-medium">Apertura</th>
                <th className="px-3 py-3 text-right font-medium">Clic</th>
                <th className="px-4 py-3 text-right font-medium">Respuesta</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/sequences/${row.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={row.status} />
                      <span className="text-muted-foreground text-xs">
                        {row.channel === "resend" ? "Resend" : "Gmail 1:1"} ·{" "}
                        {row.stepCount} pasos
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatNumber(row.enrolled)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatNumber(row.sent)}
                  </td>
                  <RateCell count={row.opened} value={row.rates.openRate} />
                  <RateCell count={row.clicked} value={row.rates.clickRate} />
                  <RateCell
                    count={row.replied}
                    value={row.rates.replyRate}
                    last
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

function CampaignsTable({ rows }: { rows: OutreachCampaignRow[] }) {
  return (
    <ChartCard
      icon={Send}
      title="Campañas con más alcance"
      description="Ordenadas por enviados y audiencia; cada nombre abre resultados."
    >
      {rows.length === 0 ? (
        <EmptyState text="Aún no hay campañas con métricas." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-muted-foreground border-b text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Campaña</th>
                <th className="px-3 py-3 text-right font-medium">Audiencia</th>
                <th className="px-3 py-3 text-right font-medium">Enviados</th>
                <th className="px-3 py-3 text-right font-medium">Entrega</th>
                <th className="px-3 py-3 text-right font-medium">Apertura</th>
                <th className="px-4 py-3 text-right font-medium">Clic</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/campaigns/${row.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">
                      {row.segmentName ?? "Sin segmento"} ·{" "}
                      {row.sentAt
                        ? `Enviada ${formatDateTime(row.sentAt)}`
                        : `Actualizada ${formatDateTime(row.updatedAt)}`}
                    </p>
                    <div className="mt-1">
                      <CampaignStatusBadge status={row.status} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatNumber(row.audience)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatNumber(row.sent)}
                  </td>
                  <RateCell
                    count={row.delivered}
                    value={row.rates.deliveryRate}
                  />
                  <RateCell count={row.opened} value={row.rates.openRate} />
                  <RateCell
                    count={row.clicked}
                    value={row.rates.clickRate}
                    last
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

function VariantInsightsCard({
  variants,
}: {
  variants: OutreachVariantInsight[];
}) {
  return (
    <ChartCard
      icon={MousePointerClick}
      title="Variantes A/B destacadas"
      description="Rendimiento agregado por variante en pasos de email de secuencias."
    >
      {variants.length === 0 ? (
        <EmptyState text="Aún no hay variantes con envíos registrados." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-muted-foreground border-b text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Variante</th>
                <th className="px-3 py-3 text-left font-medium">Paso</th>
                <th className="px-3 py-3 text-right font-medium">Enviados</th>
                <th className="px-3 py-3 text-right font-medium">Apertura</th>
                <th className="px-4 py-3 text-right font-medium">Clic</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variants.map((variant) => (
                <tr
                  key={`${variant.sequenceId}:${variant.stepName}:${variant.variantId}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/sequences/${variant.sequenceId}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {variant.sequenceName}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {variant.variantName}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="truncate">{variant.stepName}</p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatNumber(variant.sent)}
                  </td>
                  <RateCell count={variant.opened} value={variant.openRate} />
                  <RateCell
                    count={variant.clicked}
                    value={variant.clickRate}
                    last
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

function MetricBar({
  label,
  max,
  tone = "primary",
  value,
}: {
  label: string;
  max: number;
  tone?: "muted" | "primary";
  value: number;
}) {
  const width = value > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[92px_1fr_72px] items-center gap-2">
      <span className="text-muted-foreground truncate text-xs">{label}</span>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "primary" ? "bg-primary" : "bg-muted-foreground/45",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-right text-xs font-medium tabular-nums">
        {formatNumber(value)}
      </span>
    </div>
  );
}

function StatusGroup({
  rows,
  title,
}: {
  rows: [string, number][];
  title: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <dl className="mt-2 grid gap-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="bg-muted/60 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm"
          >
            <dt className="text-muted-foreground truncate">{label}</dt>
            <dd className="font-medium tabular-nums">{formatNumber(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RateCell({
  count,
  last,
  value,
}: {
  count: number;
  last?: boolean;
  value: number | null | undefined;
}) {
  return (
    <td className={cn("px-3 py-3 text-right tabular-nums", last && "px-4")}>
      <span className="font-medium">{formatPercent(value)}</span>
      <span className="text-muted-foreground ml-1 text-xs">
        ({formatNumber(count)})
      </span>
    </td>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-muted-foreground px-4 py-10 text-center text-sm">
      {text}
    </p>
  );
}

function StatusBadge({ status }: { status: SequenceStatus }) {
  const meta: Record<SequenceStatus, { className?: string; label: string }> = {
    active: {
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      label: "Activa",
    },
    archived: { label: "Archivada" },
    draft: { label: "Borrador" },
    paused: { label: "Pausada" },
  };
  return (
    <Badge variant="secondary" className={meta[status].className}>
      {meta[status].label}
    </Badge>
  );
}

function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const meta: Record<CampaignStatus, { className?: string; label: string }> = {
    draft: { label: "Borrador" },
    failed: { className: "bg-destructive/10 text-destructive", label: "Error" },
    paused: { label: "Pausada" },
    scheduled: {
      className: "bg-blue-500/10 text-blue-600",
      label: "Programada",
    },
    sending: { className: "bg-blue-500/10 text-blue-600", label: "Enviando" },
    sent: {
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      label: "Enviada",
    },
  };
  return (
    <Badge variant="secondary" className={meta[status].className}>
      {meta[status].label}
    </Badge>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(value);
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? "Sin datos" : `${value}%`;
}
