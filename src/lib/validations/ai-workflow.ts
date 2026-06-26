import { z } from "zod";

import { conditionOps, triggerTypes } from "@/lib/validations/automation";
import {
  sequenceChannelSchema,
  sequenceConditionKindSchema,
} from "@/lib/validations/sequence";

export const aiWorkflowKindSchema = z.enum(["sequence", "automation"]);

export const generateWorkflowDraftSchema = z.object({
  instruction: z
    .string()
    .trim()
    .min(10, "Describe que quieres crear")
    .max(4_000),
  kind: aiWorkflowKindSchema,
});

const shortTextSchema = z.string().trim().min(1).max(220);
const optionalShortTextSchema = z.string().trim().max(220).optional();
const longTextSchema = z.string().trim().min(1).max(8_000);
const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .optional();

const generatedSequenceVariantSchema = z.object({
  bodyText: longTextSchema,
  name: optionalShortTextSchema,
  subject: shortTextSchema,
  weight: z.number().int().min(1).max(100).optional(),
});

const generatedSequenceStepBaseSchema = z.object({
  name: optionalShortTextSchema,
});

const generatedSequenceEmailStepSchema = generatedSequenceStepBaseSchema.extend({
  bodyText: longTextSchema,
  channel: sequenceChannelSchema.optional(),
  preheader: z.string().trim().max(180).optional(),
  subject: z.string().trim().min(1).max(500),
  type: z.literal("email"),
  variants: z.array(generatedSequenceVariantSchema).max(3).optional(),
});

const generatedSequenceWaitStepSchema = generatedSequenceStepBaseSchema.extend({
  type: z.literal("wait"),
  waitDays: z.number().int().min(0).max(365).optional(),
  waitHours: z.number().int().min(0).max(23).optional(),
});

const generatedSequenceConditionStepSchema =
  generatedSequenceStepBaseSchema.extend({
    condition: z.object({
      kind: sequenceConditionKindSchema,
      value: z.string().trim().max(500).optional(),
    }),
    type: z.literal("condition"),
  });

const generatedSequenceTaskStepSchema = generatedSequenceStepBaseSchema.extend({
  taskNotes: z.string().trim().max(2_000).optional(),
  taskSubject: z.string().trim().min(1).max(180),
  type: z.literal("task"),
  waitDays: z.number().int().min(0).max(365).optional(),
  waitHours: z.number().int().min(0).max(23).optional(),
});

export const generatedSequenceDraftSchema = z.object({
  channel: sequenceChannelSchema.optional(),
  dailyLimit: z.number().int().min(1).max(500).optional(),
  description: z.string().trim().max(500).optional(),
  name: z.string().trim().min(1).max(120),
  rationale: z.string().trim().max(700).optional(),
  steps: z
    .array(
      z.discriminatedUnion("type", [
        generatedSequenceEmailStepSchema,
        generatedSequenceWaitStepSchema,
        generatedSequenceConditionStepSchema,
        generatedSequenceTaskStepSchema,
      ]),
    )
    .min(1)
    .max(20),
  stopOnReply: z.boolean().optional(),
  timeZone: z.string().trim().min(1).max(80).optional(),
  warnings: z.array(z.string().trim().min(1).max(240)).max(8).optional(),
  windowEnd: timeSchema,
  windowStart: timeSchema,
});

const generatedAutomationTriggerSchema = z.object({
  cron: z.string().trim().max(80).optional(),
  entity: z.enum(["person", "organization", "deal"]).optional(),
  field: z.string().trim().max(120).optional(),
  stageName: z.string().trim().max(160).optional(),
  type: z.enum(triggerTypes),
});

const generatedAutomationActionKindSchema = z.enum([
  "create_task",
  "enroll_sequence",
  "add_label",
  "move_stage",
  "update_field",
  "webhook",
  "notify",
]);

const generatedAutomationActionStepSchema = z.object({
  field: z.string().trim().max(120).optional(),
  kind: generatedAutomationActionKindSchema,
  labelName: z.string().trim().max(160).optional(),
  message: z.string().trim().max(500).optional(),
  sequenceName: z.string().trim().max(160).optional(),
  stageName: z.string().trim().max(160).optional(),
  subject: z.string().trim().max(180).optional(),
  type: z.literal("action"),
  url: z.string().trim().max(2_000).optional(),
  value: z.string().trim().max(500).optional(),
});

const generatedAutomationWaitStepSchema = z.object({
  name: optionalShortTextSchema,
  type: z.literal("wait"),
  waitDays: z.number().int().min(0).max(365).optional(),
  waitHours: z.number().int().min(0).max(23).optional(),
});

const generatedAutomationConditionStepSchema = z.object({
  falseBranch: z.enum(["stop", "continue"]).optional(),
  field: z.string().trim().max(120),
  op: z.enum(conditionOps),
  trueBranch: z.enum(["stop", "continue"]).optional(),
  type: z.literal("condition"),
  value: z.string().trim().max(500).optional(),
});

export const generatedAutomationDraftSchema = z.object({
  description: z.string().trim().max(500).optional(),
  name: z.string().trim().min(1).max(120),
  rationale: z.string().trim().max(700).optional(),
  steps: z
    .array(
      z.discriminatedUnion("type", [
        generatedAutomationActionStepSchema,
        generatedAutomationWaitStepSchema,
        generatedAutomationConditionStepSchema,
      ]),
    )
    .min(1)
    .max(30),
  trigger: generatedAutomationTriggerSchema,
  warnings: z.array(z.string().trim().min(1).max(240)).max(8).optional(),
});

export type AIWorkflowKind = z.infer<typeof aiWorkflowKindSchema>;
export type GenerateWorkflowDraftValues = z.infer<
  typeof generateWorkflowDraftSchema
>;
export type GeneratedSequenceDraftValues = z.infer<
  typeof generatedSequenceDraftSchema
>;
export type GeneratedAutomationDraftValues = z.infer<
  typeof generatedAutomationDraftSchema
>;
