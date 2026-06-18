import { z } from "zod";

import { CUSTOM_FIELD_TYPES } from "@/lib/custom-fields";

export const customFieldDefSchema = z.object({
  entityType: z.enum(["person", "organization"]),
  label: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  required: z.boolean().optional(),
});
export type CustomFieldDefValues = z.infer<typeof customFieldDefSchema>;
