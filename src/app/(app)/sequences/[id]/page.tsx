import type { ComponentProps, ComponentType } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  ListChecks,
  MailCheck,
  MousePointerClick,
  Pause,
  Send,
  UserX,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type SequencePanel,
  getSequencePanel,
} from "@/server/queries/sequences";
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

export const metadata: Metadata = { title: "Panel de secuencia" };

type BadgeVariant = ComponentProps<typeof Badge>["variant"];
type SequenceStatus = SequencePanel["sequence"]["status"];
type EnrollmentStatus = SequencePanel["enrollments"][number]["status"];
type StepType = SequencePanel["sequence"]["steps"][number]["type"];
type IconComponent = ComponentType<{ className?: string }>;

const sequenceStatusMeta: Record<
  SequenceStatus,
  { label: string; variant: BadgeVariant; className?: string }
> = {
  draft: { label: "Borrador", variant: "secondary" },
  active: {
    label: "Activa",
    variant: "secondary",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  paused: { label: "Pausada", variant: "secondary" },
  archived: { label: "Archivada", variant: "outline" },
};

const enrollmentStatusMeta: Record<
  EnrollmentStatus,
  { label: string; variant: BadgeVariant; className?: string }
> = {
  active: {
    label: "Activa",
    variant: "secondary",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  paused: { label: "Pausada", variant: "outline" },
  completed: {
    label: "Completada",
    variant: "secondary",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  replied: {
    label: "Respondió",
    variant: "secondary",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  stopped: { label: "Detenida", variant: "outline" },
  bounced: { label: "Rebotó", variant: "destructive" },
  unsubscribed: {
    label: "Baja",
    variant: "secondary",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  failed: { label: "Fallida", variant: "destructive" },
};

const stepTypeLabel: Record<StepType, string> = {
  email: "Email",
  wait: "Espera",
  condition: "Condición",
  task: "Tarea",
  crm_action: "Acción CRM",
};

export default async function SequencePanelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const panel = await getSequencePanel(id);
  if (!panel) notFound();

  const { sequence, summary, metrics } = panel;
  const status = sequenceStatusMeta[sequence.status];
  const totalSteps = sequence.steps.length;

  const stepLabel = (position: number): string => {
    const step = sequence.steps[position];
    if (!step) return "—";
    const title =
      step.name.trim() || step.subject.trim() || stepTypeLabel[step.type];
    return `Paso ${position + 1}/${totalSteps} · ${title}`;
  };

  const variantByKey = new Map(
    panel.variantRows.map((row) => [`${row.stepId}:${row.variantId}`, row]),
  );
  const abSteps = sequence.steps.filter(
    (step) => step.type === "email" && step.variants.length > 0,
  );

  const rateCards = [
    {
      label: "Apertura",
      value: metrics.opened,
      base: metrics.sent,
      className: "bg-blue-500",
    },
    {
      label: "Clic",
      value: metrics.clicked,
      base: metrics.sent,
      className: "bg-violet-500",
    },
    {
      label: "Respuesta",
      value: metrics.replied,
      base: metrics.sent,
      className: "bg-emerald-500",
    },
    {
      label: "Rebote",
      value: metrics.bounced,
      base: metrics.sent,
      className: "bg-destructive",
    },
    {
      label: "Baja",
      value: metrics.unsubscribed,
      base: metrics.sent,
      className: "bg-amber-500",
    },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/sequences" />}
        >
          <ArrowLeft />
        </Button>
        <span className="text-muted-foreground text-sm">Secuencias</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {sequence.name}
            </h2>
            <Badge variant={status.variant} className={status.className}>
              {status.label}
            </Badge>
            {sequence.stopOnReply ? (
              <Badge variant="secondary">Para al responder</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            {sequence.description || "Sin descripción"}
          </p>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span>
              {sequence.channel === "resend" ? "Resend" : "Gmail 1:1"}
            </span>
            <span>
              Límite {sequence.dailyLimit}/día · {sequence.windowStart}-
              {sequence.windowEnd} ({sequence.timeZone})
            </span>
            <span>{totalSteps} pasos</span>
            <span>Actualizada {formatDateTime(sequence.updatedAt)}</span>
          </div>
        </div>

        <Button variant="outline" render={<Link href="/sequences" />}>
          <ListChecks />
          Todas las secuencias
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile icon={Users} label="Inscritos" value={summary.total} />
        <MetricTile icon={Clock} label="Activos" value={summary.active} />
        <MetricTile
          icon={CheckCircle2}
          label="Completados"
          value={summary.completed}
        />
        <MetricTile
          icon={MailCheck}
          label="Respondieron"
          value={summary.replied}
          tone="success"
        />
        <MetricTile icon={Pause} label="Pausados" value={summary.paused} />
        <MetricTile icon={Send} label="Emails enviados" value={metrics.sent} />
        <MetricTile icon={Eye} label="Aperturas" value={metrics.opened} />
        <MetricTile
          icon={MousePointerClick}
          label="Clics"
          value={metrics.clicked}
        />
        <MetricTile
          icon={UserX}
          label="Bajas"
          value={summary.unsubscribed}
          tone="warning"
        />
        <MetricTile
          icon={AlertTriangle}
          label="Rebotes"
          value={summary.bounced}
          tone="danger"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasas principales</CardTitle>
          <CardDescription>
            Calculadas sobre los {formatNumber(metrics.sent)} emails enviados por
            la secuencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rateCards.map((rate) => (
            <RateRow key={rate.label} {...rate} />
          ))}
        </CardContent>
      </Card>

      {abSteps.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variantes A/B</CardTitle>
            <CardDescription>
              Rendimiento por variante en los pasos de email con prueba A/B.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {abSteps.map((step, stepIndex) => {
              const rows = [
                {
                  key: `${step.id}:${step.id}`,
                  label: "Variante A",
                  hint: "Contenido base",
                },
                ...step.variants.map((variant, i) => ({
                  key: `${step.id}:${variant.id}`,
                  label: `Variante ${variantLetter(i)}`,
                  hint: variant.name?.trim() || `Peso ${variant.weight ?? 1}`,
                })),
              ];
              const stepPos = sequence.steps.indexOf(step);
              return (
                <div key={step.id} className="space-y-2">
                  <p className="text-sm font-medium">
                    {stepPos >= 0 ? `Paso ${stepPos + 1}` : `Email ${stepIndex + 1}`}
                    {" · "}
                    <span className="text-muted-foreground font-normal">
                      {step.subject.trim() || step.name.trim() || "Email"}
                    </span>
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variante</TableHead>
                        <TableHead className="text-right">Enviados</TableHead>
                        <TableHead className="text-right">Aperturas</TableHead>
                        <TableHead className="text-right">Clics</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const data = variantByKey.get(row.key);
                        const sent = data?.sent ?? 0;
                        const opened = data?.opened ?? 0;
                        const clicked = data?.clicked ?? 0;
                        return (
                          <TableRow key={row.key}>
                            <TableCell>
                              <p className="font-medium">{row.label}</p>
                              <p className="text-muted-foreground text-xs">
                                {row.hint}
                              </p>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(sent)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(opened)}
                              <span className="text-muted-foreground ml-1 text-xs">
                                {formatPercent(percentage(opened, sent))}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(clicked)}
                              <span className="text-muted-foreground ml-1 text-xs">
                                {formatPercent(percentage(clicked, sent))}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inscritos</CardTitle>
          <CardDescription>
            {panel.enrollmentCount > panel.enrollmentLimit
              ? `Mostrando ${panel.enrollments.length} de ${panel.enrollmentCount}.`
              : `${panel.enrollmentCount} contactos inscritos.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {panel.enrollments.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aún no hay inscritos"
              description="Inscribe contactos desde la lista de secuencias, una ficha o un segmento."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Paso actual</TableHead>
                  <TableHead>Inscrito</TableHead>
                  <TableHead>Último evento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {panel.enrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell>
                      <Link
                        href={`/contacts/${enrollment.personId}`}
                        className="hover:underline"
                      >
                        <p className="font-medium">{enrollment.personName}</p>
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {enrollment.email ?? "Sin email"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <EnrollmentStatusBadge status={enrollment.status} />
                      {enrollment.stopReason ? (
                        <p className="text-muted-foreground mt-1 max-w-48 truncate text-xs">
                          {enrollment.stopReason}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {enrollment.status === "completed"
                        ? "Completada"
                        : stepLabel(enrollment.currentStepPosition)}
                    </TableCell>
                    <TableCell>{formatDateTime(enrollment.enrolledAt)}</TableCell>
                    <TableCell>{formatDateTime(enrollment.lastEventAt)}</TableCell>
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
  tone?: "default" | "success" | "danger" | "warning";
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
            tone === "success" && "text-emerald-600 dark:text-emerald-400",
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
  className,
}: {
  label: string;
  value: number;
  base: number;
  className: string;
}) {
  const percent = percentage(value, base);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">
            {formatNumber(value)} de {formatNumber(base)}
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

function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  const meta = enrollmentStatusMeta[status];
  return (
    <Badge variant={meta.variant} className={meta.className}>
      {meta.label}
    </Badge>
  );
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

function variantLetter(alternativeIndex: number): string {
  return String.fromCharCode(66 + alternativeIndex);
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
