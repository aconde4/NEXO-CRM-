import { Bot, CheckCircle2, CircleDollarSign, XCircle } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { AIRunListItem, AIStatusView } from "@/server/queries/ai";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const statusLabel: Record<string, string> = {
  completed: "Completada",
  failed: "Con error",
  running: "En curso",
  skipped: "Omitida",
};

function formatCost(value: number): string {
  if (value <= 0) return "0 $";
  return `${value.toFixed(value < 0.01 ? 6 : 4)} $`;
}

export function AISettingsPanel({
  runs,
  status,
}: {
  runs: AIRunListItem[];
  status: AIStatusView;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" />
              IA
            </CardTitle>
            <CardDescription>
              Proveedor agnóstico, trazabilidad de uso y degradación segura.
            </CardDescription>
          </div>
          <Badge
            variant={status.configured ? "secondary" : "outline"}
            className={
              status.configured
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : undefined
            }
          >
            {status.configured ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <XCircle className="size-3.5" />
            )}
            {status.configured ? "Configurada" : "Sin configurar"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">Proveedor</p>
            <p className="truncate text-sm font-medium">
              {status.provider ?? "—"}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">Modelo</p>
            <p className="truncate text-sm font-medium">{status.model ?? "—"}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">Modelo rápido</p>
            <p className="truncate text-sm font-medium">
              {status.fastModel ?? "—"}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">Clave</p>
            <p className="text-sm font-medium">
              {status.hasApiKey ? "Configurada" : "No configurada"}
            </p>
          </div>
        </div>

        {!status.configured ? (
          <div className="border-border bg-muted/40 rounded-md border p-3 text-sm">
            {status.reason ??
              "Define AI_PROVIDER, AI_BASE_URL, AI_API_KEY y AI_MODEL en .env.local."}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="text-muted-foreground size-4" />
            <p className="text-sm font-medium">Últimas llamadas</p>
          </div>
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aún no hay llamadas registradas.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="grid gap-2 p-3 text-sm md:grid-cols-[1fr_auto_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{run.feature}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {run.provider} · {run.model} · {formatDateTime(run.createdAt)}
                    </p>
                    {run.error ? (
                      <p className="text-destructive mt-1 text-xs">{run.error}</p>
                    ) : null}
                  </div>
                  <Badge variant={run.status === "failed" ? "destructive" : "outline"}>
                    {statusLabel[run.status] ?? run.status}
                  </Badge>
                  <div className="text-muted-foreground text-xs md:text-right">
                    <p>{run.totalTokens} tokens</p>
                    <p>{formatCost(run.estimatedCostUsd)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
