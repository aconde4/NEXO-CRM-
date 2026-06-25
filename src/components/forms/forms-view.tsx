"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { FormListItem } from "@/server/queries/forms";
import {
  createForm,
  deleteForm,
  setFormStatus,
} from "@/server/actions/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const statusMeta: Record<
  FormListItem["status"],
  { label: string; variant: BadgeVariant; className?: string }
> = {
  draft: { label: "Borrador", variant: "secondary" },
  active: {
    label: "Publicado",
    variant: "secondary",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  archived: { label: "Archivado", variant: "outline" },
};

export function FormsView({ forms }: { forms: FormListItem[] }) {
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Nuevo formulario
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <ClipboardList className="text-muted-foreground size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Aún no tienes formularios</p>
              <p className="text-muted-foreground text-sm">
                Crea un formulario para captar leads en tu web.
              </p>
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Nuevo formulario
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {forms.map((form) => (
            <FormCard key={form.id} form={form} />
          ))}
        </div>
      )}

      <CreateDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function FormCard({ form }: { form: FormListItem }) {
  const router = useRouter();
  const status = statusMeta[form.status];

  async function toggle() {
    const next = form.status === "active" ? "draft" : "active";
    try {
      await setFormStatus(form.id, next);
      toast.success(next === "active" ? "Formulario publicado" : "Despublicado");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cambiar el estado",
      );
    }
  }

  async function remove() {
    try {
      await deleteForm(form.id);
      toast.success("Formulario eliminado");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate text-base">
          <Link href={`/forms/${form.id}`} className="hover:underline">
            {form.name}
          </Link>
        </CardTitle>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Acciones" />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/forms/${form.id}`} />}>
                <Settings2 />
                Editar formulario
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggle}>
                {form.status === "active" ? <Pause /> : <Play />}
                {form.status === "active" ? "Despublicar" : "Publicar"}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={remove}>
                <Trash2 />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant} className={status.className}>
            {status.label}
          </Badge>
        </div>
        {form.description ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {form.description}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {form.fieldCount} {form.fieldCount === 1 ? "campo" : "campos"} ·{" "}
          {form.submissionCount}{" "}
          {form.submissionCount === 1 ? "envío" : "envíos"}
        </p>
      </CardContent>
    </Card>
  );
}

function CreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {open ? <CreateDialogBody onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateDialogBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const { id } = await createForm({ name: name.trim() });
      toast.success("Formulario creado");
      onClose();
      router.push(`/forms/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear");
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nuevo formulario</DialogTitle>
        <DialogDescription>
          Ponle un nombre; añadirás los campos a continuación.
        </DialogDescription>
      </DialogHeader>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Contacto desde la web"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancelar
        </DialogClose>
        <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
          {busy ? "Creando…" : "Crear y editar"}
        </Button>
      </DialogFooter>
    </>
  );
}
