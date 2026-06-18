import { z } from "zod";

const optionalUuid = z
  .string()
  .trim()
  .uuid("Identificador no válido")
  .optional()
  .or(z.literal(""));

export const emailAddressSchema = z.object({
  email: z.string().trim().email("Email no válido").max(320),
  name: z.string().trim().max(200).optional(),
});

export const sendEmailSchema = z
  .object({
    to: z
      .array(emailAddressSchema)
      .min(1, "Añade al menos un destinatario")
      .max(50),
    cc: z.array(emailAddressSchema).max(50).optional(),
    bcc: z.array(emailAddressSchema).max(50).optional(),
    replyTo: z.array(emailAddressSchema).max(10).optional(),
    subject: z.string().trim().min(1, "El asunto es obligatorio").max(500),
    bodyText: z.string().trim().max(200_000).optional(),
    bodyHtml: z.string().trim().max(500_000).optional(),
    threadId: optionalUuid,
    personId: optionalUuid,
    orgId: optionalUuid,
    dealId: optionalUuid,
  })
  .refine((data) => Boolean(data.bodyText?.trim() || data.bodyHtml?.trim()), {
    message: "El email necesita cuerpo en texto o HTML",
    path: ["bodyText"],
  });

export type EmailAddressValues = z.infer<typeof emailAddressSchema>;
export type SendEmailValues = z.infer<typeof sendEmailSchema>;
