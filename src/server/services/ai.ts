import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  estimateAICostUsd,
  getAIConfig,
  getAIStatus,
  selectAIModel,
  type AIConfig,
} from "@/server/ai/config";
import { createOpenAICompatibleProvider } from "@/server/ai/openai-compatible";
import {
  AIServiceError,
  type AIMessage,
  type AIModelPreference,
  type AIProvider,
  type AIStructuredSchema,
  type AIUsage,
} from "@/server/ai/types";
import { db } from "@/server/db";
import { aiRuns } from "@/server/db/schema";

export { getAIStatus, AIServiceError };
export type { AIMessage, AIModelPreference, AIUsage };

export type CompleteAIInput<T> = {
  ownerId: string;
  feature: string;
  system?: string;
  messages: AIMessage[];
  schema?: AIStructuredSchema<T>;
  schemaName?: string;
  modelPreference?: AIModelPreference;
  maxTokens?: number;
  temperature?: number;
  requestSummary?: Record<string, unknown>;
};

export type CompleteAIResult<T> = {
  runId: string;
  provider: string;
  model: string;
  text: string;
  data: T | null;
  usage: AIUsage;
  estimatedCostUsd: number;
  raw: unknown;
};

function createProvider(config: AIConfig): AIProvider {
  if (config.provider === "openai-compatible") {
    return createOpenAICompatibleProvider(config);
  }
  throw new AIServiceError(
    `El adaptador ${config.provider} todavía no está implementado.`,
    "not_configured",
  );
}

function normalizeFeature(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, "_");
  return clean.slice(0, 80) || "unknown";
}

function requestSummary(input: CompleteAIInput<unknown>) {
  return {
    ...(input.requestSummary ?? {}),
    messageCount: input.messages.length,
    schema: input.schemaName ?? null,
    systemChars: input.system?.length ?? 0,
    userChars: input.messages.reduce((sum, message) => sum + message.content.length, 0),
  };
}

function responseSummary(input: {
  parsed: boolean;
  text: string;
  usage: AIUsage;
}) {
  return {
    outputChars: input.text.length,
    parsed: input.parsed,
    usage: input.usage,
  };
}

function jsonSchemaFor<T>(
  schema: AIStructuredSchema<T> | undefined,
): Record<string, unknown> | null {
  if (!schema) return null;
  return z.toJSONSchema(schema) as Record<string, unknown>;
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1]!.trim() : trimmed;
}

function extractJson(value: string): unknown {
  const clean = stripJsonFence(value);
  try {
    return JSON.parse(clean);
  } catch {
    const firstObject = clean.indexOf("{");
    const lastObject = clean.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(clean.slice(firstObject, lastObject + 1));
    }
    const firstArray = clean.indexOf("[");
    const lastArray = clean.lastIndexOf("]");
    if (firstArray >= 0 && lastArray > firstArray) {
      return JSON.parse(clean.slice(firstArray, lastArray + 1));
    }
    throw new AIServiceError(
      "La IA no devolvió JSON válido para la salida estructurada.",
      "invalid_response",
    );
  }
}

function shouldRetry(error: unknown): boolean {
  if (!(error instanceof AIServiceError)) return true;
  if (error.code === "timeout") return true;
  if (error.code !== "provider_error") return false;
  return !error.status || error.status >= 500 || error.status === 429;
}

async function runWithTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function completeAI<T = string>(
  input: CompleteAIInput<T>,
): Promise<CompleteAIResult<T>> {
  const config = getAIConfig();
  if (!config) {
    const status = getAIStatus();
    throw new AIServiceError(
      status.reason ?? "La IA no está configurada.",
      "not_configured",
    );
  }

  const feature = normalizeFeature(input.feature);
  const model = selectAIModel(config, input.modelPreference);
  const provider = createProvider(config);
  const startedAt = new Date();
  const [run] = await db
    .insert(aiRuns)
    .values({
      feature,
      model,
      ownerId: input.ownerId,
      provider: provider.name,
      requestSummary: requestSummary(input as CompleteAIInput<unknown>),
      startedAt,
      status: "running",
    })
    .returning({ id: aiRuns.id });
  if (!run) throw new AIServiceError("No se pudo registrar la llamada de IA.", "provider_error");

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    const attemptStarted = Date.now();
    try {
      const jsonSchema = jsonSchemaFor(input.schema);
      const result = await runWithTimeout(config.timeoutMs, (signal) =>
        provider.complete({
          maxTokens: input.maxTokens,
          messages: input.messages,
          model,
          responseSchema:
            input.schema && jsonSchema
              ? {
                  jsonSchema,
                  name: input.schemaName ?? "structured_output",
                }
              : undefined,
          signal,
          system: input.system,
          temperature: input.temperature,
        }),
      );

      let data: T | null = null;
      if (input.schema) {
        const parsedJson = extractJson(result.text);
        const parsed = input.schema.safeParse(parsedJson);
        if (!parsed.success) {
          throw new AIServiceError(
            `La salida de IA no cumple el esquema: ${parsed.error.message}`,
            "invalid_response",
          );
        }
        data = parsed.data;
      }

      const estimatedCostUsd = estimateAICostUsd({
        config,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
      await db
        .update(aiRuns)
        .set({
          estimatedCostUsd,
          finishedAt: new Date(),
          inputTokens: result.usage.inputTokens,
          latencyMs: Date.now() - attemptStarted,
          outputTokens: result.usage.outputTokens,
          responseSummary: responseSummary({
            parsed: Boolean(input.schema),
            text: result.text,
            usage: result.usage,
          }),
          status: "completed",
          totalTokens: result.usage.totalTokens,
        })
        .where(eq(aiRuns.id, run.id));

      return {
        data,
        estimatedCostUsd,
        model,
        provider: provider.name,
        raw: result.raw,
        runId: run.id,
        text: result.text,
        usage: result.usage,
      };
    } catch (error) {
      lastError = error;
      if (attempt < config.retries && shouldRetry(error)) continue;
      break;
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "Error desconocido de IA.";
  await db
    .update(aiRuns)
    .set({
      error: message,
      finishedAt: new Date(),
      latencyMs: Date.now() - startedAt.getTime(),
      status: "failed",
    })
    .where(eq(aiRuns.id, run.id));
  if (lastError instanceof AIServiceError) throw lastError;
  throw new AIServiceError(message, "provider_error");
}

export function isAIConfigured(): boolean {
  return getAIStatus().configured;
}
