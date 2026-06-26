import { z } from "zod";

/** Entrada de la acción de analizar el sentimiento de un hilo. */
export const analyzeSentimentInputSchema = z.object({
  threadId: z.string().trim().uuid("Identificador no valido"),
  /** Reanalizar también los mensajes ya clasificados. */
  reanalyze: z.boolean().optional(),
});
export type AnalyzeSentimentInputValues = z.infer<
  typeof analyzeSentimentInputSchema
>;

/** Salida estructurada que debe devolver la IA al clasificar un email entrante. */
export const messageSentimentSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]),
  /** Intención comercial detectada (para mostrar tras analizar). */
  intent: z.enum([
    "interest",
    "question",
    "objection",
    "ready_to_buy",
    "unsubscribe",
    "complaint",
    "other",
  ]),
});
export type MessageSentimentValues = z.infer<typeof messageSentimentSchema>;
