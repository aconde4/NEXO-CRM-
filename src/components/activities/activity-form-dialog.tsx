"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ACTIVITY_TYPES,
  activityTypeMeta,
  toDateTimeLocal,
  type ActivityTypeValue,
} from "@/lib/activities";
import {
  activityFormSchema,
  type ActivityFormValues,
} from "@/lib/validations/activity";
import { createActivity, updateActivity } from "@/server/actions/activities";
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
import { Textarea } from "@/components/ui/textarea";

export type EntityOption = { id: string; name: string };

export type ActivityInitial = {
  id: string;
  type: ActivityTypeValue;
  subject: string;
  notes: string | null;
  dueAt: Date | string | null;
  personId: string | null;
  orgId: string | null;
};

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

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

function toDefaults(
  activity: ActivityInitial | null | undefined,
  locked: { personId?: string; orgId?: string },
): ActivityFormValues {
  return {
    type: activity?.type ?? "task",
    subject: activity?.subject ?? "",
    notes: activity?.notes ?? "",
    dueAt: toDateTimeLocal(activity?.dueAt),
    personId: locked.personId ?? activity?.personId ?? "",
    orgId: locked.orgId ?? activity?.orgId ?? "",
  };
}

export function ActivityFormDialog({
  open,
  onOpenChange,
  activity,
  persons = [],
  organizations = [],
  lockedPersonId,
  lockedOrgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: ActivityInitial | null;
  /** Opciones para asignar a un contacto (se ocultan si la ficha lo fija). */
  persons?: EntityOption[];
  /** Opciones para asignar a una empresa (se ocultan si la ficha la fija). */
  organizations?: EntityOption[];
  lockedPersonId?: string;
  lockedOrgId?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(activity);
  const locked = Boolean(lockedPersonId || lockedOrgId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: toDefaults(activity, {
      personId: lockedPersonId,
      orgId: lockedOrgId,
    }),
  });

  React.useEffect(() => {
    if (open)
      reset(toDefaults(activity, { personId: lockedPersonId, orgId: lockedOrgId }));
  }, [open, activity, lockedPersonId, lockedOrgId, reset]);

  async function onSubmit(values: ActivityFormValues) {
    const payload: ActivityFormValues = {
      ...values,
      dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
      personId: lockedPersonId ?? (values.personId || undefined),
      orgId: lockedOrgId ?? (values.orgId || undefined),
    };
    try {
      if (isEdit && activity) {
        await updateActivity(activity.id, payload);
        toast.success("Actividad actualizada");
      } else {
        await createActivity(payload);
        toast.success("Actividad creada");
      }
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la actividad",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar actividad" : "Nueva actividad"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos de esta tarea."
              : "Programa una tarea, llamada o reunión."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" error={errors.type?.message}>
              <select {...register("type")} className={selectClass}>
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {activityTypeMeta[type].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vencimiento" error={errors.dueAt?.message}>
              <Input type="datetime-local" {...register("dueAt")} />
            </Field>
          </div>

          <Field label="Asunto" required error={errors.subject?.message}>
            <Input
              {...register("subject")}
              placeholder="Llamar para confirmar la propuesta"
              autoFocus
            />
          </Field>

          {!locked ? (
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
          ) : null}

          <Field label="Notas" error={errors.notes?.message}>
            <Textarea
              {...register("notes")}
              placeholder="Detalles, contexto o resultado…"
              rows={3}
            />
          </Field>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Guardando…"
                : isEdit
                  ? "Guardar cambios"
                  : "Crear actividad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
