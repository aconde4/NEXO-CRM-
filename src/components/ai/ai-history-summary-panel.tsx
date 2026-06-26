"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { HistorySummaryEntity } from "@/lib/validations/ai-history";
import { generateHistorySummary } from "@/server/actions/ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type AIStatus = {
  configured: boolean;
  model: string | null;
  provider: string | null;
  reason: string | null;
};

type SummaryResult = Awaited<ReturnType<typeof generateHistorySummary>>;

const confidenceMeta: Record<
  SummaryResult["confidence"],
  { className: string; label: string }
> = {
  high: {
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    label: "Alta",
  },
  low: {
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    label: "Baja",
  },
  medium: {
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    label: "Media",
  },
};

function formatCost(value: number): string {
  if (value <= 0) return "0 $";
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

function SectionList({
  icon: Icon,
  items,
  title,
}: {
  icon: LucideIcon;
  items: string[];
  title: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon className="text-muted-foreground size-4" />
        {title}
      </p>
      <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AIHistorySummaryPanel({
  aiStatus,
  entityId,
  entityType,
}: {
  aiStatus: AIStatus;
  entityId: string;
  entityType: HistorySummaryEntity;
}) {
  const [focus, setFocus] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<SummaryResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function runSummary() {
    if (!aiStatus.configured) {
      toast.error(aiStatus.reason ?? "La IA no esta configurada.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await generateHistorySummary({
        entityId,
        entityType,
        focus,
      });
      setSummary(result);
      toast.success(
        result.estimatedCostUsd > 0
          ? `Resumen generado (${result.model}, ${formatCost(result.estimatedCostUsd)})`
          : `Resumen generado (${result.model})`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo generar el resumen.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const confidence = summary ? confidenceMeta[summary.confidence] : null;
  const lastInteraction = summary
    ? formatDateTime(summary.lastInteractionAt)
    : null;
  const generatedAt = summary ? formatDateTime(summary.generatedAt) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" />
              Resumen IA
            </CardTitle>
            <CardDescription>
              Historial comercial sintetizado con contexto de la ficha.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={summary ? "outline" : "secondary"}
            size="sm"
            onClick={runSummary}
            disabled={loading || !aiStatus.configured}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : summary ? (
              <RefreshCw className="size-4" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {loading ? "Generando..." : summary ? "Actualizar" : "Generar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          aria-label="Enfoque del resumen"
          placeholder="Enfoque opcional: objeciones, proximos pasos, riesgo comercial..."
          className="min-h-16 resize-y"
          disabled={loading || !aiStatus.configured}
          maxLength={1000}
        />

        {!aiStatus.configured ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            {aiStatus.reason ?? "Define la configuracion de IA en .env.local."}
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

        {summary ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-medium break-words">
                  {summary.headline}
                </p>
                {confidence ? (
                  <Badge variant="secondary" className={confidence.className}>
                    <CheckCircle2 className="size-3.5" />
                    Confianza {confidence.label}
                  </Badge>
                ) : null}
              </div>
              <Textarea
                value={summary.summary}
                onChange={(event) =>
                  setSummary((current) =>
                    current
                      ? { ...current, summary: event.target.value }
                      : current,
                  )
                }
                aria-label="Resumen editable"
                className="min-h-32 resize-y"
                maxLength={2500}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionList
                icon={Lightbulb}
                title="Hechos clave"
                items={summary.keyFacts}
              />
              <SectionList
                icon={ShieldAlert}
                title="Riesgos"
                items={summary.risks}
              />
              <SectionList
                icon={CheckCircle2}
                title="Proximos pasos"
                items={summary.nextSteps}
              />
              <SectionList
                icon={HelpCircle}
                title="Preguntas abiertas"
                items={summary.openQuestions}
              />
            </div>

            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs">
              {lastInteraction ? <span>Ultima interaccion: {lastInteraction}</span> : null}
              {generatedAt ? <span>Generado: {generatedAt}</span> : null}
              <span>
                Contexto: {summary.contextStats.notes} notas -{" "}
                {summary.contextStats.activities} tareas -{" "}
                {summary.contextStats.emailMessages} emails
              </span>
              <span>
                {summary.model} - {formatCost(summary.estimatedCostUsd)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm">
            Sin resumen generado todavia.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
