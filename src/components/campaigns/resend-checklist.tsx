import {
  AlertTriangle,
  Check,
  ChevronDown,
  Info,
  Megaphone,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  ResendCheckItem,
  ResendReadiness,
} from "@/server/queries/campaigns";

function StatusIcon({ item }: { item: ResendCheckItem }) {
  if (item.status === "ok") {
    return <Check className="size-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (item.status === "manual") {
    return <Info className="text-muted-foreground size-4" />;
  }
  if (item.required) {
    return <X className="text-destructive size-4" />;
  }
  return (
    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
  );
}

/**
 * Checklist de preparación de Resend para contacto masivo (Fase T.4). Render puro
 * (sin cliente): usa `<details>` nativo, abierto si falta algún requisito. No expone
 * secretos, solo estados.
 */
export function ResendChecklist({ readiness }: { readiness: ResendReadiness }) {
  const { items, ready, suppressions, delivery } = readiness;
  const missingRequired = items.filter(
    (item) => item.required && item.status === "missing",
  ).length;

  return (
    <details
      open={!ready}
      className="bg-card group overflow-hidden rounded-xl border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Megaphone className="text-muted-foreground size-4 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-medium">
              Preparación para envío masivo (Resend)
            </h2>
            <p className="text-muted-foreground text-xs">
              Qué falta para enviar a terceros con entregabilidad y RGPD.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              ready
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {ready
              ? "Listo para enviar"
              : `${missingRequired} pendiente${missingRequired === 1 ? "" : "s"}`}
          </span>
          <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t">
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-3 px-4 py-2.5">
              <span className="mt-0.5 shrink-0">
                <StatusIcon item={item} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {item.label}
                  {!item.required ? (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      recomendado
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3 text-xs">
          <span>
            Supresiones (RGPD):{" "}
            <span className="text-foreground tabular-nums">{suppressions}</span>
          </span>
          <span>
            Lotes de{" "}
            <span className="text-foreground tabular-nums">
              {delivery.batchSize}
            </span>{" "}
            · pausa{" "}
            <span className="text-foreground tabular-nums">
              {delivery.batchDelaySeconds}s
            </span>{" "}
            · máx{" "}
            <span className="text-foreground tabular-nums">
              {delivery.maxBatchesPerRun}
            </span>{" "}
            lotes/ejecución
          </span>
          <span>
            Ventana {delivery.windowStart}–{delivery.windowEnd} (
            {delivery.timeZone})
          </span>
        </div>
      </div>
    </details>
  );
}
