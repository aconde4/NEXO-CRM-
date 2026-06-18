"use client";

import * as React from "react";

import type { CustomFieldDef } from "@/lib/custom-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

export type CustomValues = Record<string, unknown>;

/**
 * Convierte los valores guardados (JSONB ya tipado) a la forma que esperan los
 * inputs del formulario (cadenas para text/number/date, booleano, array).
 */
export function toCustomFormValues(
  defs: CustomFieldDef[],
  stored: Record<string, unknown> | null | undefined,
): CustomValues {
  const out: CustomValues = {};
  for (const def of defs) {
    const v = stored?.[def.key];
    if (def.type === "checkbox") out[def.key] = Boolean(v);
    else if (def.type === "multiselect")
      out[def.key] = Array.isArray(v) ? v : [];
    else out[def.key] = v == null ? "" : String(v);
  }
  return out;
}

export function CustomFieldsSection({
  defs,
  values,
  onChange,
}: {
  defs: CustomFieldDef[];
  values: CustomValues;
  onChange: (key: string, value: unknown) => void;
}) {
  if (defs.length === 0) return null;

  return (
    <div className="grid gap-4 border-t pt-4">
      <p className="text-muted-foreground text-xs font-medium">
        Campos personalizados
      </p>
      {defs.map((def) => (
        <div key={def.id} className="grid gap-1.5">
          <Label>
            {def.label}
            {def.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <CustomFieldInput
            def={def}
            value={values[def.key]}
            onChange={(v) => onChange(def.key, v)}
          />
        </div>
      ))}
    </div>
  );
}

function CustomFieldInput({
  def,
  value,
  onChange,
}: {
  def: CustomFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (def.type) {
    case "checkbox":
      return (
        <label className="flex w-fit items-center gap-2 text-sm">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(c) => onChange(Boolean(c))}
          />
          {value ? "Sí" : "No"}
        </label>
      );

    case "select":
      return (
        <select
          className={selectClass}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Sin valor —</option>
          {def.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-2">
          {def.options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm"
              >
                <Checkbox
                  checked={active}
                  onCheckedChange={(c) =>
                    onChange(
                      c
                        ? [...selected, opt]
                        : selected.filter((v) => v !== opt),
                    )
                  }
                />
                {opt}
              </label>
            );
          })}
        </div>
      );
    }

    case "number":
      return (
        <Input
          type="number"
          inputMode="decimal"
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "monetary":
      return (
        <div className="relative">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            className="pr-7"
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
            €
          </span>
        </div>
      );

    case "date":
      return (
        <Input
          type="date"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "url":
      return (
        <Input
          type="url"
          placeholder="https://…"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return (
        <Input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
