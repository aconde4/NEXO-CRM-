import { z } from "zod";

const optionalUuid = z
  .string()
  .trim()
  .uuid("Identificador no válido")
  .optional()
  .or(z.literal(""));

const emailDraftModeSchema = z.enum(["new", "reply"]);
const emailDraftToneSchema = z.enum([
  "professional",
  "warm",
  "brief",
  "direct",
]);

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

export const generateEmailDraftSchema = z
  .object({
    bodyText: z.string().trim().max(10_000).optional(),
    dealId: optionalUuid,
    instruction: z.string().trim().max(2_000).optional(),
    mode: emailDraftModeSchema.default("new"),
    orgId: optionalUuid,
    personId: optionalUuid,
    subject: z.string().trim().max(500).optional(),
    threadId: optionalUuid,
    to: z.array(emailAddressSchema).min(1).max(5),
    tone: emailDraftToneSchema.default("professional"),
  })
  .refine((data) => data.mode !== "reply" || Boolean(data.threadId), {
    message: "Para responder hace falta un hilo",
    path: ["threadId"],
  });

export const generatedEmailDraftSchema = z.object({
  bodyText: z.string().trim().min(1).max(10_000),
  subject: z.string().trim().min(1).max(500),
});

export type EmailDraftMode = z.infer<typeof emailDraftModeSchema>;
export type EmailDraftTone = z.infer<typeof emailDraftToneSchema>;
export type GenerateEmailDraftValues = z.infer<typeof generateEmailDraftSchema>;
export type GeneratedEmailDraftValues = z.infer<typeof generatedEmailDraftSchema>;
