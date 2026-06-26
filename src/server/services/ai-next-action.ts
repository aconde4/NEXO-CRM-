import "server-only";

import { and, eq } from "drizzle-orm";

import {
  nextBestActionResultSchema,
  type NextBestActionResultValues,
} from "@/lib/validations/ai-next-action";
import { completeAI } from "@/server/services/ai";
import { buildDealContext } from "@/server/services/ai-history-summary";
import { db } from "@/server/db";
import { deals } from "@/server/db/schema";

export type NextBestActionResult = NextBestActionResultValues & {
  dealId: string;
  generatedAt: string;
  estimatedCostUsd: number;
  model: string;
  provider: string;
  runId: string;
};

function systemPrompt(): string {
  return [
    "Eres un director comercial B2B dentro de Nexo CRM.",
    "A partir del contexto de un negocio, recomienda la UNICA siguiente mejor accion para hacerlo avanzar.",
    "Usa solo hechos del contexto: etapa, interacciones recientes, emails, tareas, objeciones, plazos y riesgos. No inventes.",
    "La accion debe ser concreta, imperativa y ejecutable ya (p. ej. 'Enviar propuesta revisada con el descuento acordado').",
    "Calibra la urgencia (low/medium/high) por el riesgo de estancamiento y los plazos, y la confianza por la informacion disponible.",
    "Si hay poca informacion, propon una accion de descubrimiento y marca confianza baja.",
    "Devuelve EXCLUSIVAMENTE JSON valido que cumpla el esquema indicado, en espanol profesional y accionable.",
  ].join("\n");
}

export async function generateNextBestAction(
  ownerId: string,
  dealId: string,
): Promise<NextBestActionResult> {
  const context = await buildDealContext(ownerId, dealId);

  const result = await completeAI<NextBestActionResultValues>({
    feature: "deal.next_best_action",
    maxTokens: 700,
    messages: [{ content: context.prompt, role: "user" }],
    modelPreference: "quality",
    ownerId,
    requestSummary: { ...context.contextStats },
    schema: nextBestActionResultSchema,
    schemaName: "next_best_action",
    system: systemPrompt(),
    temperature: 0.2,
  });

  if (!result.data) {
    throw new Error("La IA no devolvio una accion valida.");
  }

  const generatedAt = new Date();
  await db
    .update(deals)
    .set({ nextBestAction: result.data, nextBestActionAt: generatedAt })
    .where(and(eq(deals.id, dealId), eq(deals.ownerId, ownerId)));

  return {
    ...result.data,
    dealId,
    estimatedCostUsd: result.estimatedCostUsd,
    generatedAt: generatedAt.toISOString(),
    model: result.model,
    provider: result.provider,
    runId: result.runId,
  };
}
