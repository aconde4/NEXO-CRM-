import { z } from "zod";

import type { FormFieldType } from "@/server/db/schema/forms";

const fieldTypes: [FormFieldType, ...FormFieldType[]] = [
  "text",
  "email",
  "phone",
  "textarea",
  "select",
  "checkbox",
];

export const formFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Clave inválida (usa minúsculas, números y _)"),
  label: z.string().trim().min(1, "Ponle una etiqueta").max(120),
  type: z.enum(fieldTypes),
  required: z.boolean().optional(),
  placeholder: z.string().trim().max(160).optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
});

export const formMappingSchema = z.object({
  field: z.string().trim().min(1).max(60),
  target: z.string().trim().min(1).max(120),
});

export const formEmbedSettingsSchema = z.object({
  submitLabel: z.string().trim().max(60).optional(),
  successMessage: z.string().trim().max(300).optional(),
  theme: z.enum(["light", "dark", "auto"]).optional(),
  intro: z.string().trim().max(500).optional(),
});

export const formInputSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(120),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  fields: z.array(formFieldSchema).max(50).default([]),
  mappings: z.array(formMappingSchema).max(50).default([]),
  redirectUrl: z
    .union([z.literal(""), z.string().trim().url("URL no válida").max(500)])
    .optional(),
  embedSettings: formEmbedSettingsSchema.default({}),
  automationId: z.string().uuid().nullish(),
});
export type FormInputValues = z.infer<typeof formInputSchema>;

/** Datos del encabezado del formulario (nombre/descr/estado); campos van aparte. */
export const formMetaSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(120),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["draft", "active", "archived"]),
});
export type FormMetaValues = z.infer<typeof formMetaSchema>;
