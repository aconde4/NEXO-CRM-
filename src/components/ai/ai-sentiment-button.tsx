"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, SmilePlus } from "lucide-react";
import { toast } from "sonner";

import { analyzeSentiment } from "@/server/actions/ai";
import { Button } from "@/components/ui/button";

type AIStatus = {
  configured: boolean;
  reason: string | null;
};

export function AISentimentButton({
  threadId,
  aiStatus,
  inboundCount,
  unanalyzedCount,
}: {
  threadId: string;
  aiStatus: AIStatus;
  inboundCount: number;
  unanalyzedCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  if (inboundCount === 0) return null;

  const reanalyze = unanalyzedCount === 0;

  async function run() {
    if (loading) return;
    if (!aiStatus.configured) {
      toast.error(aiStatus.reason ?? "La IA no esta configurada.");
      return;
    }
    setLoading(true);
    try {
      const result = await analyzeSentiment({ threadId, reanalyze });
      if (result.total === 0) {
        toast.info("No hay emails entrantes que analizar.");
      } else {
        const { positive, neutral, negative } = result.counts;
        toast.success(
          `Analizados ${result.analyzed}/${result.total} · ` +
            `${positive} 👍 · ${neutral} 😐 · ${negative} 👎` +
            (result.failed ? ` (${result.failed} con error)` : ""),
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo analizar",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={run}
      disabled={loading || !aiStatus.configured}
      title={
        aiStatus.configured
          ? "Clasifica el sentimiento de los emails recibidos"
          : (aiStatus.reason ?? "IA no configurada")
      }
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <SmilePlus className="size-4" />
      )}
      {loading
        ? "Analizando…"
        : reanalyze
          ? "Reanalizar sentimiento"
          : "Analizar sentimiento"}
    </Button>
  );
}
