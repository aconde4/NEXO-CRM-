import { z } from "zod";

export const goalMetricSchema = z.enum([
  "revenue_won",
  "deals_won",
  "deals_created",
  "activities_completed",
  "emails_sent",
]);

export const goalPeriodSchema = z.enum(["month", "quarter"]);

export const goalFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().max(120).default(""),
  metric: goalMetricSchema,
  period: goalPeriodSchema,
  target: z
    .number({ message: "Indica un objetivo" })
    .positive("El objetivo debe ser mayor que 0")
    .max(1_000_000_000, "Objetivo demasiado alto"),
});

export const goalIdSchema = z.string().uuid("Objetivo no válido");

export type GoalFormValues = z.infer<typeof goalFormSchema>;
