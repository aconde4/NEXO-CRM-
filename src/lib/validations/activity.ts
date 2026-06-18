import { z } from "zod";

import { ACTIVITY_TYPES } from "@/lib/activities";

export const activityFormSchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().trim().min(1, "El asunto es obligatorio").max(200),
  notes: z.string().trim().max(2000).optional(),
  /** Fecha de vencimiento como cadena ISO (o `datetime-local`); el cliente la
   * convierte a ISO antes de enviarla para respetar la zona horaria. */
  dueAt: z.string().optional(),
  personId: z.string().optional(),
  orgId: z.string().optional(),
  dealId: z.string().optional(),
});
export type ActivityFormValues = z.infer<typeof activityFormSchema>;
