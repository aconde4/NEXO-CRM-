"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GitBranch,
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
import type {
  AutomationBuilderOptions,
  AutomationListItem,
} from "@/server/queries/automations";
import {
  createAutomation,
  createPipelineAutomationTemplate,
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
import { Label } from "@/components/ui/label";
import { AIAutomationDraftButton } from "@/components/ai/ai-workflow-draft-dialog";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];
type PipelineTemplateKind = "stage_task" | "stage_sequence";
type AIStatus = {
  configured: boolean;
  model: string | null;
  provider: string | null;
  reason: string | null;
};

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

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
  aiStatus,
  automations,
  options,
}: {
  aiStatus: AIStatus;
  automations: AutomationListItem[];
  options: AutomationBuilderOptions;
}) {
  const [creating, setCreating] = React.useState(false);
  const [templating, setTemplating] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <AIAutomationDraftButton aiStatus={aiStatus} />
        <Button variant="outline" onClick={() => setTemplating(true)}>
          <GitBranch />
          Plantilla de embudo
        </Button>
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
            <AIAutomationDraftButton aiStatus={aiStatus} />
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
      <PipelineTemplateDialog
        open={templating}
        onOpenChange={setTemplating}
        options={options}
      />
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

function PipelineTemplateDialog({
  open,
  onOpenChange,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: AutomationBuilderOptions;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <PipelineTemplateDialogBody
            onClose={() => onOpenChange(false)}
            options={options}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PipelineTemplateDialogBody({
  onClose,
  options,
}: {
  onClose: () => void;
  options: AutomationBuilderOptions;
}) {
  const router = useRouter();
  const [kind, setKind] = React.useState<PipelineTemplateKind>("stage_task");
  const [stageId, setStageId] = React.useState(options.stages[0]?.id ?? "");
  const [sequenceId, setSequenceId] = React.useState(
    options.sequences[0]?.id ?? "",
  );
  const [taskSubject, setTaskSubject] = React.useState(
    "Revisar contacto en esta etapa",
  );
  const [busy, setBusy] = React.useState(false);

  const hasStages = options.stages.length > 0;
  const hasSequences = options.sequences.length > 0;
  const canSubmit =
    hasStages &&
    Boolean(stageId) &&
    (kind === "stage_task" ? Boolean(taskSubject.trim()) : Boolean(sequenceId));

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const payload =
        kind === "stage_task"
          ? { kind, stageId, taskSubject: taskSubject.trim() }
          : { kind, sequenceId, stageId };
      const { id } = await createPipelineAutomationTemplate(payload);
      toast.success("Plantilla creada");
      onClose();
      router.push(`/automations/${id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo crear la plantilla",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Plantilla de embudo</DialogTitle>
        <DialogDescription>
          Crea un flujo al entrar en una etapa del embudo.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Cuando entra en etapa</Label>
          <select
            className={selectClass}
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            disabled={!hasStages}
          >
            {hasStages ? null : <option value="">No hay etapas</option>}
            {options.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label>Acción</Label>
          <select
            className={selectClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as PipelineTemplateKind)}
          >
            <option value="stage_task">Crear tarea</option>
            <option value="stage_sequence" disabled={!hasSequences}>
              Inscribir en secuencia
            </option>
          </select>
        </div>

        {kind === "stage_task" ? (
          <div className="grid gap-1.5">
            <Label>Asunto de la tarea</Label>
            <Input
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="Revisar contacto en esta etapa"
            />
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label>Secuencia</Label>
            <select
              className={selectClass}
              value={sequenceId}
              onChange={(e) => setSequenceId(e.target.value)}
              disabled={!hasSequences}
            >
              {hasSequences ? null : <option value="">No hay secuencias</option>}
              {options.sequences.map((sequence) => (
                <option key={sequence.id} value={sequence.id}>
                  {sequence.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!hasStages ? (
          <p className="text-destructive text-sm">
            Crea al menos una etapa en Negocios para usar esta plantilla.
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancelar
        </DialogClose>
        <Button onClick={() => void submit()} disabled={!canSubmit || busy}>
          {busy ? "Creando…" : "Crear y revisar"}
        </Button>
      </DialogFooter>
    </>
  );
}
