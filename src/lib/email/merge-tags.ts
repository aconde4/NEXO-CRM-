/**
 * Motor de variables (merge tags) para correos (Fase 3.6). Resuelve `{{clave}}` y
 * `{{clave|"valor por defecto"}}` contra el contexto de un destinatario (contacto +
 * su empresa + campos personalizados). Lo reutilizan campañas (Fase 4) y secuencias
 * (Fase 5). Módulo compartido cliente/servidor.
 */
import {
  formatCustomValue,
  isEmptyCustomValue,
  type CustomFieldDef,
} from "@/lib/custom-fields";

export type MergeTag = { tag: string; label: string };

export const BUILTIN_PERSON_TAGS: MergeTag[] = [
  { tag: "nombre", label: "Nombre" },
  { tag: "apellidos", label: "Apellidos" },
  { tag: "nombre_completo", label: "Nombre completo" },
  { tag: "email", label: "Email" },
  { tag: "telefono", label: "Teléfono" },
  { tag: "cargo", label: "Cargo" },
];

export const BUILTIN_ORG_TAGS: MergeTag[] = [
  { tag: "empresa", label: "Empresa" },
  { tag: "empresa.nombre_comercial", label: "Empresa · nombre comercial" },
  { tag: "empresa.web", label: "Empresa · web" },
  { tag: "empresa.sector", label: "Empresa · sector" },
];

export type MergePersonInput = {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  customFields?: Record<string, unknown> | null;
};

export type MergeOrgInput = {
  name: string;
  tradeName: string | null;
  website: string | null;
  industry: string | null;
  customFields?: Record<string, unknown> | null;
} | null;

function customValue(
  defs: CustomFieldDef[],
  values: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const def = defs.find((d) => d.key === key);
  if (!def) return "";
  const raw = values?.[key];
  return isEmptyCustomValue(raw) ? "" : formatCustomValue(def.type, raw);
}

/** Construye el diccionario de valores para un destinatario. */
export function buildMergeContext(
  person: MergePersonInput,
  org: MergeOrgInput,
  personDefs: CustomFieldDef[],
  orgDefs: CustomFieldDef[],
): Record<string, string> {
  const ctx: Record<string, string> = {
    nombre: person.firstName ?? "",
    apellidos: person.lastName ?? "",
    nombre_completo: [person.firstName, person.lastName]
      .filter(Boolean)
      .join(" ")
      .trim(),
    email: person.email ?? "",
    telefono: person.phone ?? "",
    cargo: person.title ?? "",
  };

  for (const def of personDefs) {
    ctx[def.key] = customValue(personDefs, person.customFields, def.key);
  }

  if (org) {
    ctx["empresa"] = org.name ?? "";
    ctx["empresa.nombre_comercial"] = org.tradeName ?? "";
    ctx["empresa.web"] = org.website ?? "";
    ctx["empresa.sector"] = org.industry ?? "";
    for (const def of orgDefs) {
      ctx[`empresa.${def.key}`] = customValue(
        orgDefs,
        org.customFields,
        def.key,
      );
    }
  }

  return ctx;
}

/** Lista de variables disponibles para el menú de inserción. */
export function buildMergeCatalog(
  personDefs: CustomFieldDef[],
  orgDefs: CustomFieldDef[],
  hasOrg: boolean,
): MergeTag[] {
  return [
    ...BUILTIN_PERSON_TAGS,
    ...personDefs.map((d) => ({ tag: d.key, label: d.label })),
    ...(hasOrg ? BUILTIN_ORG_TAGS : []),
    ...(hasOrg
      ? orgDefs.map((d) => ({
          tag: `empresa.${d.key}`,
          label: `Empresa · ${d.label}`,
        }))
      : []),
  ];
}

const TAG_RE = /\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*?))?\s*\}\}/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripQuotes(value: string): string {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  if (v.startsWith("&quot;") && v.endsWith("&quot;")) {
    return v.slice(6, -6);
  }
  if (v.startsWith("&#39;") && v.endsWith("&#39;")) {
    return v.slice(5, -5);
  }
  return v;
}

/** Sustituye las variables del texto por sus valores (o el valor por defecto). */
export function renderMergeTags(
  template: string,
  ctx: Record<string, string>,
  options: { escapeValues?: boolean } = {},
): string {
  return template.replace(TAG_RE, (_match, key: string, fallback?: string) => {
    const value = ctx[key];
    const resolved =
      value != null && value !== ""
        ? value
        : fallback != null
          ? stripQuotes(fallback)
          : "";
    return options.escapeValues ? escapeHtml(resolved) : resolved;
  });
}

/** ¿El texto contiene variables sin definir en el contexto? (para avisar). */
export function unknownMergeTags(
  template: string,
  ctx: Record<string, string>,
): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(TAG_RE)) {
    const key = match[1];
    const fallback = match[2];
    if (key && !(key in ctx) && fallback == null) found.add(key);
  }
  return [...found];
}

/** Convierte texto plano a un HTML simple y seguro (escapado + saltos de línea). */
export function textToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
    .join("\n");
  return paragraphs || "<p></p>";
}
