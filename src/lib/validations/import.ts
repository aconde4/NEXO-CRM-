import { z } from "zod";

/** Una fila ya mapeada a campos del CRM (valores en crudo, como cadenas). */
export const importRowSchema = z.object({
  firstName: z
    .string({ error: "Falta el nombre" })
    .trim()
    .min(1, "Falta el nombre")
    .max(120),
  lastName: z.string().trim().max(120).optional(),
  email: z.string().trim().email("Email no válido").max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  title: z.string().trim().max(120).optional(),
  orgName: z.string().trim().max(160).optional(),
  source: z.string().trim().max(120).optional(),
  campaign: z.string().trim().max(160).optional(),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export const importOptionsSchema = z.object({
  dedupe: z.enum(["skip", "update"]).default("skip"),
});
export type ImportOptions = z.infer<typeof importOptionsSchema>;

/** Tope de filas por importación (evita abusos / cargas enormes). */
export const MAX_IMPORT_ROWS = 10_000;
