import { z } from "zod";

import { contactFilterConditionSchema } from "@/lib/contact-filters";

export const savedViewSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(60),
  entityType: z.enum(["person", "organization"]),
  filters: z.object({
    conditions: z.array(contactFilterConditionSchema).max(8).optional(),
    q: z.string().max(200).optional(),
    label: z.string().max(80).optional(),
    sort: z.string().max(40).optional(),
    // Vistas del embudo de Negocios (6.4h): embudo, etapa y vista.
    pipeline: z.string().max(80).optional(),
    stage: z.string().max(80).optional(),
    view: z.string().max(20).optional(),
  }),
});
export type SavedViewValues = z.infer<typeof savedViewSchema>;
