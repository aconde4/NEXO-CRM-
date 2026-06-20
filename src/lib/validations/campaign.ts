import { z } from "zod";

import {
  campaignBlocksHaveContent,
  isSafeCampaignHref,
} from "@/lib/campaign-blocks";

const optionalEmailSchema = z
  .string()
  .trim()
  .max(320, "Email demasiado largo")
  .refine(
    (value) => !value || z.string().email().safeParse(value).success,
    "Email no válido",
  );

const richTextBlockSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.literal("richText"),
  html: z.string().max(500_000),
  text: z.string().max(200_000),
});

const headingBlockSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.literal("heading"),
  text: z.string().trim().min(1, "El título no puede estar vacío").max(160),
});

const buttonBlockSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.literal("button"),
  label: z.string().trim().min(1, "El botón necesita texto").max(80),
  href: z
    .string()
    .trim()
    .min(1, "El botón necesita URL")
    .max(500)
    .refine(isSafeCampaignHref, "Usa una URL http(s), mailto o tel válida"),
});

const dividerBlockSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.literal("divider"),
});

export const campaignEmailBlockSchema = z.discriminatedUnion("type", [
  richTextBlockSchema,
  headingBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
]);

export const campaignEmailBlocksSchema = z
  .array(campaignEmailBlockSchema)
  .min(1, "Añade al menos un bloque")
  .max(30, "Demasiados bloques");

export const campaignDraftSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Ponle un nombre").max(120),
    subject: z.string().trim().min(1, "El asunto es obligatorio").max(500),
    preheader: z.string().trim().max(180),
    fromName: z.string().trim().max(120),
    fromEmail: optionalEmailSchema,
    replyTo: optionalEmailSchema,
    segmentId: z.string().uuid().nullable(),
    blocks: campaignEmailBlocksSchema,
  })
  .refine((data) => campaignBlocksHaveContent(data.blocks), {
    message: "El email necesita contenido",
    path: ["blocks"],
  });

export const campaignTestSchema = campaignDraftSchema.extend({
  testEmail: z.string().trim().email("Email de prueba no válido").max(320),
});

export const campaignIdSchema = z.string().uuid("Campaña no válida");

export const campaignScheduleSchema = z.object({
  campaignId: campaignIdSchema,
  scheduledAt: z
    .string()
    .trim()
    .min(1, "Indica fecha y hora")
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Fecha de programación no válida",
    ),
});

export type CampaignDraftValues = z.infer<typeof campaignDraftSchema>;
export type CampaignTestValues = z.infer<typeof campaignTestSchema>;
export type CampaignScheduleValues = z.infer<typeof campaignScheduleSchema>;
