import type { ComponentProps, ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  MailCheck,
  MousePointerClick,
  Send,
  ShieldAlert,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type CampaignResults,
  getCampaignResults,
} from "@/server/queries/campaigns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Resultados de campaña" };

type BadgeVariant = ComponentProps<typeof Badge>["variant"];
type CampaignStatus = CampaignResults["campaign"]["status"];
type RecipientStatus = CampaignResults["recipients"][number]["status"];
type EventType = CampaignResults["events"][number]["type"];
type IconComponent = ComponentType<{ className?: string }>;

const campaignStatusMeta: Record<
  CampaignStatus,
  { label: string; variant: BadgeVariant; className?: string }
> = {
  draft: { label: "Borrador", variant: "secondary" },
  scheduled: { label: "Programada", variant: "default" },
  sending: { label: "Enviando", variant: "default" },
  sent: {
    label: "Enviada",
    variant: "secondary",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  paused: { label: "Pausada", variant: "secondary" },
  failed: { label: "Con error", variant: "destructive" },
};

const recipientStatusMeta: Record<
  RecipientStatus,
  { label: string; variant: BadgeVariant; className?: string }
> = {
  pending: { label: "Pendiente", variant: "outline" },
  sent: { label: "Enviado", variant: "secondary" },
  delivered: {
    label: "Entregado",
    variant: "secondary",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  opened: {
    label: "Abierto",
    variant: "secondary",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  clicked: {
    label: "Clicado",
    variant: "secondary",
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  bounced: { label: "Rebotado", variant: "destructive" },
  complained: { label: "Queja", variant: "destructive" },
  unsubscribed: {
    label: "Baja",
    variant: "secondary",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  suppressed: { label: "Suprimido", variant: "outline" },
  failed: { label: "Fallido", variant: "destructive" },
};

const eventMeta: Record<
  EventType,
  { label: string; icon: IconComponent; className: string }
> = {
  delivery_delayed: {
    label: "Entrega retrasada",
    icon: Clock,
    className: "text-amber-600 dark:text-amber-400",
  },
  queued: {
    label: "En cola",
    icon: CalendarClock,
    className: "text-muted-foreground",
  },
  sent: { label: "Enviado", icon: Send, className: "text-blue-600" },
  delivered: {
    label: "Entregado",
    icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  failed: { label: "Fallido", icon: XCircle, className: "text-destructive" },
  open: { label: "Apertura", icon: Eye, className: "text-blue-600" },
  click: {
    label: "Clic",
    icon: MousePointerClick,
    className: "text-violet-600 dark:text-violet-400",
  },
  bounce: {
    label: "Rebote",
    icon: AlertTriangle,
    className: "text-destructive",
  },
  complaint: {
    label: "Queja",
    icon: ShieldAlert,
    className: "text-destructive",
  },
  suppressed: {
    label: "Suprimido",
    icon: Ban,
    className: "text-muted-foreground",
  },
  unsubscribe: {
    label: "Baja",
    icon: UserX,
    className: "text-amber-700 dark:text-amber-400",
  },
  reply: { label: "Respuesta", icon: MailCheck, className: "text-emerald-600" },
  sync: {
    label: "Sincronización",
    icon: BarChart3,
    className: "text-blue-600",
  },
};

export default async function CampaignResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const results = await getCampaignResults(id);
  if (!results) notFound();

  const { campaign } = results;
  const stats = campaign.stats;
  const status = campaignStatusMeta[campaign.status];
  const rateCards = [
    {
      label: "Entrega",
      value: stats.delivered ?? 0,
      base: stats.sent ?? 0,
      baseLabel: "de enviados",
      className: "bg-emerald-500",
    },
    {
      label: "Apertura",
      value: stats.opened ?? 0,
      base: stats.delivered ?? stats.sent ?? 0,
      baseLabel: "de entregados",
      className: "bg-blue-500",
    },
    {
      label: "Clic",
      value: stats.clicked ?? 0,
      base: stats.opened ?? stats.delivered ?? 0,
      baseLabel: "de abiertos",
      className: "bg-violet-500",
    },
    {
      label: "Rebote",
      value: stats.bounced ?? 0,
      base: stats.sent ?? 0,
      baseLabel: "de enviados",
      className: "bg-destructive",
    },
    {
      label: "Baja",
      value: stats.unsubscribed ?? 0,
      base: stats.sent ?? 0,
      baseLabel: "de enviados",
      className: "bg-amber-500",
    },
    {
      label: "Queja",
      value: stats.complained ?? 0,
      base: stats.sent ?? 0,
      baseLabel: "de enviados",
      className: "bg-destructive",
    },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/campaigns" />}
        >
          <ArrowLeft />
        </Button>
        <span className="text-muted-foreground text-sm">Campañas</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {campaign.name}
            </h2>
            <Badge variant={status.variant} className={status.className}>
              {status.label}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            {campaign.subject || "Sin asunto"}
          </p>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span>{campaign.segmentName ?? "Sin segmento"}</span>
            {campaign.sentAt ? (
              <span>Enviada {formatDateTime(campaign.sentAt)}</span>
            ) : null}
            {campaign.scheduledAt ? (
              <span>Programada {formatDateTime(campaign.scheduledAt)}</span>
            ) : null}
            <span>Actualizada {formatDateTime(campaign.updatedAt)}</span>
          </div>
        </div>

        <Button variant="outline" render={<Link href="/campaigns" />}>
          <BarChart3 />
          Todas las campañas
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile icon={Users} label="Audiencia" value={stats.audience} />
        <MetricTile icon={Send} label="Enviados" value={stats.sent} />
        <MetricTile
          icon={CheckCircle2}
          label="Entregados"
          value={stats.delivered}
        />
        <MetricTile icon={Eye} label="Aperturas" value={stats.opened} />
        <MetricTile
          icon={MousePointerClick}
          label="Clics"
          value={stats.clicked}
        />
        <MetricTile
          icon={AlertTriangle}
          label="Rebotes"
          value={stats.bounced}
          tone="danger"
        />
        <MetricTile
          icon={ShieldAlert}
          label="Quejas"
          value={stats.complained}
          tone="danger"
        />
        <MetricTile
          icon={UserX}
          label="Bajas"
          value={stats.unsubscribed}
          tone="warning"
        />
        <MetricTile
          icon={Ban}
          label="Suprimidos"
          value={stats.suppressed}
          tone="muted"
        />
        <MetricTile
          icon={XCircle}
          label="Fallidos"
          value={stats.failed}
          tone="danger"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasas principales</CardTitle>
            <CardDescription>
              Calculadas sobre los destinatarios reales de la campaña.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {rateCards.map((rate) => (
              <RateRow key={rate.label} {...rate} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración</CardTitle>
            <CardDescription>Origen y respuesta de la campaña.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoLine label="De">
              {campaign.fromName || campaign.fromEmail ? (
                <>
                  {campaign.fromName || "Sin nombre"}{" "}
                  {campaign.fromEmail ? (
                    <span className="text-muted-foreground">
                      &lt;{campaign.fromEmail}&gt;
                    </span>
                  ) : null}
                </>
              ) : (
                "No configurado"
              )}
            </InfoLine>
            <InfoLine label="Responder a">
              {campaign.replyTo || campaign.fromEmail || "No configurado"}
            </InfoLine>
            <InfoLine label="Preheader">
              {campaign.preheader || "Sin preheader"}
            </InfoLine>
            <InfoLine label="Proveedor">Resend</InfoLine>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Destinatarios</CardTitle>
          <CardDescription>
            {results.recipientCount > results.recipientLimit
              ? `Mostrando ${results.recipients.length} de ${results.recipientCount}.`
              : `${results.recipientCount} destinatarios preparados.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.recipients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aún no hay destinatarios"
              description="Envía o programa la campaña para preparar la audiencia del segmento."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead>Entregado</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Clic</TableHead>
                  <TableHead>Incidencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.recipients.map((recipient) => (
                  <TableRow key={recipient.id}>
                    <TableCell>
                      <div className="min-w-56">
                        <p className="font-medium">{recipient.name ?? "-"}</p>
                        <p className="text-muted-foreground text-xs">
                          {recipient.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RecipientStatusBadge status={recipient.status} />
                    </TableCell>
                    <TableCell>{formatDateTime(recipient.sentAt)}</TableCell>
                    <TableCell>
                      {formatDateTime(recipient.deliveredAt)}
                    </TableCell>
                    <TableCell>{formatDateTime(recipient.openedAt)}</TableCell>
                    <TableCell>{formatDateTime(recipient.clickedAt)}</TableCell>
                    <TableCell>
                      <IssueCell recipient={recipient} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos recientes</CardTitle>
          <CardDescription>
            {results.eventCount > results.eventLimit
              ? `Mostrando ${results.events.length} de ${results.eventCount} eventos.`
              : `${results.eventCount} eventos registrados por Resend.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.events.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Aún no hay eventos"
              description="Los webhooks de Resend aparecerán aquí cuando lleguen aperturas, clics, rebotes o bajas."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <EventLabel type={event.type} meta={event.meta} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {event.recipientEmail ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <EventDetail event={event} />
                    </TableCell>
                    <TableCell>{formatDateTime(event.occurredAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: IconComponent;
  label: string;
  value: number | undefined;
  tone?: "default" | "danger" | "warning" | "muted";
}) {
  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs">{label}</span>
        <Icon
          className={cn(
            "size-4",
            tone === "danger" && "text-destructive",
            tone === "warning" && "text-amber-600 dark:text-amber-400",
            tone === "muted" && "text-muted-foreground",
            tone === "default" && "text-primary",
          )}
        />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function RateRow({
  label,
  value,
  base,
  baseLabel,
  className,
}: {
  label: string;
  value: number;
  base: number;
  baseLabel: string;
  className: string;
}) {
  const percent = percentage(value, base);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">
            {formatNumber(value)} {baseLabel}
          </p>
        </div>
        <span className="font-mono text-sm">{formatPercent(percent)}</span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", className)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function InfoLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="font-medium break-words">{children}</div>
    </div>
  );
}

function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  const meta = recipientStatusMeta[status];
  return (
    <Badge variant={meta.variant} className={meta.className}>
      {meta.label}
    </Badge>
  );
}

function IssueCell({
  recipient,
}: {
  recipient: CampaignResults["recipients"][number];
}) {
  if (recipient.error) {
    return (
      <span className="text-destructive max-w-72 truncate text-xs">
        {recipient.error}
      </span>
    );
  }
  if (recipient.bouncedAt) return formatDateTime(recipient.bouncedAt);
  if (recipient.unsubscribedAt) return formatDateTime(recipient.unsubscribedAt);
  return <span className="text-muted-foreground">-</span>;
}

function EventLabel({
  type,
  meta,
}: {
  type: EventType;
  meta: Record<string, unknown>;
}) {
  const event = eventMeta[type];
  const Icon = event.icon;
  const rawType = typeof meta.rawType === "string" ? meta.rawType : null;
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("size-4", event.className)} />
      <div>
        <p className="font-medium">{event.label}</p>
        {rawType ? (
          <p className="text-muted-foreground text-xs">{rawType}</p>
        ) : null}
      </div>
    </div>
  );
}

function EventDetail({ event }: { event: CampaignResults["events"][number] }) {
  if (event.url) {
    return (
      <a
        href={event.url}
        target="_blank"
        rel="noreferrer"
        className="hover:text-foreground text-muted-foreground inline-flex max-w-96 items-center gap-1 truncate text-sm underline-offset-2 hover:underline"
      >
        <span className="truncate">{event.url}</span>
        <ExternalLink className="size-3.5 shrink-0" />
      </a>
    );
  }
  if (event.providerEventId) {
    return (
      <span className="text-muted-foreground font-mono text-xs">
        {event.providerEventId}
      </span>
    );
  }
  return <span className="text-muted-foreground">-</span>;
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: IconComponent;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="bg-muted flex size-11 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground max-w-xl text-sm">{description}</p>
      </div>
    </div>
  );
}

function percentage(value: number, base: number): number {
  if (base <= 0) return 0;
  return (value / base) * 100;
}

function formatPercent(value: number): string {
  return (
    new Intl.NumberFormat("es-ES", {
      maximumFractionDigits: value >= 10 ? 0 : 1,
    }).format(value) + "%"
  );
}

function formatNumber(value: number | undefined): string {
  return new Intl.NumberFormat("es-ES").format(value ?? 0);
}
