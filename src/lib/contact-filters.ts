import { z } from "zod";

import type { CustomFieldDef, CustomFieldType } from "@/lib/custom-fields";

export const CONTACT_FILTER_PARAM = "filter";
export const MAX_CONTACT_FILTERS = 8;

export const CONTACT_FILTER_OPERATORS = [
  "contains",
  "starts_with",
  "eq",
  "neq",
  "is_set",
  "is_empty",
] as const;

export type ContactFilterOperator = (typeof CONTACT_FILTER_OPERATORS)[number];

export const CONTACT_FILTER_OPERATOR_LABELS: Record<
  ContactFilterOperator,
  string
> = {
  contains: "contiene",
  starts_with: "empieza por",
  eq: "es",
  neq: "no es",
  is_set: "tiene valor",
  is_empty: "está vacío",
};

export const contactFilterConditionSchema = z.object({
  field: z.string().trim().min(1).max(100),
  op: z.enum(CONTACT_FILTER_OPERATORS),
  value: z.string().trim().max(200).optional(),
});

export type ContactFilterCondition = z.infer<
  typeof contactFilterConditionSchema
>;

export type ContactFilterFieldGroup = "contact" | "organization" | "custom";

export type ContactFilterValueOption = {
  label: string;
  value: string;
};

export type ContactFilterField = {
  group: ContactFilterFieldGroup;
  key: string;
  label: string;
  operators: ContactFilterOperator[];
  valueOptions?: ContactFilterValueOption[];
};

export const CONTACT_FILTER_GROUP_LABELS: Record<
  ContactFilterFieldGroup,
  string
> = {
  contact: "Contacto",
  organization: "Empresa",
  custom: "Campos personalizados",
};

export const CONTACT_MARKETING_STATUS_OPTIONS: ContactFilterValueOption[] = [
  { value: "subscribed", label: "Suscrito" },
  { value: "unsubscribed", label: "Dado de baja" },
  { value: "bounced", label: "Rebotado" },
  { value: "complained", label: "Marcó como spam" },
];

const BOOLEAN_OPTIONS: ContactFilterValueOption[] = [
  { value: "true", label: "Sí" },
  { value: "false", label: "No" },
];

const TEXT_OPERATORS: ContactFilterOperator[] = [
  "contains",
  "starts_with",
  "eq",
  "is_set",
  "is_empty",
];

const ENUM_OPERATORS: ContactFilterOperator[] = [
  "eq",
  "neq",
  "is_set",
  "is_empty",
];

const BUILTIN_CONTACT_FILTER_FIELDS: ContactFilterField[] = [
  {
    group: "contact",
    key: "name",
    label: "Nombre",
    operators: ["contains", "starts_with", "eq"],
  },
  { group: "contact", key: "email", label: "Email", operators: TEXT_OPERATORS },
  {
    group: "contact",
    key: "phone",
    label: "Teléfono",
    operators: TEXT_OPERATORS,
  },
  { group: "contact", key: "title", label: "Cargo", operators: TEXT_OPERATORS },
  {
    group: "organization",
    key: "organization",
    label: "Empresa",
    operators: TEXT_OPERATORS,
  },
  {
    group: "contact",
    key: "source",
    label: "Origen",
    operators: TEXT_OPERATORS,
  },
  {
    group: "contact",
    key: "campaign",
    label: "Campaña",
    operators: TEXT_OPERATORS,
  },
  {
    group: "contact",
    key: "marketingStatus",
    label: "Estado marketing",
    operators: ENUM_OPERATORS,
    valueOptions: CONTACT_MARKETING_STATUS_OPTIONS,
  },
];

function customOperators(type: CustomFieldType): ContactFilterOperator[] {
  if (type === "checkbox") return ENUM_OPERATORS;
  return TEXT_OPERATORS;
}

function customValueOptions(def: CustomFieldDef): ContactFilterValueOption[] | undefined {
  if (def.type === "checkbox") return BOOLEAN_OPTIONS;
  if (def.type === "select" || def.type === "multiselect") {
    return def.options.map((option) => ({ label: option, value: option }));
  }
  return undefined;
}

export function contactFilterFieldKey(def: Pick<CustomFieldDef, "key">): string {
  return `custom:${def.key}`;
}

export function getContactFilterFields(
  customFieldDefs: CustomFieldDef[] = [],
): ContactFilterField[] {
  return [
    ...BUILTIN_CONTACT_FILTER_FIELDS,
    ...customFieldDefs.map((def) => ({
      group: "custom" as const,
      key: contactFilterFieldKey(def),
      label: def.label,
      operators: customOperators(def.type),
      valueOptions: customValueOptions(def),
    })),
  ];
}

export function findContactFilterField(
  key: string,
  customFieldDefs: CustomFieldDef[] = [],
): ContactFilterField | undefined {
  return getContactFilterFields(customFieldDefs).find((field) => field.key === key);
}

export function operatorNeedsValue(op: ContactFilterOperator): boolean {
  return op !== "is_set" && op !== "is_empty";
}

export function normalizeContactFilters(
  input: unknown,
  customFieldDefs: CustomFieldDef[] = [],
): ContactFilterCondition[] {
  const raw = Array.isArray(input) ? input : [];
  const normalized: ContactFilterCondition[] = [];

  for (const item of raw) {
    const parsed = contactFilterConditionSchema.safeParse(item);
    if (!parsed.success) continue;

    const field = findContactFilterField(parsed.data.field, customFieldDefs);
    if (!field || !field.operators.includes(parsed.data.op)) continue;

    if (operatorNeedsValue(parsed.data.op)) {
      const value = parsed.data.value?.trim();
      if (!value) continue;
      normalized.push({
        field: field.key,
        op: parsed.data.op,
        value,
      });
    } else {
      normalized.push({ field: field.key, op: parsed.data.op });
    }

    if (normalized.length >= MAX_CONTACT_FILTERS) break;
  }

  return normalized;
}

export function decodeContactFilterParams(
  values: string | string[] | undefined,
  customFieldDefs: CustomFieldDef[] = [],
): ContactFilterCondition[] {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  const raw = list.flatMap((value) => {
    try {
      return [JSON.parse(value) as unknown];
    } catch {
      return [];
    }
  });
  return normalizeContactFilters(raw, customFieldDefs);
}

export function encodeContactFilterParam(
  condition: ContactFilterCondition,
): string {
  return JSON.stringify(condition);
}

export function appendContactFilterParams(
  params: URLSearchParams,
  conditions: ContactFilterCondition[],
): void {
  params.delete(CONTACT_FILTER_PARAM);
  for (const condition of conditions) {
    params.append(CONTACT_FILTER_PARAM, encodeContactFilterParam(condition));
  }
}

export function contactFiltersKey(
  conditions: ContactFilterCondition[] | undefined,
): string {
  return JSON.stringify(conditions ?? []);
}

export function contactFilterValueLabel(
  condition: ContactFilterCondition,
  field: ContactFilterField,
): string {
  if (!operatorNeedsValue(condition.op)) return "";
  const value = condition.value ?? "";
  return field.valueOptions?.find((option) => option.value === value)?.label ?? value;
}

export function describeContactFilter(
  condition: ContactFilterCondition,
  customFieldDefs: CustomFieldDef[] = [],
): string {
  const field = findContactFilterField(condition.field, customFieldDefs);
  if (!field) return "Filtro no válido";
  const op = CONTACT_FILTER_OPERATOR_LABELS[condition.op];
  const value = contactFilterValueLabel(condition, field);
  return [field.label, op, value].filter(Boolean).join(" ");
}
