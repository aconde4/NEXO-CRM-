import { z } from "zod";

/** Entrada de la acción de puntuar un lead. */
export const scoreLeadSchema = z.object({
  leadId: z.string().trim().uuid("Identificador no valido"),
});
export type ScoreLeadValues = z.infer<typeof scoreLeadSchema>;

/** Entrada de la acción de puntuar en lote los leads nuevos sin puntuar. */
export const scoreNewLeadsSchema = z.object({
  /** Máximo de leads a puntuar en una pasada (acota coste/latencia). */
  limit: z.number().int().min(1).max(25).default(10),
});
export type ScoreNewLeadsValues = z.infer<typeof scoreNewLeadsSchema>;

/** Salida estructurada que debe devolver la IA al puntuar un lead. */
export const leadScoreResultSchema = z.object({
  /** Puntuación 0-100 de la calidad/intención del lead. */
  score: z.number().int().min(0).max(100),
  /** Justificación breve en una frase (se persiste en `leads.score_reason`). */
  rationale: z.string().trim().min(1).max(280),
  /** Señales concretas que explican la puntuación (se muestran tras puntuar). */
  signals: z.array(z.string().trim().min(1).max(160)).max(5),
});
export type LeadScoreResultValues = z.infer<typeof leadScoreResultSchema>;
