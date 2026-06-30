import {
  Activity,
  AlertTriangle,
  Ban,
  Eye,
  Link2,
  MailCheck,
  MousePointerClick,
  Reply,
  Send,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ChartCard } from "@/components/analytics/chart-card";
import { StatCard } from "@/components/stat-card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  EmailPerformance,
  EmailPerformanceChannel,
  EmailPerformanceDayPoint,
  EmailPerformanceRecentSignal,
  EmailPerformanceTopLink,
} from "@/server/queries/analytics";
import type { EmailEventType } from "@/server/db/schema";

export function EmailPerformanceReport({
  performance,
}: {
  performance: EmailPerformance;
}) {
  return (
    <div className="flex flex-col gap-4">
      <EmailPerformanceKpis performance={performance} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <EmailActivityCard data={performance.activityByDay} />
        <ChannelBreakdownCard channels={performance.channels} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TopLinksCard links={performance.topLinks} />
        <RecentSignalsCard signals={performance.recentSignals} />
      </div>
    </div>
  );
}

function EmailPerformanceKpis({
  performance,
}: {
  performance: EmailPerformance;
}) {
  const { rates, totals } = performance;
  const stats: {
    hint: string;
    icon: LucideIcon;
    label: string;
    value: string;
  }[] = [
    {
      hint: `${totals.delivered} entregados · ${totals.failed} fallidos`,
      icon: Send,
      label: "Enviados",
      value: String(totals.sent),
    },
    {
      hint: `${totals.opened} destinatarios/mensajes únicos`,
      icon: Eye,
      label: "Apertura",
      value: formatPercent(rates.openRate),
    },
    {
      hint: `${totals.clicked} destinatarios/mensajes únicos`,
      icon: MousePointerClick,
      label: "Clic",
      value: formatPercent(rates.clickRate),
    },
    {
      hint: `${totals.replied} respuestas detectadas`,
      icon: Reply,
      label: "Respuesta",
      value: formatPercent(rates.replyRate),
    },
    {
      hint: `${totals.unsubscribed} bajas registradas`,
      icon: Ban,
      label: "Bajas",
      value: formatPercent(rates.unsubscribeRate),
    },
    {
      hint: `${totals.bounced} rebotes, quejas o supresiones`,
      icon: AlertTriangle,
      label: "Rebotes/quejas",
      value: formatPercent(rates.bounceRate),
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </section>
  );
}

function EmailActivityCard({ data }: { data: EmailPerformanceDayPoint[] }) {
  const max = Math.max(
    1,
    ...data.map((point) => Math.max(point.sent, point.totalSignals)),
  );
  const hasData = data.some(
    (point) => point.sent > 0 || point.totalSignals > 0,
  );

  return (
    <ChartCard
      icon={Activity}
      title="Actividad diaria"
      description={`Envíos y señales de interacción en los últimos ${data.length} días.`}
    >
      {!hasData ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          No hay actividad de email reciente.
        </p>
      ) : (
        <div className="px-4 py-4">
          <div className="flex items-end gap-1.5" style={{ height: 156 }}>
            {data.map((point) => {
              const sentHeight =
                point.sent > 0 ? Math.max(4, (point.sent / max) * 100) : 0;
              const signalHeight =
                point.totalSignals > 0
                  ? Math.max(4, (point.totalSignals / max) * 100)
                  : 0;
              return (
                <div
                  key={point.key}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                  title={`${point.label}: ${point.sent} enviados · ${point.opened} aperturas · ${point.clicked} clics · ${point.replied} respuestas`}
                >
                  <div className="flex h-full items-end justify-center gap-0.5">
                    <div
                      className="bg-primary/35 w-full max-w-3 rounded-t-sm"
                      style={{ height: `${sentHeight}%` }}
                    />
                    <div
                      className="bg-primary w-full max-w-3 rounded-t-sm"
                      style={{ height: `${signalHeight}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {data.map((point) => (
              <div
                key={point.key}
                className="text-muted-foreground min-w-0 flex-1 truncate text-center text-[10px]"
              >
                {point.label}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <LegendItem className="bg-primary/35" label="Enviados" />
            <LegendItem className="bg-primary" label="Señales" />
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function ChannelBreakdownCard({
  channels,
}: {
  channels: EmailPerformanceChannel[];
}) {
  return (
    <ChartCard
      icon={MailCheck}
      title="Rendimiento por canal"
      description="Conteos únicos para evitar inflar aperturas y clics repetidos."
    >
      {channels.length === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          Todavía no hay canales con actividad en el periodo.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-muted-foreground border-b text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Canal</th>
                <th className="px-3 py-3 text-right font-medium">Enviados</th>
                <th className="px-3 py-3 text-right font-medium">Apertura</th>
                <th className="px-3 py-3 text-right font-medium">Clic</th>
                <th className="px-3 py-3 text-right font-medium">Respuesta</th>
                <th className="px-3 py-3 text-right font-medium">Bajas</th>
                <th className="px-4 py-3 text-right font-medium">Rebotes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {channels.map((channel) => (
                <tr key={channel.key}>
                  <td className="px-4 py-3 font-medium">{channel.label}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {channel.counts.sent}
                  </td>
                  <RateCell
                    count={channel.counts.opened}
                    value={channel.rates.openRate}
                  />
                  <RateCell
                    count={channel.counts.clicked}
                    value={channel.rates.clickRate}
                  />
                  <RateCell
                    count={channel.counts.replied}
                    value={channel.rates.replyRate}
                  />
                  <RateCell
                    count={channel.counts.unsubscribed}
                    value={channel.rates.unsubscribeRate}
                  />
                  <RateCell
                    count={channel.counts.bounced}
                    value={channel.rates.bounceRate}
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

function TopLinksCard({ links }: { links: EmailPerformanceTopLink[] }) {
  return (
    <ChartCard
      icon={Link2}
      title="Enlaces más clicados"
      description="URLs con más clics registrados por tracking."
    >
      {links.length === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          No hay clics en enlaces durante el periodo.
        </p>
      ) : (
        <ol className="divide-y">
          {links.map((link, index) => (
            <li
              key={link.url}
              className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {index + 1}. {shortUrl(link.url)}
                </p>
                <p
                  className="text-muted-foreground truncate text-xs"
                  title={link.url}
                >
                  {link.url}
                </p>
              </div>
              <div className="text-right text-sm tabular-nums">
                <p className="font-semibold">{link.clicks} clics</p>
                <p className="text-muted-foreground text-xs">
                  {link.uniqueRecipients} únicos
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  );
}

function RecentSignalsCard({
  signals,
}: {
  signals: EmailPerformanceRecentSignal[];
}) {
  return (
    <ChartCard
      icon={Activity}
      title="Señales recientes"
      description="Últimas aperturas, clics, respuestas, bajas e incidencias."
    >
      {signals.length === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          No hay señales recientes en el periodo.
        </p>
      ) : (
        <ol className="divide-y">
          {signals.map((signal) => (
            <li
              key={signal.id}
              className="grid gap-2 px-4 py-3 sm:grid-cols-[128px_1fr_auto]"
            >
              <span
                className={cn(
                  "inline-flex h-6 w-fit items-center rounded-md px-2 text-xs font-medium",
                  signalTone(signal.type),
                )}
              >
                {signalLabel(signal.type)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {signal.recipientEmail ?? "Sin destinatario"}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {signal.channelLabel}
                  {signal.url ? ` · ${shortUrl(signal.url)}` : ""}
                </p>
              </div>
              <p className="text-muted-foreground text-sm tabular-nums">
                {formatDateTime(signal.occurredAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  );
}

function LegendItem({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-sm", className)} />
      {label}
    </span>
  );
}

function RateCell({
  count,
  last,
  value,
}: {
  count: number;
  last?: boolean;
  value: number | null;
}) {
  return (
    <td className={cn("px-3 py-3 text-right tabular-nums", last && "px-4")}>
      <span className="font-medium">{formatPercent(value)}</span>
      <span className="text-muted-foreground ml-1 text-xs">({count})</span>
    </td>
  );
}

function formatPercent(value: number | null): string {
  return value == null ? "Sin datos" : `${value}%`;
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function signalLabel(type: EmailEventType): string {
  switch (type) {
    case "open":
      return "Apertura";
    case "click":
      return "Clic";
    case "reply":
      return "Respuesta";
    case "unsubscribe":
      return "Baja";
    case "bounce":
      return "Rebote";
    case "complaint":
      return "Queja";
    case "suppressed":
      return "Supresión";
    case "failed":
      return "Fallo";
    default:
      return "Evento";
  }
}

function signalTone(type: EmailEventType): string {
  switch (type) {
    case "reply":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "open":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "click":
      return "bg-primary/10 text-primary";
    case "unsubscribe":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "bounce":
    case "complaint":
    case "suppressed":
    case "failed":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}
