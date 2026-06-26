"use server";

import { requireUser } from "@/lib/session";
import {
  generateHistorySummarySchema,
  type GenerateHistorySummaryValues,
} from "@/lib/validations/ai-history";
import { generateAIHistorySummary } from "@/server/services/ai-history-summary";

export async function generateHistorySummary(
  raw: GenerateHistorySummaryValues,
) {
  const user = await requireUser();
  const data = generateHistorySummarySchema.parse(raw);
  return generateAIHistorySummary(user.id, data);
}
