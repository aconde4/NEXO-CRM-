"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { StageInputValues } from "@/lib/validations/deal";
import {
  createPipeline,
  createStage,
  deletePipeline,
  deleteStage,
  reorderStages,
  updatePipeline,
  updateStage,
} from "@/server/actions/pipelines";
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

export type StageRow = {
  id: string;
  name: string;
  probability: number;
  rottingDays: number | null;
};

export type PipelineWithStages = {
  id: string;
  name: string;
  stages: StageRow[];
};

export function PipelinesManager({
  pipelines,
}: {
  pipelines: PipelineWithStages[];
}) {
  const [pipelineDialog, setPipelineDialog] = React.useState<
    { id: string; name: string } | "new" | null
  >(null);
  const [stageDialog, setStageDialog] = React.useState<{
    pipelineId: string;
    stage: StageRow | null;
  } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">Embudos y etapas</h3>
          <p className="text-muted-foreground text-sm">
            Configura tus procesos de venta.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPipelineDialog("new")}>
          <Plus />
          Nuevo embudo
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {pipelines.map((pipeline) => (
          <PipelineCard
            key={pipeline.id}
            pipeline={pipeline}
            onRename={() =>
              setPipelineDialog({ id: pipeline.id, name: pipeline.name })
            }
            onAddStage={() =>
              setStageDialog({ pipelineId: pipeline.id, stage: null })
            }
            onEditStage={(stage) =>
              setStageDialog({ pipelineId: pipeline.id, stage })
            }
          />
        ))}
      </div>

      <Dialog
        open={pipelineDialog !== null}
        onOpenChange={(o) => !o && setPipelineDialog(null)}
      >
        <DialogContent className="sm:max-w-sm">
          {pipelineDialog !== null ? (
            <PipelineBody
              initial={pipelineDialog === "new" ? null : pipelineDialog}
              onClose={() => setPipelineDialog(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={stageDialog !== null}
        onOpenChange={(o) => !o && setStageDialog(null)}
      >
        <DialogContent className="sm:max-w-sm">
          {stageDialog !== null ? (
            <StageBody
              pipelineId={stageDialog.pipelineId}
              stage={stageDialog.stage}
              onClose={() => setStageDialog(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PipelineCard({
  pipeline,
  onRename,
  onAddStage,
  onEditStage,
}: {
  pipeline: PipelineWithStages;
  onRename: () => void;
  onAddStage: () => void;
  onEditStage: (stage: StageRow) => void;
}) {
  const router = useRouter();
  const ids = pipeline.stages.map((s) => s.id);

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target]!, next[index]!];
    try {
      await reorderStages(pipeline.id, next);
      router.refresh();
    } catch {
      toast.error("No se pudo reordenar");
    }
  }

  async function removePipeline() {
    try {
      await deletePipeline(pipeline.id);
      toast.success("Embudo eliminado");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  async function removeStage(id: string) {
    try {
      await deleteStage(id);
      toast.success("Etapa eliminada");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{pipeline.name}</CardTitle>
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
              <DropdownMenuItem onClick={onRename}>
                <Pencil />
                Renombrar
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={removePipeline}>
                <Trash2 />
                Eliminar embudo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <div className="divide-y">
          {pipeline.stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-2 px-6 py-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label="Subir"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Bajar"
                  disabled={index === pipeline.stages.length - 1}
                  onClick={() => move(index, 1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{stage.name}</p>
                <p className="text-muted-foreground text-xs">
                  {stage.probability}% prob.
                  {stage.rottingDays
                    ? ` · estancado a ${stage.rottingDays} d`
                    : ""}
                </p>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {stage.probability}%
              </Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Editar etapa"
                onClick={() => onEditStage(stage)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Eliminar etapa"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeStage(stage.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="px-6 pt-2">
          <Button variant="outline" size="sm" onClick={onAddStage}>
            <Plus />
            Nueva etapa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineBody({
  initial,
  onClose,
}: {
  initial: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [busy, setBusy] = React.useState(false);
  const isEdit = Boolean(initial);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (isEdit && initial) await updatePipeline(initial.id, { name });
      else await createPipeline({ name });
      toast.success(isEdit ? "Embudo actualizado" : "Embudo creado");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Renombrar embudo" : "Nuevo embudo"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Cambia el nombre del embudo."
            : "Se crea con una etapa inicial que podrás configurar."}
        </DialogDescription>
      </DialogHeader>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Embudo de ventas"
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
          {busy ? "Guardando…" : isEdit ? "Guardar" : "Crear"}
        </Button>
      </DialogFooter>
    </>
  );
}

function StageBody({
  pipelineId,
  stage,
  onClose,
}: {
  pipelineId: string;
  stage: StageRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(stage);
  const [name, setName] = React.useState(stage?.name ?? "");
  const [probability, setProbability] = React.useState(
    String(stage?.probability ?? 0),
  );
  const [rottingDays, setRottingDays] = React.useState(
    stage?.rottingDays != null ? String(stage.rottingDays) : "",
  );
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    const payload: StageInputValues = {
      name,
      probability: Number(probability) || 0,
      rottingDays: rottingDays === "" ? "" : Number(rottingDays),
    };
    try {
      if (isEdit && stage) await updateStage(stage.id, payload);
      else await createStage(pipelineId, payload);
      toast.success(isEdit ? "Etapa actualizada" : "Etapa creada");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar etapa" : "Nueva etapa"}</DialogTitle>
        <DialogDescription>
          La probabilidad alimenta la previsión ponderada.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label>Nombre</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Propuesta enviada"
            autoFocus
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Probabilidad (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Días para estancar</Label>
            <Input
              type="number"
              min={1}
              placeholder="—"
              value={rottingDays}
              onChange={(e) => setRottingDays(e.target.value)}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancelar
        </DialogClose>
        <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
          {busy ? "Guardando…" : isEdit ? "Guardar" : "Crear"}
        </Button>
      </DialogFooter>
    </>
  );
}
