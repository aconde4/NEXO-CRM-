"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  FORM_FIELD_TYPES,
  FORM_NATIVE_TARGETS,
  createFieldLocalId,
  fieldTypeHasOptions,
  formFieldTypeLabels,
  personCustomTarget,
  uniqueFieldKey,
} from "@/lib/forms";
import {
  type FormMetaValues,
  formMetaSchema,
} from "@/lib/validations/form";
import type { FormFieldType } from "@/server/db/schema/forms";
import type { FormBuilderOptions, FormDetail } from "@/server/queries/forms";
import { updateForm } from "@/server/actions/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

/** Fila de campo en el constructor (el `key` se deriva al guardar). */
type FieldRow = {
  localId: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string;
  options: string[];
  target: string;
};

type TargetOption = { value: string; label: string };

export function FormBuilder({
  form,
  options,
}: {
  form: FormDetail;
  options: FormBuilderOptions;
}) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormMetaValues>({
    resolver: zodResolver(formMetaSchema),
    defaultValues: {
      name: form.name,
      description: form.description,
      status: form.status,
    },
  });

  const [rows, setRows] = React.useState<FieldRow[]>(() =>
    form.fields.map((f) => ({
      localId: createFieldLocalId(),
      label: f.label,
      type: f.type,
      required: Boolean(f.required),
      placeholder: f.placeholder ?? "",
      options: f.options ?? [],
      target: form.mappings.find((m) => m.field === f.key)?.target ?? "",
    })),
  );
  const [redirectUrl, setRedirectUrl] = React.useState(form.redirectUrl);
  const [submitLabel, setSubmitLabel] = React.useState(
    form.embedSettings.submitLabel ?? "",
  );
  const [successMessage, setSuccessMessage] = React.useState(
    form.embedSettings.successMessage ?? "",
  );
  const [intro, setIntro] = React.useState(form.embedSettings.intro ?? "");
  const [automationId, setAutomationId] = React.useState(
    form.automationId ?? "",
  );

  const targetOptions: TargetOption[] = React.useMemo(
    () => [
      ...FORM_NATIVE_TARGETS.map((t) => ({
        value: t.value,
        label: `${t.group}: ${t.label}`,
      })),
      ...options.personFields.map((f) => ({
        value: personCustomTarget(f.key),
        label: `Campo: ${f.label}`,
      })),
    ],
    [options.personFields],
  );

  function addField() {
    setRows((prev) => [
      ...prev,
      {
        localId: createFieldLocalId(),
        label: "",
        type: "text",
        required: false,
        placeholder: "",
        options: [],
        target: "",
      },
    ]);
  }
  function updateRow(localId: string, patch: Partial<FieldRow>) {
    setRows((prev) =>
      prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)),
    );
  }
  function removeRow(localId: string) {
    setRows((prev) => prev.filter((r) => r.localId !== localId));
  }
  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setRows(next);
  }

  async function onSubmit(values: FormMetaValues) {
    if (rows.some((r) => !r.label.trim())) {
      toast.error("Todos los campos necesitan una etiqueta.");
      return;
    }

    // Deriva claves únicas a partir de las etiquetas; construye campos + mapeos.
    const taken = new Set<string>();
    const withKeys = rows.map((r) => {
      const key = uniqueFieldKey(r.label, taken);
      taken.add(key);
      return { ...r, key };
    });
    const fields = withKeys.map((r) => ({
      key: r.key,
      label: r.label.trim(),
      type: r.type,
      ...(r.required ? { required: true } : {}),
      ...(r.placeholder.trim() ? { placeholder: r.placeholder.trim() } : {}),
      ...(fieldTypeHasOptions(r.type) && r.options.filter(Boolean).length
        ? { options: r.options.map((o) => o.trim()).filter(Boolean) }
        : {}),
    }));
    const mappings = withKeys
      .filter((r) => r.target)
      .map((r) => ({ field: r.key, target: r.target }));

    try {
      await updateForm(form.id, {
        name: values.name,
        description: values.description,
        status: values.status,
        fields,
        mappings,
        redirectUrl: redirectUrl.trim(),
        embedSettings: {
          ...(submitLabel.trim() ? { submitLabel: submitLabel.trim() } : {}),
          ...(successMessage.trim()
            ? { successMessage: successMessage.trim() }
            : {}),
          ...(intro.trim() ? { intro: intro.trim() } : {}),
        },
        automationId: automationId || null,
      });
      toast.success("Formulario guardado");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          render={<Link href="/forms" />}
        >
          <ArrowLeft />
        </Button>
        <span className="text-muted-foreground text-sm">Formularios</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* Ajustes generales */}
        <div className="grid content-start gap-4">
          <div className="grid gap-3 rounded-lg border p-3">
            <div className="grid gap-1.5">
              <Label>
                Nombre<span className="text-destructive"> *</span>
              </Label>
              <Input {...register("name")} placeholder="Contacto desde la web" />
              {errors.name ? (
                <p className="text-destructive text-xs">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Descripción</Label>
              <Textarea
                {...register("description")}
                rows={2}
                placeholder="Para qué sirve este formulario"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Estado</Label>
              <select className={selectClass} {...register("status")}>
                <option value="draft">Borrador</option>
                <option value="active">Publicado</option>
                <option value="archived">Archivado</option>
              </select>
              <p className="text-muted-foreground text-xs">
                Publícalo para aceptar envíos en su página pública.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Tras enviar</p>
            <div className="grid gap-1.5">
              <Label className="text-xs">Texto del botón</Label>
              <Input
                value={submitLabel}
                onChange={(e) => setSubmitLabel(e.target.value)}
                placeholder="Enviar"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Mensaje de éxito</Label>
              <Input
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
                placeholder="¡Gracias! Te contactaremos pronto."
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Redirigir a (URL, opcional)</Label>
              <Input
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://tu-web.com/gracias"
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border p-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Introducción (opcional)</Label>
              <Textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={2}
                placeholder="Texto que aparece sobre el formulario"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Automatización al recibir</Label>
              <select
                className={selectClass}
                value={automationId}
                onChange={(e) => setAutomationId(e.target.value)}
              >
                <option value="">— Ninguna —</option>
                {options.automations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                Se ejecutará cuando llegue un envío (además del disparador
                &quot;Formulario enviado&quot;).
              </p>
            </div>
          </div>
        </div>

        {/* Campos */}
        <div className="grid content-start gap-3">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-muted-foreground text-sm">
                Añade los campos que verá quien rellene el formulario.
              </p>
            </div>
          ) : (
            rows.map((row, index) => (
              <FieldCard
                key={row.localId}
                row={row}
                index={index}
                total={rows.length}
                targetOptions={targetOptions}
                onChange={(patch) => updateRow(row.localId, patch)}
                onRemove={() => removeRow(row.localId)}
                onMove={(dir) => moveRow(index, dir)}
              />
            ))
          )}

          <div>
            <Button type="button" variant="outline" size="sm" onClick={addField}>
              <Plus className="size-4" />
              Añadir campo
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" render={<Link href="/forms" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save />
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function FieldCard({
  row,
  index,
  total,
  targetOptions,
  onChange,
  onRemove,
  onMove,
}: {
  row: FieldRow;
  index: number;
  total: number;
  targetOptions: TargetOption[];
  onChange: (patch: Partial<FieldRow>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <GripVertical className="size-4" />
          Campo {index + 1}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Subir"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bajar"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar"
            className="text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-1.5">
          <Label className="text-xs">
            Etiqueta<span className="text-destructive"> *</span>
          </Label>
          <Input
            value={row.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Tu nombre"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Tipo</Label>
          <select
            className={selectClass}
            value={row.type}
            onChange={(e) =>
              onChange({ type: e.target.value as FormFieldType })
            }
          >
            {FORM_FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {formFieldTypeLabels[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {fieldTypeHasOptions(row.type) ? (
        <div className="grid gap-1.5">
          <Label className="text-xs">Opciones (separadas por comas)</Label>
          <Input
            value={row.options.join(", ")}
            onChange={(e) =>
              onChange({ options: e.target.value.split(",").map((o) => o.trim()) })
            }
            placeholder="Pequeña, Mediana, Grande"
          />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-1.5">
          <Label className="text-xs">Guardar en (mapeo)</Label>
          <select
            className={selectClass}
            value={row.target}
            onChange={(e) => onChange({ target: e.target.value })}
          >
            <option value="">— No mapear (solo guardar) —</option>
            {targetOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <label className="mt-6 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={row.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          Obligatorio
        </label>
      </div>
    </div>
  );
}
