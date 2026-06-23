import { z } from "zod";

const emptyOrEmail = z
  .union([z.literal(""), z.string().email("Email no válido")])
  .optional();

const emptyOrUrl = z
  .union([z.literal(""), z.string().url("URL no válida (incluye https://)")])
  .optional();

export const personFormSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  lastName: z.string().max(120).optional(),
  email: emptyOrEmail,
  phone: z.string().max(40).optional(),
  title: z.string().max(120).optional(),
  orgId: z.string().optional(),
  source: z.string().max(120).optional(),
  campaign: z.string().max(160).optional(),
});
export type PersonFormValues = z.infer<typeof personFormSchema>;

export const organizationFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  tradeName: z.string().max(160).optional(),
  domain: z.string().max(160).optional(),
  website: emptyOrUrl,
  phone: z.string().max(40).optional(),
  industry: z.string().max(120).optional(),
  size: z.string().max(60).optional(),
  address: z.string().max(300).optional(),
});
export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

export const noteFormSchema = z.object({
  body: z.string().trim().min(1, "La nota no puede estar vacía").max(5000),
});
export type NoteFormValues = z.infer<typeof noteFormSchema>;

/** Normaliza una cadena: vacía/espacios → null. */
export function nullify(value: string | undefined | null): string | null {
  const v = value?.trim();
  return v ? v : null;
}
