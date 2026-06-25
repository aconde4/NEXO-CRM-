import "server-only";

import { desc, eq } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { getAIStatus } from "@/server/services/ai";
import { db } from "@/server/db";
import { aiRuns } from "@/server/db/schema";

export type AIStatusView = ReturnType<typeof getAIStatus>;

export type AIRunListItem = {
  id: string;
  feature: string;
  provider: string;
  model: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number | null;
  error: string | null;
  createdAt: string;
};

export async function getAISettingsStatus(): Promise<AIStatusView> {
  await requireUser();
  return getAIStatus();
}

export async function listRecentAIRuns(limit = 10): Promise<AIRunListItem[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      createdAt: aiRuns.createdAt,
      error: aiRuns.error,
      estimatedCostUsd: aiRuns.estimatedCostUsd,
      feature: aiRuns.feature,
      id: aiRuns.id,
      inputTokens: aiRuns.inputTokens,
      latencyMs: aiRuns.latencyMs,
      model: aiRuns.model,
      outputTokens: aiRuns.outputTokens,
      provider: aiRuns.provider,
      status: aiRuns.status,
      totalTokens: aiRuns.totalTokens,
    })
    .from(aiRuns)
    .where(eq(aiRuns.ownerId, user.id))
    .orderBy(desc(aiRuns.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}
