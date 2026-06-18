import { z } from "zod";

export const dealFormSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  /** Importe como cadena numérica; se convierte en la action. */
  value: z.string().optional(),
  currency: z.string().trim().max(8).optional(),
  pipelineId: z.string().min(1, "Elige un embudo"),
  stageId: z.string().min(1, "Elige una etapa"),
  personId: z.string().optional(),
  orgId: z.string().optional(),
  expectedCloseDate: z.string().optional(),
});
export type DealFormValues = z.infer<typeof dealFormSchema>;

export const pipelineFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
});
export type PipelineFormValues = z.infer<typeof pipelineFormSchema>;

export const stageInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  rottingDays: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(3650)])
    .optional(),
});
export type StageInputValues = z.infer<typeof stageInputSchema>;

export const lostReasonSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
