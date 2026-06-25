import type { z } from "zod";

import type { AIProviderName } from "@/server/db/schema";

export type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AICompleteInput = {
  system?: string;
  messages: AIMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  responseSchema?: {
    name: string;
    jsonSchema: Record<string, unknown>;
  };
  signal?: AbortSignal;
};

export type AICompleteResult = {
  text: string;
  usage: AIUsage;
  raw: unknown;
};

export type AIProvider = {
  name: AIProviderName;
  complete(input: AICompleteInput): Promise<AICompleteResult>;
};

export type AIStructuredSchema<T> = z.ZodType<T>;

export type AIModelPreference = "quality" | "fast";

export type AIServiceStatus = {
  configured: boolean;
  provider: AIProviderName | null;
  model: string | null;
  fastModel: string | null;
  baseUrl: string | null;
  hasApiKey: boolean;
  reason: string | null;
};

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not_configured"
      | "provider_error"
      | "invalid_response"
      | "timeout",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}
