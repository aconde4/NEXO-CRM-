import { z } from "zod";

/** Entrada de la acción de sugerir la siguiente mejor acción de un negocio. */
export const nextBestActionInputSchema = z.object({
  dealId: z.string().trim().uuid("Identificador no valido"),
});
export type NextBestActionInputValues = z.infer<typeof nextBestActionInputSchema>;

/** Salida estructurada que debe devolver la IA. Coincide con `DealNextBestAction`. */
export const nextBestActionResultSchema = z.object({
  /** La acción concreta recomendada (imperativa, una frase). */
  action: z.string().trim().min(1).max(160),
  /** Por qué es la mejor acción ahora, según el contexto. */
  reason: z.string().trim().min(1).max(600),
  /** Urgencia/plazo sugerido. */
  urgency: z.enum(["low", "medium", "high"]),
  /** Pasos concretos para ejecutarla. */
  steps: z.array(z.string().trim().min(1).max(200)).max(5),
  /** Confianza de la recomendación según la información disponible. */
  confidence: z.enum(["low", "medium", "high"]),
});
export type NextBestActionResultValues = z.infer<typeof nextBestActionResultSchema>;
