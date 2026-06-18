/**
 * Motor de campos personalizados (Fase 1.8). Módulo compartido cliente/servidor:
 * solo depende de `lucide-react`. Define los tipos de campo, el formateo y la
 * coerción de valores que se guardan en el JSONB `custom_fields` de cada entidad.
 */
import {
  Banknote,
  Calendar,
  Hash,
  Link as LinkIcon,
  List,
  ListChecks,
  ToggleRight,
  Type,
  type LucideIcon,
} from "lucide-react";

export const CUSTOM_FIELD_TYPES = [
  "text",
  "number",
  "monetary",
  "date",
  "checkbox",
  "select",
  "multiselect",
  "url",
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export type CustomEntityType = "person" | "organization";

export const customFieldTypeMeta: Record<
  CustomFieldType,
  { label: string; icon: LucideIcon; hasOptions: boolean }
> = {
  text: { label: "Texto", icon: Type, hasOptions: false },
  number: { label: "Número", icon: Hash, hasOptions: false },
  monetary: { label: "Monetario (€)", icon: Banknote, hasOptions: false },
  date: { label: "Fecha", icon: Calendar, hasOptions: false },
  checkbox: { label: "Sí / No", icon: ToggleRight, hasOptions: false },
  select: { label: "Selección", icon: List, hasOptions: true },
  multiselect: { label: "Selección múltiple", icon: ListChecks, hasOptions: true },
  url: { label: "Enlace (URL)", icon: LinkIcon, hasOptions: false },
};

/** Definición de un campo personalizado (la misma forma en cliente y servidor). */
export type CustomFieldDef = {
  id: string;
  entityType: CustomEntityType;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  position: number;
};

/** Clave técnica a partir de una etiqueta ("Ingresos anuales" → "ingresos_anuales"). */
export function slugifyKey(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "campo";
}

// --- Coerción (cadena → valor tipado) --------------------------------------

function parseNumber(raw: string): number | undefined {
  const cleaned = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // separador de miles "1.234"
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

const TRUTHY = new Set(["1", "true", "si", "sí", "yes", "x", "verdadero", "y"]);

/** Convierte un valor en crudo (de un input o de un import) al tipo del campo. */
export function coerceCustomValue(
  type: CustomFieldType,
  raw: unknown,
): unknown {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    const arr = raw.map((v) => String(v).trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  const s = String(raw).trim();
  if (s === "") return undefined;

  switch (type) {
    case "number":
    case "monetary":
      return parseNumber(s);
    case "checkbox":
      return TRUTHY.has(s.toLowerCase());
    case "date": {
      // Acepta YYYY-MM-DD directamente; si no, intenta parsear.
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
    }
    case "multiselect":
      return (
        s
          .split(/[;,]/)
          .map((v) => v.trim())
          .filter(Boolean) || undefined
      );
    default:
      return s;
  }
}

// --- Formateo (valor tipado → texto para mostrar) ---------------------------

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});
const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatCustomValue(type: CustomFieldType, value: unknown): string {
  if (value == null || value === "") return "—";
  switch (type) {
    case "monetary":
      return typeof value === "number" ? eur.format(value) : String(value);
    case "number":
      return String(value);
    case "checkbox":
      return value ? "Sí" : "No";
    case "date": {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : dateFmt.format(d);
    }
    case "multiselect":
      return Array.isArray(value) ? value.join(", ") : String(value);
    default:
      return String(value);
  }
}

/**
 * Limpia un objeto de valores contra las definiciones: coacciona por tipo,
 * descarta claves desconocidas y valores vacíos. Se usa en mutaciones e import.
 */
export function sanitizeCustomFields(
  defs: CustomFieldDef[],
  input: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input) return out;
  for (const def of defs) {
    const value = coerceCustomValue(def.type, input[def.key]);
    if (value === undefined) continue;
    if (def.type === "select" && typeof value === "string") {
      if (def.options.length && !def.options.includes(value)) continue;
    }
    if (def.type === "multiselect" && Array.isArray(value)) {
      const allowed = def.options.length
        ? value.filter((v) => def.options.includes(v as string))
        : value;
      if (allowed.length) out[def.key] = allowed;
      continue;
    }
    out[def.key] = value;
  }
  return out;
}

/** Indica si un valor de campo está "vacío" (para no mostrarlo). */
export function isEmptyCustomValue(value: unknown): boolean {
  return (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
