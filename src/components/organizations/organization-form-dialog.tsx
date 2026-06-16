"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  organizationFormSchema,
  type OrganizationFormValues,
} from "@/lib/validations/contact";
import {
  createOrganization,
  updateOrganization,
} from "@/server/actions/contacts";
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

export type OrganizationInitial = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  phone: string | null;
  industry: string | null;
  size: string | null;
  address: string | null;
};

function toDefaults(o?: OrganizationInitial | null): OrganizationFormValues {
  return {
    name: o?.name ?? "",
    domain: o?.domain ?? "",
    website: o?.website ?? "",
    phone: o?.phone ?? "",
    industry: o?.industry ?? "",
    size: o?.size ?? "",
    address: o?.address ?? "",
  };
}

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

export function OrganizationFormDialog({
  open,
  onOpenChange,
  organization,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: OrganizationInitial | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(organization);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: toDefaults(organization),
  });

  React.useEffect(() => {
    if (open) reset(toDefaults(organization));
  }, [open, organization, reset]);

  async function onSubmit(values: OrganizationFormValues) {
    try {
      if (isEdit && organization) {
        await updateOrganization(organization.id, values);
        toast.success("Empresa actualizada");
      } else {
        await createOrganization(values);
        toast.success("Empresa creada");
      }
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar la empresa",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar empresa" : "Nueva empresa"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos de esta empresa."
              : "Añade una empresa a tu CRM."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <Field label="Nombre" required error={errors.name?.message}>
            <Input {...register("name")} placeholder="Acme S.L." />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dominio" error={errors.domain?.message}>
              <Input {...register("domain")} placeholder="acme.com" />
            </Field>
            <Field label="Sitio web" error={errors.website?.message}>
              <Input {...register("website")} placeholder="https://acme.com" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono" error={errors.phone?.message}>
              <Input {...register("phone")} placeholder="+34 900 000 000" />
            </Field>
            <Field label="Sector" error={errors.industry?.message}>
              <Input {...register("industry")} placeholder="Software" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tamaño" error={errors.size?.message}>
              <Input {...register("size")} placeholder="1-10, 11-50…" />
            </Field>
            <Field label="Dirección" error={errors.address?.message}>
              <Input {...register("address")} placeholder="Calle, ciudad" />
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
                  : "Crear empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
