/**
 * Catálogo de filtros para segmentos de audiencia (Fase 4.4). Reutiliza los mismos
 * campos de contacto de la Fase 1 (nombre, email, cargo, origen, etiqueta, empresa,
 * estado de marketing y fecha de alta). Define qué campos hay, qué operadores admite
 * cada uno y qué tipo de valor esperan. Lo comparten el constructor de segmentos
 * (cliente) y el resolutor de audiencia (servidor). Módulo agnóstico (sin servidor).
 */

export type SegmentMatch = "all" | "any";

export type SegmentRuleOp =
  | "contains"
  | "not_contains"
  | "eq"
  | "neq"
  | "is_set"
  | "is_empty"
  | "has_label"
  | "not_has_label"
  | "before"
  | "after";

export type SegmentRule = {
  field: string;
  op: SegmentRuleOp;
  /** Valor del operador (texto, id de etiqueta, valor de enum o fecha ISO). */
  value?: string;
};

/**
 * Definición de un segmento. `dynamic` evalúa `rules` (combinadas con `match`);
 * `static` congela una lista de ids de contacto en `personIds`.
 */
export type SegmentDefinition = {
  match?: SegmentMatch;
  rules?: SegmentRule[];
  personIds?: string[];
};

export type SegmentFieldType = "text" | "enum" | "label" | "org" | "date";

export type SegmentFieldOption = { value: string; label: string };

export type SegmentField = {
  key: string;
  label: string;
  type: SegmentFieldType;
  ops: SegmentRuleOp[];
  /** Para campos `enum`: opciones fijas. */
  options?: SegmentFieldOption[];
};

/** Estados de marketing de un contacto (espejo de `MarketingStatus` del esquema). */
export const MARKETING_STATUS_OPTIONS: SegmentFieldOption[] = [
  { value: "subscribed", label: "Suscrito" },
  { value: "unsubscribed", label: "Dado de baja" },
  { value: "bounced", label: "Rebotado" },
  { value: "complained", label: "Marcó como spam" },
];

/** Campos disponibles en el constructor de segmentos (sobre `persons`). */
export const SEGMENT_FIELDS: SegmentField[] = [
  {
    key: "name",
    label: "Nombre",
    type: "text",
    ops: ["contains", "not_contains"],
  },
  {
    key: "email",
    label: "Email",
    type: "text",
    ops: ["contains", "is_set", "is_empty"],
  },
  {
    key: "title",
    label: "Cargo",
    type: "text",
    ops: ["contains", "is_set", "is_empty"],
  },
  {
    key: "source",
    label: "Origen",
    type: "text",
    ops: ["eq", "contains", "is_set", "is_empty"],
  },
  {
    key: "marketing_status",
    label: "Estado de marketing",
    type: "enum",
    ops: ["eq", "neq"],
    options: MARKETING_STATUS_OPTIONS,
  },
  {
    key: "label",
    label: "Etiqueta",
    type: "label",
    ops: ["has_label", "not_has_label"],
  },
  {
    key: "organization",
    label: "Empresa",
    type: "org",
    ops: ["is_set", "is_empty"],
  },
  {
    key: "created",
    label: "Fecha de alta",
    type: "date",
    ops: ["after", "before"],
  },
];

export const OP_LABELS: Record<SegmentRuleOp, string> = {
  contains: "contiene",
  not_contains: "no contiene",
  eq: "es",
  neq: "no es",
  is_set: "tiene valor",
  is_empty: "está vacío",
  has_label: "tiene la etiqueta",
  not_has_label: "no tiene la etiqueta",
  before: "antes de",
  after: "a partir de",
};

/** Primer campo del catálogo (siempre existe); base para reglas nuevas. */
export const DEFAULT_SEGMENT_FIELD: SegmentField = SEGMENT_FIELDS[0]!;

export function getSegmentField(key: string): SegmentField | undefined {
  return SEGMENT_FIELDS.find((f) => f.key === key);
}

/** ¿El operador necesita un valor? (`is_set`/`is_empty` no lo necesitan). */
export function opNeedsValue(op: SegmentRuleOp): boolean {
  return op !== "is_set" && op !== "is_empty";
}

/** Una regla es válida si el campo existe, admite el operador y tiene valor si toca. */
export function isRuleComplete(rule: SegmentRule): boolean {
  const field = getSegmentField(rule.field);
  if (!field || !field.ops.includes(rule.op)) return false;
  if (opNeedsValue(rule.op)) return Boolean(rule.value && rule.value.trim());
  return true;
}

/** Crea una regla por defecto para un campo (primer operador y valor vacío). */
export function defaultRuleForField(key: string): SegmentRule {
  const field = getSegmentField(key) ?? DEFAULT_SEGMENT_FIELD;
  return { field: field.key, op: field.ops[0]!, value: "" };
}

/**
 * Texto legible de una regla, p. ej. «Etiqueta tiene la etiqueta Cliente». Usa el mapa
 * de etiquetas (id→nombre) para resolver los valores de tipo `label`.
 */
export function describeRule(
  rule: SegmentRule,
  labelsById: Record<string, string> = {},
): string {
  const field = getSegmentField(rule.field);
  if (!field) return "Regla no válida";
  const opLabel = OP_LABELS[rule.op];
  if (!opNeedsValue(rule.op)) return `${field.label} ${opLabel}`;

  let valueLabel = rule.value ?? "";
  if (field.type === "label") {
    valueLabel = labelsById[valueLabel] ?? "(etiqueta)";
  } else if (field.type === "enum") {
    valueLabel =
      field.options?.find((o) => o.value === valueLabel)?.label ?? valueLabel;
  }
  return `${field.label} ${opLabel} ${valueLabel}`.trim();
}
