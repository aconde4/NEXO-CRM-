"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ListFilter,
  Plus,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";

import {
  CONTACT_FILTER_GROUP_LABELS,
  CONTACT_FILTER_OPERATOR_LABELS,
  MAX_CONTACT_FILTERS,
  appendContactFilterParams,
  contactFilterValueLabel,
  describeContactFilter,
  findContactFilterField,
  getContactFilterFields,
  operatorNeedsValue,
  type ContactFilterCondition,
  type ContactFilterField,
  type ContactFilterFieldGroup,
  type ContactFilterOperator,
} from "@/lib/contact-filters";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-md border bg-background px-2 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

const suggestedKeys = ["campaign", "organization", "name", "email"];

function preferredOperator(field: ContactFilterField): ContactFilterOperator {
  return field.operators.includes("starts_with")
    ? "starts_with"
    : field.operators[0]!;
}

function groupIcon(group: ContactFilterFieldGroup) {
  switch (group) {
    case "organization":
      return <Building2 className="size-4 text-sky-600" />;
    case "custom":
      return <SlidersHorizontal className="size-4 text-amber-600" />;
    default:
      return <UserRound className="size-4 text-emerald-600" />;
  }
}

function buildGroups(fields: ContactFilterField[]) {
  return fields.reduce(
    (acc, field) => {
      acc[field.group] ??= [];
      acc[field.group].push(field);
      return acc;
    },
    {} as Record<ContactFilterFieldGroup, ContactFilterField[]>,
  );
}

export function ContactFiltersBar({
  conditions,
  customFieldDefs,
  basePath = "/contacts",
}: {
  conditions: ContactFilterCondition[];
  customFieldDefs: CustomFieldDef[];
  /** Ruta destino al aplicar/limpiar (reutilizable fuera de /contacts, p. ej. /deals). */
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fields = React.useMemo(
    () => getContactFilterFields(customFieldDefs),
    [customFieldDefs],
  );
  const fieldsByGroup = React.useMemo(() => buildGroups(fields), [fields]);
  const suggestedFields = React.useMemo(
    () =>
      suggestedKeys
        .map((key) => fields.find((field) => field.key === key))
        .filter((field): field is ContactFilterField => Boolean(field)),
    [fields],
  );

  const [open, setOpen] = React.useState(false);
  const [draftFieldKey, setDraftFieldKey] = React.useState<string | null>(null);
  const draftField = fields.find((field) => field.key === draftFieldKey);
  const [draftOp, setDraftOp] =
    React.useState<ContactFilterOperator>("starts_with");
  const [draftValue, setDraftValue] = React.useState("");

  function applyConditions(nextConditions: ContactFilterCondition[]) {
    const params = new URLSearchParams(searchParams.toString());
    appendContactFilterParams(params, nextConditions);
    router.replace(`${basePath}${params.size ? `?${params}` : ""}`);
  }

  function chooseField(field: ContactFilterField) {
    setDraftFieldKey(field.key);
    setDraftOp(preferredOperator(field));
    setDraftValue("");
  }

  function resetDraft() {
    setDraftFieldKey(null);
    setDraftOp("starts_with");
    setDraftValue("");
  }

  function addCondition() {
    if (!draftField || conditions.length >= MAX_CONTACT_FILTERS) return;
    const needsValue = operatorNeedsValue(draftOp);
    const value = draftValue.trim();
    if (needsValue && !value) return;

    applyConditions([
      ...conditions,
      {
        field: draftField.key,
        op: draftOp,
        ...(needsValue ? { value } : {}),
      },
    ]);
    resetDraft();
    setOpen(false);
  }

  function removeCondition(index: number) {
    applyConditions(conditions.filter((_, i) => i !== index));
  }

  const reachedLimit = conditions.length >= MAX_CONTACT_FILTERS;
  const needsValue = operatorNeedsValue(draftOp);
  const canAdd = Boolean(draftField && (!needsValue || draftValue.trim()));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {conditions.map((condition, index) => {
        const field = findContactFilterField(condition.field, customFieldDefs);
        if (!field) return null;
        const valueLabel = contactFilterValueLabel(condition, field);

        return (
          <span
            key={`${condition.field}-${condition.op}-${condition.value ?? ""}-${index}`}
            className="bg-muted/70 inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border px-2 text-sm"
          >
            {groupIcon(field.group)}
            <span className="min-w-0 truncate font-medium">{field.label}</span>
            <span className="text-muted-foreground whitespace-nowrap">
              {CONTACT_FILTER_OPERATOR_LABELS[condition.op]}
            </span>
            {valueLabel ? (
              <span className="max-w-48 truncate font-medium">{valueLabel}</span>
            ) : null}
            <button
              type="button"
              aria-label={`Quitar filtro ${describeContactFilter(
                condition,
                customFieldDefs,
              )}`}
              onClick={() => removeCondition(index)}
              className="hover:bg-muted-foreground/15 rounded-sm p-0.5"
            >
              <X className="size-3.5" />
            </button>
          </span>
        );
      })}

      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) resetDraft();
        }}
      >
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={reachedLimit}
              className="h-8"
            />
          }
        >
          <ListFilter className="size-4" />
          Añadir condición
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] p-0">
          {draftField ? (
            <div className="space-y-3 p-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Volver a campos"
                  onClick={resetDraft}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{draftField.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {CONTACT_FILTER_GROUP_LABELS[draftField.group]}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[11rem_1fr]">
                <select
                  aria-label="Operador"
                  className={selectClass}
                  value={draftOp}
                  onChange={(event) => {
                    const op = event.target.value as ContactFilterOperator;
                    setDraftOp(op);
                    if (!operatorNeedsValue(op)) setDraftValue("");
                  }}
                >
                  {draftField.operators.map((op) => (
                    <option key={op} value={op}>
                      {CONTACT_FILTER_OPERATOR_LABELS[op]}
                    </option>
                  ))}
                </select>

                {needsValue ? (
                  draftField.valueOptions ? (
                    <select
                      aria-label="Valor"
                      className={selectClass}
                      value={draftValue}
                      onChange={(event) => setDraftValue(event.target.value)}
                    >
                      <option value="">Selecciona un valor</option>
                      {draftField.valueOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={draftValue}
                      onChange={(event) => setDraftValue(event.target.value)}
                      placeholder="Valor"
                      className="h-8"
                      autoFocus
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCondition();
                        }
                      }}
                    />
                  )
                ) : (
                  <div className="border-input bg-muted/40 flex h-8 items-center rounded-md border px-2 text-sm">
                    Sin valor
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={resetDraft}>
                  Cambiar campo
                </Button>
                <Button type="button" onClick={addCondition} disabled={!canAdd}>
                  <Plus className="size-4" />
                  Añadir
                </Button>
              </div>
            </div>
          ) : (
            <Command>
              <CommandInput placeholder="Buscar campo" />
              <CommandList>
                <CommandEmpty>No hay campos</CommandEmpty>
                {suggestedFields.length > 0 ? (
                  <CommandGroup heading="Sugeridos">
                    {suggestedFields.map((field) => (
                      <CommandItem
                        key={`suggested-${field.key}`}
                        value={`sugerido ${field.label} ${field.key}`}
                        onSelect={() => chooseField(field)}
                      >
                        {groupIcon(field.group)}
                        <span>{field.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}

                {suggestedFields.length > 0 ? <CommandSeparator /> : null}

                {(["contact", "organization", "custom"] as const).map((group) => {
                  const groupFields = fieldsByGroup[group] ?? [];
                  if (groupFields.length === 0) return null;
                  return (
                    <CommandGroup
                      key={group}
                      heading={CONTACT_FILTER_GROUP_LABELS[group]}
                    >
                      {groupFields.map((field) => (
                        <CommandItem
                          key={field.key}
                          value={`${field.label} ${field.key}`}
                          onSelect={() => chooseField(field)}
                        >
                          {groupIcon(field.group)}
                          <span>{field.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      {conditions.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8 px-2", conditions.length === 0 && "hidden")}
          onClick={() => applyConditions([])}
        >
          Limpiar
        </Button>
      ) : null}
    </div>
  );
}
