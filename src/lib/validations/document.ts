import { z } from "zod";

const optionalUuid = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .refine((v) => !v || z.string().uuid().safeParse(v).success, "Id no válido")
  .transform((v) => (v ? v : null));

export const documentFormSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Ponle un título").max(200),
  body: z.string().trim().max(50_000).default(""),
  dealId: optionalUuid,
  signerEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("")
    .refine(
      (v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      "Email no válido",
    ),
});

export const documentSignSchema = z.object({
  token: z.string().trim().min(10, "Enlace no válido"),
  signerName: z.string().trim().min(2, "Escribe tu nombre").max(120),
});

export const documentIdSchema = z.string().uuid("Documento no válido");

export type DocumentFormValues = z.infer<typeof documentFormSchema>;
export type DocumentSignValues = z.infer<typeof documentSignSchema>;
