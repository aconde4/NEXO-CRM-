import { z } from "zod";

export const historySummaryEntitySchema = z.enum(["person", "deal"]);

export const generateHistorySummarySchema = z.object({
  entityId: z.string().trim().uuid("Identificador no valido"),
  entityType: historySummaryEntitySchema,
  focus: z.string().trim().max(1_000).optional(),
});

const summaryItemSchema = z.string().trim().min(1).max(280);

export const generatedHistorySummarySchema = z.object({
  confidence: z.enum(["low", "medium", "high"]),
  headline: z.string().trim().min(1).max(160),
  keyFacts: z.array(summaryItemSchema).max(8),
  lastInteractionAt: z.string().trim().max(40).nullable(),
  nextSteps: z.array(summaryItemSchema).max(6),
  openQuestions: z.array(summaryItemSchema).max(6),
  risks: z.array(summaryItemSchema).max(6),
  summary: z.string().trim().min(1).max(2_500),
});

export type HistorySummaryEntity = z.infer<typeof historySummaryEntitySchema>;
export type GenerateHistorySummaryValues = z.infer<
  typeof generateHistorySummarySchema
>;
export type GeneratedHistorySummaryValues = z.infer<
  typeof generatedHistorySummarySchema
>;
