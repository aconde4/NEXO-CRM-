/**
 * IA integrada (Fase 8): trazabilidad transversal de llamadas a modelos. La tabla no
 * ata el producto a un proveedor concreto; registra proveedor/modelo/uso/coste para
 * poder cambiar entre OpenAI-compatible, Gemini, Anthropic u Ollama sin rehacer datos.
 */
import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export type AIProviderName = "openai-compatible" | "gemini" | "anthropic";
export type AIRunStatus = "running" | "completed" | "failed" | "skipped";

export type AIRunSummary = {
  [key: string]: unknown;
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Caso de uso: draft_email, summary, score, nl_automation, sentiment... */
    feature: text("feature").notNull(),
    provider: text("provider").$type<AIProviderName>().notNull(),
    model: text("model").notNull(),
    status: text("status").$type<AIRunStatus>().default("running").notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    estimatedCostUsd: doublePrecision("estimated_cost_usd").default(0).notNull(),
    latencyMs: integer("latency_ms"),
    requestSummary: jsonb("request_summary")
      .$type<AIRunSummary>()
      .default({})
      .notNull(),
    responseSummary: jsonb("response_summary")
      .$type<AIRunSummary>()
      .default({})
      .notNull(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("ai_runs_owner_idx").on(t.ownerId),
    index("ai_runs_feature_idx").on(t.ownerId, t.feature),
    index("ai_runs_status_idx").on(t.status),
    index("ai_runs_created_idx").on(t.createdAt),
  ],
);

export const aiRunsRelations = relations(aiRuns, ({ one }) => ({
  owner: one(users, { fields: [aiRuns.ownerId], references: [users.id] }),
}));
