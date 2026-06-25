/**
 * Catálogo del constructor de formularios (Fase 7.2). Módulo agnóstico (cliente/
 * servidor): tipos de campo, destinos de mapeo a persona/empresa y helpers para crear
 * y describir campos. Los tipos del esquema viven en `@/server/db/schema/forms`.
 */
import { slugifyKey } from "@/lib/custom-fields";
import type { FormFieldDef, FormFieldType } from "@/server/db/schema/forms";

export const FORM_FIELD_TYPES: FormFieldType[] = [
  "text",
  "email",
  "phone",
  "textarea",
  "select",
  "checkbox",
];

export const formFieldTypeLabels: Record<FormFieldType, string> = {
  text: "Texto",
  email: "Email",
  phone: "Teléfono",
  textarea: "Texto largo",
  select: "Selección",
  checkbox: "Sí / No",
};

export function fieldTypeHasOptions(type: FormFieldType): boolean {
  return type === "select";
}

/** Destino de mapeo de un campo del formulario a un campo del CRM. */
export type FormMappingTarget = {
  value: string;
  label: string;
  group: string;
};

/** Destinos nativos (persona/empresa). Los campos personalizados se añaden aparte. */
export const FORM_NATIVE_TARGETS: FormMappingTarget[] = [
  { value: "person.firstName", label: "Nombre", group: "Contacto" },
  { value: "person.lastName", label: "Apellidos", group: "Contacto" },
  { value: "person.email", label: "Email", group: "Contacto" },
  { value: "person.phone", label: "Teléfono", group: "Contacto" },
  { value: "person.title", label: "Cargo", group: "Contacto" },
  { value: "person.campaign", label: "Campaña", group: "Contacto" },
  { value: "person.source", label: "Origen", group: "Contacto" },
  { value: "organization.name", label: "Empresa", group: "Empresa" },
];

/** Construye un `value` de destino para un campo personalizado de persona. */
export function personCustomTarget(key: string): string {
  return `person.custom:${key}`;
}

let fieldCounter = 0;
/** Id local estable para un campo nuevo del constructor (no se persiste). */
export function createFieldLocalId(): string {
  fieldCounter += 1;
  return `field-${Date.now().toString(36)}-${fieldCounter}`;
}

/** Genera una clave única (slug) para un campo, evitando colisiones. */
export function uniqueFieldKey(label: string, taken: Iterable<string>): string {
  const base = slugifyKey(label || "campo");
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

export function describeFormField(field: FormFieldDef): string {
  return `${field.label || "(sin etiqueta)"} · ${formFieldTypeLabels[field.type]}`;
}
