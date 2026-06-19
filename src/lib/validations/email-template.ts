import { z } from "zod";

function htmlHasContent(value: string): boolean {
  return value.replace(/<[^>]*>/g, "").trim().length > 0;
}

export const emailTemplateSchema = z
  .object({
    name: z.string().trim().min(1, "Ponle un nombre").max(120),
    subject: z.string().trim().min(1, "El asunto es obligatorio").max(500),
    bodyText: z.string().trim().max(200_000).default(""),
    bodyHtml: z.string().trim().max(500_000).default(""),
  })
  .refine(
    (data) => Boolean(data.bodyText.trim() || htmlHasContent(data.bodyHtml)),
    {
      message: "El cuerpo no puede estar vacío",
      path: ["bodyText"],
    },
  );

export type EmailTemplateValues = z.infer<typeof emailTemplateSchema>;
