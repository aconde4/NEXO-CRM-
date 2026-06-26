"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  generateHistorySummarySchema,
  type GenerateHistorySummaryValues,
} from "@/lib/validations/ai-history";
import {
  scoreLeadSchema,
  scoreNewLeadsSchema,
  type ScoreLeadValues,
  type ScoreNewLeadsValues,
} from "@/lib/validations/ai-lead-score";
import {
  generateWorkflowDraftSchema,
  type GenerateWorkflowDraftValues,
} from "@/lib/validations/ai-workflow";
import { generateAIHistorySummary } from "@/server/services/ai-history-summary";
import { scoreLead, scoreNewLeads } from "@/server/services/ai-lead-score";
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

export async function scoreLeadWithAI(raw: ScoreLeadValues) {
  const user = await requireUser();
  const data = scoreLeadSchema.parse(raw);
  const result = await scoreLead(user.id, data.leadId);
  revalidatePath("/leads");
  return result;
}

export async function scoreNewLeadsWithAI(raw?: ScoreNewLeadsValues) {
  const user = await requireUser();
  const data = scoreNewLeadsSchema.parse(raw ?? {});
  const result = await scoreNewLeads(user.id, data.limit);
  revalidatePath("/leads");
  return result;
}
