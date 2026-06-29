import {
  AlertTriangle,
  Check,
  ChevronDown,
  Gauge,
  Info,
  ShieldCheck,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  DeliverabilityAudit,
  DeliverabilityAuditItem,
  DeliverabilityAuditStatus,
} from "@/server/queries/campaigns";

const STATUS_LABELS: Record<DeliverabilityAuditStatus, string> = {
  manual: "Manual",
  missing: "Bloqueo",
  ok: "OK",
  warning: "Aviso",
};

function StatusIcon({ status }: { status: DeliverabilityAuditStatus }) {
  if (status === "ok") {
    return <Check className="size-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === "missing") {
    return <X className="text-destructive size-4" />;
  }
  if (status === "manual") {
    return <Info className="text-muted-foreground size-4" />;
  }
  return (
    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
  );
}

function StatusPill({ status }: { status: DeliverabilityAuditStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "ok" &&
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        status === "missing" && "bg-destructive/10 text-destructive",
        status === "warning" &&
          "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        status === "manual" && "bg-muted text-muted-foreground",
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function AuditItemRow({ item }: { item: DeliverabilityAuditItem }) {
  return (
    <li className="flex gap-3 py-2.5">
      <span className="mt-0.5 shrink-0">
        <StatusIcon status={item.status} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{item.label}</p>
          <StatusPill status={item.status} />
          {!item.required ? (
            <span className="text-muted-foreground text-xs">recomendado</span>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs leading-5">
          {item.detail}
        </p>
      </div>
    </li>
  );
}

export function DeliverabilityAuditPanel({
  audit,
}: {
  audit: DeliverabilityAudit;
}) {
  const blocking = audit.summary.missing;
  const needsAttention =
    audit.summary.missing + audit.summary.warning + audit.summary.manual;

  return (
    <details
      open={!audit.ready}
      className="bg-card group overflow-hidden rounded-xl border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="text-muted-foreground size-4 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-medium">
              Auditoría de entregabilidad y cumplimiento
            </h2>
            <p className="text-muted-foreground text-xs">
              Gmail para 1:1, Resend para volumen, RGPD, bajas, rebotes y
              calentamiento.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              audit.ready
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {audit.ready
              ? `${needsAttention} revisión${needsAttention === 1 ? "" : "es"}`
              : `${blocking} bloqueo${blocking === 1 ? "" : "s"}`}
          </span>
          <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t">
        <div className="grid gap-0 md:grid-cols-4">
          {audit.sections.map((section) => (
            <section
              key={section.key}
              className="border-t px-4 py-4 first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0"
            >
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                {section.description}
              </p>
              <ul className="mt-3 divide-y">
                {section.items.map((item) => (
                  <AuditItemRow key={item.key} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-3 text-xs">
          <span className="flex items-center gap-1.5">
            <Gauge className="size-3.5" />
            Envío masivo: lotes de{" "}
            <span className="text-foreground tabular-nums">
              {audit.resend.delivery.batchSize}
            </span>
            , pausa{" "}
            <span className="text-foreground tabular-nums">
              {audit.resend.delivery.batchDelaySeconds}s
            </span>
            , ventana {audit.resend.delivery.windowStart}-
            {audit.resend.delivery.windowEnd}
          </span>
          <span>
            OK:{" "}
            <span className="text-foreground tabular-nums">
              {audit.summary.ok}
            </span>
          </span>
          <span>
            Avisos:{" "}
            <span className="text-foreground tabular-nums">
              {audit.summary.warning}
            </span>
          </span>
          <span>
            Manual:{" "}
            <span className="text-foreground tabular-nums">
              {audit.summary.manual}
            </span>
          </span>
        </div>
      </div>
    </details>
  );
}
