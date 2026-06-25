import "server-only";

import type { AIConfig } from "@/server/ai/config";
import {
  AIServiceError,
  type AICompleteInput,
  type AICompleteResult,
  type AIProvider,
} from "@/server/ai/types";

type OpenAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function extractText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0] as { message?: { content?: unknown } };
  const content = first.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return "";
      })
      .join("");
  }
  return content ? JSON.stringify(content) : "";
}

function extractUsage(data: unknown) {
  const usage =
    data && typeof data === "object"
      ? ((data as { usage?: OpenAIUsage }).usage ?? {})
      : {};
  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const error = (data as { error?: unknown }).error;
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    if ("message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  return fallback;
}

export function createOpenAICompatibleProvider(config: AIConfig): AIProvider {
  return {
    name: "openai-compatible",
    async complete(input: AICompleteInput): Promise<AICompleteResult> {
      const messages = [
        ...(input.system
          ? [{ content: input.system, role: "system" as const }]
          : []),
        ...input.messages,
      ];
      const body: Record<string, unknown> = {
        max_tokens: input.maxTokens,
        messages,
        model: input.model,
        temperature: input.temperature,
      };

      if (input.responseSchema) {
        body.response_format = {
          json_schema: {
            name: input.responseSchema.name,
            schema: input.responseSchema.jsonSchema,
            strict: true,
          },
          type: "json_schema",
        };
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

      let response: Response;
      try {
        response = await fetch(`${trimSlash(config.baseUrl!)}/chat/completions`, {
          body: JSON.stringify(body),
          headers,
          method: "POST",
          signal: input.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new AIServiceError("La llamada de IA ha agotado el tiempo.", "timeout");
        }
        throw new AIServiceError(
          error instanceof Error ? error.message : "No se pudo llamar al proveedor de IA.",
          "provider_error",
        );
      }

      const data = await parseJsonResponse(response);
      if (!response.ok) {
        throw new AIServiceError(
          errorMessage(data, `Proveedor de IA HTTP ${response.status}`),
          "provider_error",
          response.status,
        );
      }

      const text = extractText(data);
      if (!text.trim()) {
        throw new AIServiceError(
          "El proveedor de IA no devolvió contenido.",
          "invalid_response",
        );
      }

      return {
        raw: data,
        text,
        usage: extractUsage(data),
      };
    },
  };
}
