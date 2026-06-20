"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import {
  DEFAULT_SEGMENT_FIELD,
  OP_LABELS,
  type SegmentMatch,
  type SegmentRule,
  type SegmentRuleOp,
  SEGMENT_FIELDS,
  defaultRuleForField,
  getSegmentField,
  opNeedsValue,
} from "@/lib/segments";
import {
  type SegmentFormValues,
  segmentFormSchema,
} from "@/lib/validations/segment";
import {
  type SegmentPreview,
  createSegment,
  previewSegmentAudience,
  updateSegment,
} from "@/server/actions/segments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type LabelOption = { id: string; name: string };

export type SegmentInitial = {
  id: string;
  name: string;
  description: string | null;
  match: SegmentMatch;
  rules: SegmentRule[];
};

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

export function SegmentFormDialog({
  open,
  onOpenChange,
  segment,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment?: SegmentInitial | null;
  labels: LabelOption[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open ? (
          <SegmentFormBody
            key={segment?.id ?? "new"}
            segment={segment}
            labels={labels}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SegmentFormBody({
  segment,
  labels,
  onDone,
}: {
  segment?: SegmentInitial | null;
  labels: LabelOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(segment);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SegmentFormValues>({
    resolver: zodResolver(segmentFormSchema),
    defaultValues: {
      name: segment?.name ?? "",
      description: segment?.description ?? "",
    },
  });

  const [match, setMatch] = React.useState<SegmentMatch>(
    segment?.match ?? "all",
  );
  const [rules, setRules] = React.useState<SegmentRule[]>(
    segment?.rules ?? [],
  );

  const [preview, setPreview] = React.useState<SegmentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  // Previsualización en vivo (debounce) del tamaño de audiencia.
  React.useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      setPreviewLoading(true);
      previewSegmentAudience({ match, rules })
        .then((result) => {
          if (active) setPreview(result);
        })
        .catch(() => {
          if (active) setPreview(null);
        })
        .finally(() => {
          if (active) setPreviewLoading(false);
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [match, rules]);

  function addRule() {
    setRules((prev) => [
      ...prev,
      defaultRuleForField(DEFAULT_SEGMENT_FIELD.key),
    ]);
  }

  function updateRule(index: number, next: SegmentRule) {
    setRules((prev) => prev.map((r, i) => (i === index ? next : r)));
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(values: SegmentFormValues) {
    const payload = {
      name: values.name,
      description: values.description,
      kind: "dynamic" as const,
      definition: { match, rules },
    };
    try {
      if (isEdit && segment) {
        await updateSegment(segment.id, payload);
        toast.success("Segmento actualizado");
      } else {
        await createSegment(payload);
        toast.success("Segmento creado");
      }
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el segmento",
      );
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar segmento" : "Nuevo segmento"}</DialogTitle>
        <DialogDescription>
          Define la audiencia con filtros. Verás el tamaño estimado en tiempo real.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label>
            Nombre<span className="text-destructive"> *</span>
          </Label>
          <Input {...register("name")} placeholder="Clientes activos en España" />
          {errors.name ? (
            <p className="text-destructive text-xs">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label>Descripción</Label>
          <Input
            {...register("description")}
            placeholder="Opcional: para qué usas este segmento"
          />
        </div>

        <div className="grid gap-2 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Cumplen</span>
            <select
              className={`${selectClass} h-8 w-auto`}
              value={match}
              onChange={(e) => setMatch(e.target.value as SegmentMatch)}
            >
              <option value="all">todas</option>
              <option value="any">cualquiera</option>
            </select>
            <span className="text-muted-foreground">
              de estas condiciones:
            </span>
          </div>

          {rules.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">
              Sin condiciones: la audiencia es <strong>todos tus contactos</strong>.
            </p>
          ) : (
            <div className="grid gap-2">
              {rules.map((rule, index) => (
                <RuleRow
                  key={index}
                  rule={rule}
                  labels={labels}
                  onChange={(next) => updateRule(index, next)}
                  onRemove={() => removeRule(index)}
                />
              ))}
            </div>
          )}

          <div>
            <Button type="button" variant="outline" size="sm" onClick={addRule}>
              <Plus />
              Añadir condición
            </Button>
          </div>
        </div>

        <AudiencePreview loading={previewLoading} preview={preview} />

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear segmento"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function RuleRow({
  rule,
  labels,
  onChange,
  onRemove,
}: {
  rule: SegmentRule;
  labels: LabelOption[];
  onChange: (next: SegmentRule) => void;
  onRemove: () => void;
}) {
  const field = getSegmentField(rule.field) ?? DEFAULT_SEGMENT_FIELD;
  const showValue = opNeedsValue(rule.op);

  function onFieldChange(key: string) {
    onChange(defaultRuleForField(key));
  }

  function onOpChange(op: SegmentRuleOp) {
    onChange({ ...rule, op, value: opNeedsValue(op) ? rule.value : "" });
  }

  function onValueChange(value: string) {
    onChange({ ...rule, value });
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-center">
      <select
        className={selectClass}
        value={field.key}
        onChange={(e) => onFieldChange(e.target.value)}
      >
        {SEGMENT_FIELDS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={rule.op}
        onChange={(e) => onOpChange(e.target.value as SegmentRuleOp)}
      >
        {field.ops.map((op) => (
          <option key={op} value={op}>
            {OP_LABELS[op]}
          </option>
        ))}
      </select>

      {showValue ? (
        <RuleValueInput
          field={field.key}
          value={rule.value ?? ""}
          labels={labels}
          onChange={onValueChange}
        />
      ) : (
        <span className="text-muted-foreground hidden text-xs sm:block">—</span>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Quitar condición"
        className="text-muted-foreground hover:text-destructive justify-self-start"
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function RuleValueInput({
  field,
  value,
  labels,
  onChange,
}: {
  field: string;
  value: string;
  labels: LabelOption[];
  onChange: (value: string) => void;
}) {
  const def = getSegmentField(field);
  if (!def) return null;

  if (def.type === "enum") {
    return (
      <select
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Elige —</option>
        {def.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (def.type === "label") {
    return (
      <select
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Elige etiqueta —</option>
        {labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    );
  }

  if (def.type === "date") {
    return (
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      value={value}
      placeholder="Valor"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function AudiencePreview({
  loading,
  preview,
}: {
  loading: boolean;
  preview: SegmentPreview | null;
}) {
  const audience = preview?.audience;
  return (
    <div className="bg-muted/40 grid gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Users className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Audiencia estimada</span>
        {loading ? (
          <span className="text-muted-foreground text-xs">calculando…</span>
        ) : null}
      </div>
      {audience ? (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-2xl font-semibold tabular-nums">
            {audience.reachable}
          </span>
          <span className="text-muted-foreground text-sm">
            destinatarios alcanzables
          </span>
          <span className="text-muted-foreground text-xs">
            · {audience.withEmail} con email · {audience.total} contactos
          </span>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {loading ? "—" : "No se pudo calcular la audiencia."}
        </p>
      )}
      {preview && preview.sample.length > 0 ? (
        <p className="text-muted-foreground truncate text-xs">
          P. ej.{" "}
          {preview.sample
            .map((p) => [p.firstName, p.lastName].filter(Boolean).join(" "))
            .join(", ")}
          {audience && audience.total > preview.sample.length ? "…" : ""}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Solo se envía a contactos suscritos; la lista de supresión (RGPD) se aplica
        antes de cada envío.
      </p>
    </div>
  );
}
