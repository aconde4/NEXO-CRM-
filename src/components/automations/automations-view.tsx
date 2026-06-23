"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Settings2,
  Trash2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { getTriggerMeta } from "@/lib/automations";
import type { AutomationListItem } from "@/server/queries/automations";
import {
  createAutomation,
  deleteAutomation,
  setAutomationStatus,
} from "@/server/actions/automations";
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
  AutomationListItem["status"],
  { label: string; variant: BadgeVariant; className?: string }
> = {
  draft: { label: "Borrador", variant: "secondary" },
  active: {
    label: "Activa",
    variant: "secondary",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  paused: { label: "Pausada", variant: "outline" },
  archived: { label: "Archivada", variant: "outline" },
};

export function AutomationsView({
  automations,
}: {
  automations: AutomationListItem[];
}) {
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Nueva automatización
        </Button>
      </div>

      {automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <Workflow className="text-muted-foreground size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Aún no tienes automatizaciones</p>
              <p className="text-muted-foreground text-sm">
                Crea un flujo: disparador → condiciones → esperas → acciones.
              </p>
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Nueva automatización
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {automations.map((automation) => (
            <AutomationCard key={automation.id} automation={automation} />
          ))}
        </div>
      )}

      <CreateDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function AutomationCard({
  automation,
}: {
  automation: AutomationListItem;
}) {
  const router = useRouter();
  const status = statusMeta[automation.status];
  const trigger = getTriggerMeta(automation.triggerType);

  async function toggle() {
    const next = automation.status === "active" ? "paused" : "active";
    try {
      await setAutomationStatus(automation.id, next);
      toast.success(next === "active" ? "Activada" : "Pausada");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cambiar el estado",
      );
    }
  }

  async function remove() {
    try {
      await deleteAutomation(automation.id);
      toast.success("Automatización eliminada");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar",
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate text-base">
          <Link
            href={`/automations/${automation.id}`}
            className="hover:underline"
          >
            {automation.name}
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
              <DropdownMenuItem
                render={<Link href={`/automations/${automation.id}`} />}
              >
                <Settings2 />
                Editar flujo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggle}>
                {automation.status === "active" ? <Pause /> : <Play />}
                {automation.status === "active" ? "Pausar" : "Activar"}
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
          <Badge variant="outline">
            {trigger ? trigger.label : "Sin disparador"}
          </Badge>
        </div>
        {automation.description ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {automation.description}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {automation.nodeCount}{" "}
          {automation.nodeCount === 1 ? "paso" : "pasos"}
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
      const { id } = await createAutomation({ name: name.trim() });
      toast.success("Automatización creada");
      onClose();
      router.push(`/automations/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear");
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nueva automatización</DialogTitle>
        <DialogDescription>
          Ponle un nombre; configurarás el flujo a continuación.
        </DialogDescription>
      </DialogHeader>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Bienvenida a nuevos contactos"
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
