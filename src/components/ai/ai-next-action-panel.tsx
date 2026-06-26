"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Loader2,
  RefreshCw,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { suggestNextBestAction } from "@/server/actions/ai";
import type { DealNextBestAction } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AIStatus = {
  configured: boolean;
  model: string | null;
  provider: string | null;
  reason: string | null;
};

type CurrentAction = DealNextBestAction & {
  generatedAt: string | null;
  model?: string;
  estimatedCostUsd?: number;
};

const urgencyMeta: Record<
  DealNextBestAction["urgency"],
  { className: string; label: string }
> = {
  high: { className: "bg-destructive/10 text-destructive", label: "Urgencia alta" },
  low: {
    className: "bg-muted text-muted-foreground",
    label: "Urgencia baja",
  },
  medium: {
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    label: "Urgencia media",
  },
};

const confidenceLabel: Record<DealNextBestAction["confidence"], string> = {
  high: "Confianza alta",
  low: "Confianza baja",
  medium: "Confianza media",
};

function formatCost(value: number | undefined): string | null {
  if (!value || value <= 0) return null;
  return `${value.toFixed(value < 0.01 ? 6 : 4)} $`;
}

function formatDateTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function AINextActionPanel({
  aiStatus,
  dealId,
  initialAction,
}: {
  aiStatus: AIStatus;
  dealId: string;
  initialAction: CurrentAction | null;
}) {
  const [current, setCurrent] = React.useState<CurrentAction | null>(
    initialAction,
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    if (!aiStatus.configured) {
      toast.error(aiStatus.reason ?? "La IA no esta configurada.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await suggestNextBestAction({ dealId });
      setCurrent({
        action: result.action,
        confidence: result.confidence,
        estimatedCostUsd: result.estimatedCostUsd,
        generatedAt: result.generatedAt,
        model: result.model,
        reason: result.reason,
        steps: result.steps,
        urgency: result.urgency,
      });
      toast.success(
        formatCost(result.estimatedCostUsd)
          ? `Acción sugerida (${result.model}, ${formatCost(result.estimatedCostUsd)})`
          : `Acción sugerida (${result.model})`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo sugerir la acción.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const urgency = current ? urgencyMeta[current.urgency] : null;
  const generatedAt = current ? formatDateTime(current.generatedAt) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4" />
              Siguiente mejor acción
            </CardTitle>
            <CardDescription>
              Recomendación de IA para hacer avanzar el negocio.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={current ? "outline" : "secondary"}
            size="sm"
            onClick={run}
            disabled={loading || !aiStatus.configured}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : current ? (
              <RefreshCw className="size-4" />
            ) : (
              <Target className="size-4" />
            )}
            {loading ? "Pensando..." : current ? "Actualizar" : "Sugerir"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!aiStatus.configured ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            {aiStatus.reason ?? "Define la configuración de IA en .env.local."}
          </div>
        ) : aiStatus.provider && aiStatus.model ? (
          <p className="text-muted-foreground text-xs">
            IA: {aiStatus.provider} - {aiStatus.model}
          </p>
        ) : null}

        {error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive flex gap-2 rounded-lg border px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        ) : null}

        {current ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-medium break-words">{current.action}</p>
              {urgency ? (
                <Badge variant="secondary" className={urgency.className}>
                  {urgency.label}
                </Badge>
              ) : null}
              <Badge variant="outline">
                <CheckCircle2 className="size-3.5" />
                {confidenceLabel[current.confidence]}
              </Badge>
            </div>

            <p className="text-muted-foreground text-sm break-words">
              {current.reason}
            </p>

            {current.steps.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ListChecks className="text-muted-foreground size-4" />
                  Cómo ejecutarla
                </p>
                <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
                  {current.steps.map((step, index) => (
                    <li key={index} className="break-words">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs">
              {generatedAt ? <span>Sugerido: {generatedAt}</span> : null}
              {current.model ? (
                <span>
                  {current.model}
                  {formatCost(current.estimatedCostUsd)
                    ? ` - ${formatCost(current.estimatedCostUsd)}`
                    : ""}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm">
            Sin recomendación todavía.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
