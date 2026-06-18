"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  CUSTOM_FIELD_TYPES,
  customFieldTypeMeta,
  type CustomEntityType,
  type CustomFieldDef,
  type CustomFieldType,
} from "@/lib/custom-fields";
import {
  createCustomFieldDef,
  deleteCustomFieldDef,
  updateCustomFieldDef,
} from "@/server/actions/custom-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

type DialogState = {
  entityType: CustomEntityType;
  def: CustomFieldDef | null;
};

export function CustomFieldsManager({
  personDefs,
  organizationDefs,
}: {
  personDefs: CustomFieldDef[];
  organizationDefs: CustomFieldDef[];
}) {
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  const [deleting, setDeleting] = React.useState<CustomFieldDef | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <FieldSection
        title="Campos de contacto"
        description="Datos extra en las fichas de contacto."
        defs={personDefs}
        onAdd={() => setDialog({ entityType: "person", def: null })}
        onEdit={(def) => setDialog({ entityType: "person", def })}
        onDelete={setDeleting}
      />
      <FieldSection
        title="Campos de empresa"
        description="Datos extra en las fichas de empresa."
        defs={organizationDefs}
        onAdd={() => setDialog({ entityType: "organization", def: null })}
        onEdit={(def) => setDialog({ entityType: "organization", def })}
        onDelete={setDeleting}
      />

      {dialog ? (
        <CustomFieldDefDialog
          key={dialog.def?.id ?? `new-${dialog.entityType}`}
          entityType={dialog.entityType}
          def={dialog.def}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <DeleteDialog deleting={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function FieldSection({
  title,
  description,
  defs,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  description: string;
  defs: CustomFieldDef[];
  onAdd: () => void;
  onEdit: (def: CustomFieldDef) => void;
  onDelete: (def: CustomFieldDef) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus />
            Añadir
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {defs.length === 0 ? (
          <p className="text-muted-foreground px-6 py-6 text-center text-sm">
            Sin campos personalizados todavía.
          </p>
        ) : (
          <div className="divide-y">
            {defs.map((def) => {
              const meta = customFieldTypeMeta[def.type];
              const Icon = meta.icon;
              return (
                <div
                  key={def.id}
                  className="flex items-center gap-3 px-6 py-2.5"
                >
                  <GripVertical className="text-muted-foreground/40 size-4 shrink-0" />
                  <Icon className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{def.label}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {meta.label}
                      {meta.hasOptions && def.options.length
                        ? ` · ${def.options.length} opciones`
                        : ""}
                    </p>
                  </div>
                  {def.required ? (
                    <Badge variant="secondary" className="font-normal">
                      Obligatorio
                    </Badge>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Acciones"
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(def)}>
                        <Pencil />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(def)}
                      >
                        <Trash2 />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomFieldDefDialog({
  entityType,
  def,
  onClose,
}: {
  entityType: CustomEntityType;
  def: CustomFieldDef | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(def);
  const [label, setLabel] = React.useState(def?.label ?? "");
  const [type, setType] = React.useState<CustomFieldType>(def?.type ?? "text");
  const [options, setOptions] = React.useState<string[]>(
    def?.options.length ? def.options : [""],
  );
  const [required, setRequired] = React.useState(def?.required ?? false);
  const [saving, setSaving] = React.useState(false);

  const hasOptions = customFieldTypeMeta[type].hasOptions;

  async function submit() {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!label.trim()) {
      toast.error("Escribe un nombre para el campo.");
      return;
    }
    if (hasOptions && cleanOptions.length === 0) {
      toast.error("Añade al menos una opción.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && def) {
        await updateCustomFieldDef(def.id, {
          label,
          type,
          options: cleanOptions,
          required,
        });
        toast.success("Campo actualizado");
      } else {
        await createCustomFieldDef({
          entityType,
          label,
          type,
          options: cleanOptions,
          required,
        });
        toast.success("Campo creado");
      }
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el campo",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar campo" : "Nuevo campo personalizado"}
          </DialogTitle>
          <DialogDescription>
            {entityType === "person"
              ? "Se mostrará en las fichas y formularios de contacto."
              : "Se mostrará en las fichas y formularios de empresa."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ingresos anuales"
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <select
              className={selectClass}
              value={type}
              onChange={(e) => setType(e.target.value as CustomFieldType)}
            >
              {CUSTOM_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {customFieldTypeMeta[t].label}
                </option>
              ))}
            </select>
          </div>

          {hasOptions ? (
            <div className="grid gap-1.5">
              <Label>Opciones</Label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.map((o, j) => (j === i ? e.target.value : o)),
                        )
                      }
                      placeholder={`Opción ${i + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      aria-label="Quitar opción"
                      onClick={() =>
                        setOptions((prev) =>
                          prev.length > 1
                            ? prev.filter((_, j) => j !== i)
                            : prev,
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setOptions((prev) => [...prev, ""])}
                >
                  <Plus />
                  Añadir opción
                </Button>
              </div>
            </div>
          ) : null}

          <label className="flex w-fit items-center gap-2 text-sm">
            <Checkbox
              checked={required}
              onCheckedChange={(c) => setRequired(Boolean(c))}
            />
            Marcar como obligatorio
          </label>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear campo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  deleting,
  onClose,
}: {
  deleting: CustomFieldDef | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteCustomFieldDef(deleting.id);
      toast.success("Campo eliminado");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(deleting)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>¿Eliminar el campo?</DialogTitle>
          <DialogDescription>
            Se eliminará{" "}
            <span className="text-foreground font-medium">
              {deleting?.label}
            </span>{" "}
            de los formularios y fichas. Los valores ya guardados dejarán de
            mostrarse. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
