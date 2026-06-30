import {
  Clock3,
  Eye,
  MousePointerClick,
  Reply,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
  SendTimeAdvice,
  SendTimeAdviceSource,
  SendTimeConfidence,
} from "@/lib/send-time-optimization";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sourceLabels: Record<SendTimeAdviceSource, string> = {
  contact: "Propia",
  default: "Por defecto",
  global: "Patrón global",
};

const confidenceLabels: Record<SendTimeConfidence, string> = {
  high: "Alta",
  low: "Baja",
  medium: "Media",
  none: "Sin datos",
};

const confidenceTone: Partial<Record<SendTimeConfidence, string>> = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
  low: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
  medium:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
};

export function SendTimeAdviceCard({
  advice,
}: {
  advice: SendTimeAdvice | null;
}) {
  if (!advice) return null;

  const buckets = advice.buckets
    .filter((bucket) => bucket.signals > 0)
    .sort((a, b) => b.score - a.score || b.replies - a.replies)
    .slice(0, 6)
    .sort((a, b) => a.hour - b.hour);
  const maxScore = Math.max(1, ...buckets.map((bucket) => bucket.score));
  const hasSignals = advice.signalCount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="text-muted-foreground size-4" />
          Hora óptima
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-3xl font-semibold tabular-nums">
              {advice.label}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {advice.timeZone}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="secondary">{sourceLabels[advice.source]}</Badge>
            <Badge
              variant="outline"
              className={cn(confidenceTone[advice.confidence])}
            >
              {confidenceLabels[advice.confidence]}
            </Badge>
          </div>
        </div>

        <p className="text-muted-foreground text-sm">{summaryFor(advice)}</p>

        <div className="grid grid-cols-3 gap-2">
          <SignalMetric
            icon={Reply}
            label="Respuestas"
            value={advice.evidence.replies}
          />
          <SignalMetric
            icon={MousePointerClick}
            label="Clics"
            value={advice.evidence.clicks}
          />
          <SignalMetric
            icon={Eye}
            label="Aperturas"
            value={advice.evidence.opens}
          />
        </div>

        {hasSignals ? (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
              <TrendingUp className="text-muted-foreground size-3.5" />
              Horas con mejor respuesta
            </div>
            <div
              className="flex h-20 items-end gap-1.5"
              aria-label="Horas destacadas"
            >
              {buckets.map((bucket) => {
                const height = Math.max(14, (bucket.score / maxScore) * 100);
                return (
                  <div
                    key={bucket.hour}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                    title={`${bucket.label}: ${bucket.signals} señales`}
                  >
                    <div
                      className={cn(
                        "bg-primary/60 w-full rounded-t-sm",
                        bucket.hour === advice.recommendedHour && "bg-primary",
                      )}
                      style={{ height: `${height}%` }}
                    />
                    <span
                      className={cn(
                        "text-muted-foreground truncate text-center text-[10px] tabular-nums",
                        bucket.hour === advice.recommendedHour &&
                          "text-foreground font-medium",
                      )}
                    >
                      {bucket.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-muted/60 rounded-md px-3 py-2 text-sm">
            Sin historial todavía. Se usará una hora conservadora.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SignalMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-muted/60 min-w-0 rounded-md px-2.5 py-2">
      <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
        <Icon className="size-3" />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function summaryFor(advice: SendTimeAdvice): string {
  if (advice.source === "contact") {
    return `${advice.signalCount} señales recientes de este contacto ponderadas por recencia.`;
  }
  if (advice.source === "global") {
    return `${advice.signalCount} señales globales usadas como referencia.`;
  }
  return "Sin señales todavía. La recomendación parte de una hora base segura.";
}
