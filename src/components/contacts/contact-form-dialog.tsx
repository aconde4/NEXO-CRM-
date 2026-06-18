"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { CustomFieldDef } from "@/lib/custom-fields";
import {
  personFormSchema,
  type PersonFormValues,
} from "@/lib/validations/contact";
import { createPerson, updatePerson } from "@/server/actions/contacts";
import {
  CustomFieldsSection,
  toCustomFormValues,
  type CustomValues,
} from "@/components/custom-fields/custom-fields-section";
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

export type OrgOption = { id: string; name: string };

export type ContactInitial = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  orgId: string | null;
  source: string | null;
  customFields?: Record<string, unknown> | null;
};

function toDefaults(c?: ContactInitial | null): PersonFormValues {
  return {
    firstName: c?.firstName ?? "",
    lastName: c?.lastName ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    title: c?.title ?? "",
    orgId: c?.orgId ?? "",
    source: c?.source ?? "",
  };
}

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

export function ContactFormDialog({
  open,
  onOpenChange,
  organizations,
  contact,
  customFieldDefs = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: OrgOption[];
  contact?: ContactInitial | null;
  customFieldDefs?: CustomFieldDef[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Se remonta al abrir: los inputs se reinician con los datos actuales. */}
        {open ? (
          <ContactFormBody
            key={contact?.id ?? "new"}
            organizations={organizations}
            contact={contact}
            customFieldDefs={customFieldDefs}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ContactFormBody({
  organizations,
  contact,
  customFieldDefs,
  onDone,
}: {
  organizations: OrgOption[];
  contact?: ContactInitial | null;
  customFieldDefs: CustomFieldDef[];
  onDone: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(contact);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: toDefaults(contact),
  });

  const [customValues, setCustomValues] = React.useState<CustomValues>(() =>
    toCustomFormValues(customFieldDefs, contact?.customFields),
  );

  async function onSubmit(values: PersonFormValues) {
    try {
      if (isEdit && contact) {
        await updatePerson(contact.id, values, customValues);
        toast.success("Contacto actualizado");
      } else {
        await createPerson(values, customValues);
        toast.success("Contacto creado");
      }
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el contacto",
      );
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar contacto" : "Nuevo contacto"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Actualiza los datos de este contacto."
            : "Añade una persona a tu CRM."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" required error={errors.firstName?.message}>
            <Input {...register("firstName")} placeholder="Ana" />
          </Field>
          <Field label="Apellidos" error={errors.lastName?.message}>
            <Input {...register("lastName")} placeholder="García" />
          </Field>
        </div>

        <Field label="Email" error={errors.email?.message}>
          <Input
            type="email"
            {...register("email")}
            placeholder="ana@empresa.com"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono" error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="+34 600 000 000" />
          </Field>
          <Field label="Cargo" error={errors.title?.message}>
            <Input {...register("title")} placeholder="Directora de Marketing" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa" error={errors.orgId?.message}>
            <select {...register("orgId")} className={selectClass}>
              <option value="">— Sin empresa —</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Origen" error={errors.source?.message}>
            <Input {...register("source")} placeholder="Web, referido…" />
          </Field>
        </div>

        <CustomFieldsSection
          defs={customFieldDefs}
          values={customValues}
          onChange={(key, value) =>
            setCustomValues((prev) => ({ ...prev, [key]: value }))
          }
        />

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear contacto"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
