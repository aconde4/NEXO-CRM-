import { z } from "zod";

import type {
  AutomationActionKind,
  ConditionOperator,
} from "@/lib/automations";
import type { AutomationTriggerType } from "@/server/db/schema/automations";

const triggerTypes: [AutomationTriggerType, ...AutomationTriggerType[]] = [
  "record_created",
  "record_updated",
  "record_deleted",
  "deal_stage_changed",
  "field_changed",
  "email_opened",
  "email_replied",
  "form_submitted",
  "sequence_enrolled",
  "scheduled",
];

const actionKinds: [AutomationActionKind, ...AutomationActionKind[]] = [
  "create_task",
  "send_email",
  "enroll_sequence",
  "add_label",
  "move_stage",
  "update_field",
  "webhook",
  "notify",
  "ai_summary",
];

const conditionOps: [ConditionOperator, ...ConditionOperator[]] = [
  "eq",
  "neq",
  "contains",
  "is_set",
  "is_empty",
  "gt",
  "lt",
];

const jsonRecord = z.record(z.string(), z.unknown());

export const automationTriggerSchema = z.object({
  type: z.enum(triggerTypes),
  config: jsonRecord.default({}),
});

export const automationNodeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.enum(["condition", "wait", "action"]),
  kind: z.string().trim().min(1).max(40),
  config: jsonRecord.default({}),
});

export const automationEdgeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  source: z.string().trim().min(1).max(80),
  target: z.string().trim().min(1).max(80),
  branch: z.enum(["true", "false"]).nullish(),
});

export const automationGraphSchema = z.object({
  nodes: z.array(automationNodeSchema).max(50).default([]),
  edges: z.array(automationEdgeSchema).max(100).default([]),
});

export const automationInputSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(120),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).default("draft"),
  trigger: automationTriggerSchema.nullish(),
  graph: automationGraphSchema.default({ edges: [], nodes: [] }),
});
export type AutomationInputValues = z.infer<typeof automationInputSchema>;

/** Datos del formulario (nombre/descripción/estado); trigger y grafo van aparte. */
export const automationFormSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(120),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]),
});
export type AutomationFormValues = z.infer<typeof automationFormSchema>;

export { actionKinds, conditionOps, triggerTypes };
