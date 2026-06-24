import type { ComponentProps } from "react";

import { getTriggerMeta } from "@/lib/automations";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AutomationRunItem } from "@/server/queries/automations";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const runStatusMeta: Record<
  AutomationRunItem["status"],
  { label: string; variant: BadgeVariant; className?: string }
> = {
  running: { label: "En curso", variant: "secondary" },
  waiting: { label: "En espera", variant: "outline" },
  completed: {
    label: "Completada",
    variant: "secondary",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  failed: { label: "Con error", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "outline" },
};

const logStatusClass: Record<string, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  skipped: "text-muted-foreground",
  waiting: "text-amber-600 dark:text-amber-400",
  failed: "text-destructive",
};

export function AutomationRuns({ runs }: { runs: AutomationRunItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ejecuciones recientes</CardTitle>
        <CardDescription>
          Cada vez que el disparador ocurre, se registra aquí lo que hizo el flujo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aún no hay ejecuciones. Activa la automatización y provoca su
            disparador para verlas aquí.
          </p>
        ) : (
          <div className="divide-y">
            {runs.map((run) => {
              const status = runStatusMeta[run.status];
              const trigger = getTriggerMeta(run.triggerType);
              return (
                <div key={run.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={status.variant} className={status.className}>
                      {status.label}
                    </Badge>
                    <span className="text-sm font-medium">
                      {trigger?.label ?? run.triggerType ?? "Disparador"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(run.startedAt)}
                      {run.finishedAt
                        ? ` · fin ${formatDateTime(run.finishedAt)}`
                        : ""}
                    </span>
                  </div>

                  {run.error ? (
                    <p className="text-destructive mt-1 text-xs">{run.error}</p>
                  ) : null}

                  {run.log.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {run.log.map((entry, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs"
                        >
                          <span
                            className={cn(
                              "font-medium",
                              logStatusClass[entry.status] ??
                                "text-muted-foreground",
                            )}
                          >
                            {entry.status}
                          </span>
                          <span className="text-muted-foreground">
                            {entry.message ?? entry.kind}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
