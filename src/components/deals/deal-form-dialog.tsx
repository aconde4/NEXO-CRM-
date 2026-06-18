"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { dealFormSchema, type DealFormValues } from "@/lib/validations/deal";
import { createDeal, updateDeal } from "@/server/actions/deals";
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

export type Option = { id: string; name: string };

export type DealInitial = {
  id: string;
  title: string;
  value: number;
  currency: string;
  pipelineId: string;
  stageId: string;
  personId: string | null;
  orgId: string | null;
  expectedCloseDate: Date | string | null;
};

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

const CURRENCIES = ["EUR", "USD", "GBP"];

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function DealFormDialog({
  open,
  onOpenChange,
  deal,
  pipelines,
  stagesByPipeline,
  persons,
  organizations,
  defaultPipelineId,
  defaultStageId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: DealInitial | null;
  pipelines: Option[];
  stagesByPipeline: Record<string, Option[]>;
  persons: Option[];
  organizations: Option[];
  defaultPipelineId?: string;
  defaultStageId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <DealFormBody
            key={deal?.id ?? "new"}
            deal={deal}
            pipelines={pipelines}
            stagesByPipeline={stagesByPipeline}
            persons={persons}
            organizations={organizations}
            defaultPipelineId={defaultPipelineId}
            defaultStageId={defaultStageId}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DealFormBody({
  deal,
  pipelines,
  stagesByPipeline,
  persons,
  organizations,
  defaultPipelineId,
  defaultStageId,
  onDone,
}: {
  deal?: DealInitial | null;
  pipelines: Option[];
  stagesByPipeline: Record<string, Option[]>;
  persons: Option[];
  organizations: Option[];
  defaultPipelineId?: string;
  defaultStageId?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(deal);
  const initialPipeline =
    deal?.pipelineId ?? defaultPipelineId ?? pipelines[0]?.id ?? "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      title: deal?.title ?? "",
      value: deal?.value != null ? String(deal.value) : "",
      currency: deal?.currency ?? "EUR",
      pipelineId: initialPipeline,
      stageId:
        deal?.stageId ??
        defaultStageId ??
        stagesByPipeline[initialPipeline]?.[0]?.id ??
        "",
      personId: deal?.personId ?? "",
      orgId: deal?.orgId ?? "",
      expectedCloseDate: toDateInput(deal?.expectedCloseDate),
    },
  });

  const pipelineId = watch("pipelineId");
  const stageOptions = stagesByPipeline[pipelineId] ?? [];

  async function onSubmit(values: DealFormValues) {
    try {
      if (isEdit && deal) {
        await updateDeal(deal.id, values);
        toast.success("Negocio actualizado");
      } else {
        await createDeal(values);
        toast.success("Negocio creado");
      }
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el negocio",
      );
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar negocio" : "Nuevo negocio"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Actualiza los datos de este negocio."
            : "Añade una oportunidad a tu embudo."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <Field label="Título" required error={errors.title?.message}>
          <Input
            {...register("title")}
            placeholder="Suscripción anual — Acme"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor" error={errors.value?.message}>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0"
                className="flex-1"
                {...register("value")}
              />
              <select {...register("currency")} className={`${selectClass} w-24`}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Cierre previsto" error={errors.expectedCloseDate?.message}>
            <Input type="date" {...register("expectedCloseDate")} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Embudo" required error={errors.pipelineId?.message}>
            <select
              className={selectClass}
              {...register("pipelineId")}
              onChange={(e) => {
                setValue("pipelineId", e.target.value);
                const first = stagesByPipeline[e.target.value]?.[0]?.id ?? "";
                setValue("stageId", first);
              }}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Etapa" required error={errors.stageId?.message}>
            <select {...register("stageId")} className={selectClass}>
              {stageOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contacto" error={errors.personId?.message}>
            <select {...register("personId")} className={selectClass}>
              <option value="">— Sin contacto —</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Empresa" error={errors.orgId?.message}>
            <select {...register("orgId")} className={selectClass}>
              <option value="">— Sin empresa —</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear negocio"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
