import "server-only";

import type { AIProviderName } from "@/server/db/schema";
import type { AIModelPreference, AIServiceStatus } from "@/server/ai/types";

const PROVIDERS = new Set<AIProviderName>([
  "openai-compatible",
  "gemini",
  "anthropic",
]);

function cleanEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseProvider(value: string | null): AIProviderName | null {
  if (!value) return null;
  return PROVIDERS.has(value as AIProviderName) ? (value as AIProviderName) : null;
}

function isLocalBaseUrl(baseUrl: string | null): boolean {
  if (!baseUrl) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(baseUrl);
}

function envNumber(name: string): number {
  const value = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export type AIConfig = {
  provider: AIProviderName;
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  fastModel: string | null;
  timeoutMs: number;
  retries: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
};

export function getAIStatus(): AIServiceStatus {
  const providerRaw = cleanEnv(process.env.AI_PROVIDER);
  const provider = parseProvider(providerRaw);
  const baseUrl = cleanEnv(process.env.AI_BASE_URL);
  const apiKey = cleanEnv(process.env.AI_API_KEY);
  const model = cleanEnv(process.env.AI_MODEL);
  const fastModel = cleanEnv(process.env.AI_MODEL_FAST);

  if (!providerRaw) {
    return {
      baseUrl,
      configured: false,
      fastModel,
      hasApiKey: Boolean(apiKey),
      model,
      provider: null,
      reason: "Define AI_PROVIDER para activar la IA.",
    };
  }
  if (!provider) {
    return {
      baseUrl,
      configured: false,
      fastModel,
      hasApiKey: Boolean(apiKey),
      model,
      provider: null,
      reason: `Proveedor de IA no soportado: ${providerRaw}.`,
    };
  }
  if (provider !== "openai-compatible") {
    return {
      baseUrl,
      configured: false,
      fastModel,
      hasApiKey: Boolean(apiKey),
      model,
      provider,
      reason: `El adaptador ${provider} se añadirá cuando elijas ese proveedor.`,
    };
  }
  if (!baseUrl) {
    return {
      baseUrl,
      configured: false,
      fastModel,
      hasApiKey: Boolean(apiKey),
      model,
      provider,
      reason: "Define AI_BASE_URL para el proveedor OpenAI-compatible.",
    };
  }
  if (!model) {
    return {
      baseUrl,
      configured: false,
      fastModel,
      hasApiKey: Boolean(apiKey),
      model,
      provider,
      reason: "Define AI_MODEL para activar la IA.",
    };
  }
  if (!apiKey && !isLocalBaseUrl(baseUrl)) {
    return {
      baseUrl,
      configured: false,
      fastModel,
      hasApiKey: false,
      model,
      provider,
      reason: "Define AI_API_KEY o usa un AI_BASE_URL local.",
    };
  }

  return {
    baseUrl,
    configured: true,
    fastModel,
    hasApiKey: Boolean(apiKey),
    model,
    provider,
    reason: null,
  };
}

export function getAIConfig(): AIConfig | null {
  const status = getAIStatus();
  if (
    !status.configured ||
    !status.provider ||
    !status.model ||
    !status.baseUrl
  ) {
    return null;
  }

  return {
    apiKey: cleanEnv(process.env.AI_API_KEY),
    baseUrl: status.baseUrl,
    fastModel: status.fastModel,
    inputCostPerMillion: envNumber("AI_INPUT_COST_PER_1M"),
    model: status.model,
    outputCostPerMillion: envNumber("AI_OUTPUT_COST_PER_1M"),
    provider: status.provider,
    retries: Math.min(
      3,
      Math.max(0, Number.parseInt(process.env.AI_RETRIES ?? "1", 10) || 0),
    ),
    timeoutMs: Math.min(
      120_000,
      Math.max(5_000, Number.parseInt(process.env.AI_TIMEOUT_MS ?? "30000", 10) || 30_000),
    ),
  };
}

export function selectAIModel(
  config: AIConfig,
  preference: AIModelPreference = "quality",
): string {
  return preference === "fast" && config.fastModel
    ? config.fastModel
    : config.model;
}

export function estimateAICostUsd(input: {
  config: AIConfig;
  inputTokens: number;
  outputTokens: number;
}): number {
  const cost =
    (input.inputTokens / 1_000_000) * input.config.inputCostPerMillion +
    (input.outputTokens / 1_000_000) * input.config.outputCostPerMillion;
  return Number.isFinite(cost) ? Number(cost.toFixed(8)) : 0;
}
