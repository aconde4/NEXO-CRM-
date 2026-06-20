import { z } from "zod";

import type { SegmentRuleOp } from "@/lib/segments";

const ruleOps: [SegmentRuleOp, ...SegmentRuleOp[]] = [
  "contains",
  "not_contains",
  "eq",
  "neq",
  "is_set",
  "is_empty",
  "has_label",
  "not_has_label",
  "before",
  "after",
];

export const segmentRuleSchema = z.object({
  field: z.string().trim().min(1).max(40),
  op: z.enum(ruleOps),
  value: z.string().trim().max(200).optional(),
});

export const segmentDefinitionSchema = z.object({
  match: z.enum(["all", "any"]).default("all"),
  rules: z.array(segmentRuleSchema).max(20).default([]),
  personIds: z.array(z.string().uuid()).max(50_000).optional(),
});
export type SegmentDefinitionValues = z.infer<typeof segmentDefinitionSchema>;

export const segmentInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  description: z.string().trim().max(300).optional(),
  kind: z.enum(["dynamic", "static"]).default("dynamic"),
  definition: segmentDefinitionSchema,
});
export type SegmentInputValues = z.infer<typeof segmentInputSchema>;

/** Datos del formulario (nombre/descripción); las reglas van en estado aparte. */
export const segmentFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  description: z.string().trim().max(300).optional(),
});
export type SegmentFormValues = z.infer<typeof segmentFormSchema>;
