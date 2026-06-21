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

const optionalHttpUrlSchema = z
  .string()
  .trim()
  .max(500, "URL demasiado larga")
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Usa una URL http(s) válida");

export const campaignConsentBasisSchema = z.enum([
  "consent",
  "legitimate_interest",
]);

export const emptyCampaignCompliance = {
  consentBasis: "consent" as const,
  consentNotice: "",
  contactEmail: "",
  legalAddress: "",
  legalName: "",
  privacyUrl: "",
};

export const campaignComplianceSchema = z.object({
  consentBasis: campaignConsentBasisSchema,
  consentNotice: z.string().trim().max(500, "Texto demasiado largo"),
  contactEmail: optionalEmailSchema,
  legalAddress: z.string().trim().max(500, "Dirección demasiado larga"),
  legalName: z.string().trim().max(160, "Nombre legal demasiado largo"),
  privacyUrl: optionalHttpUrlSchema,
});

export const completeCampaignComplianceSchema = campaignComplianceSchema.extend(
  {
    consentNotice: z
      .string()
      .trim()
      .min(1, "Explica por qué recibe la campaña")
      .max(500, "Texto demasiado largo"),
    contactEmail: z
      .string()
      .trim()
      .min(1, "Indica un email de contacto")
      .email("Email no válido")
      .max(320, "Email demasiado largo"),
    legalAddress: z
      .string()
      .trim()
      .min(1, "Indica la dirección postal del remitente")
      .max(500, "Dirección demasiado larga"),
    legalName: z
      .string()
      .trim()
      .min(1, "Indica el nombre legal del remitente")
      .max(160, "Nombre legal demasiado largo"),
  },
);

const complianceFieldLabels: Record<string, string> = {
  consentNotice: "motivo/origen del consentimiento",
  contactEmail: "email de contacto",
  legalAddress: "dirección postal",
  legalName: "nombre legal",
  privacyUrl: "URL de privacidad",
};

export function normalizeCampaignCompliance(
  value: unknown,
): CampaignComplianceValues {
  const parsed = campaignComplianceSchema.safeParse(value);
  return parsed.success ? parsed.data : emptyCampaignCompliance;
}

export function campaignComplianceErrorMessage(value: unknown): string | null {
  const parsed = completeCampaignComplianceSchema.safeParse(value);
  if (parsed.success) return null;

  const labels = [
    ...new Set(
      parsed.error.issues.map((issue) => {
        const key = issue.path[0];
        return typeof key === "string"
          ? (complianceFieldLabels[key] ?? key)
          : "datos RGPD";
      }),
    ),
  ];
  return `Completa los datos RGPD antes de enviar: ${labels.join(", ")}.`;
}

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
    compliance: campaignComplianceSchema,
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
export type CampaignComplianceValues = z.infer<typeof campaignComplianceSchema>;
export type CampaignTestValues = z.infer<typeof campaignTestSchema>;
export type CampaignScheduleValues = z.infer<typeof campaignScheduleSchema>;
