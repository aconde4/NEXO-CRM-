"use server";

import { requireUser } from "@/lib/session";
import {
  generateHistorySummarySchema,
  type GenerateHistorySummaryValues,
} from "@/lib/validations/ai-history";
import {
  generateWorkflowDraftSchema,
  type GenerateWorkflowDraftValues,
} from "@/lib/validations/ai-workflow";
import { generateAIHistorySummary } from "@/server/services/ai-history-summary";
import { generateAIWorkflowDraft } from "@/server/services/ai-workflow-draft";

export async function generateHistorySummary(
  raw: GenerateHistorySummaryValues,
) {
  const user = await requireUser();
  const data = generateHistorySummarySchema.parse(raw);
  return generateAIHistorySummary(user.id, data);
}

export async function generateWorkflowDraft(raw: GenerateWorkflowDraftValues) {
  const user = await requireUser();
  const data = generateWorkflowDraftSchema.parse(raw);
  return generateAIWorkflowDraft(user.id, data);
}
