"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  getActionMeta,
  getTriggerMeta,
} from "@/lib/automations";
import type { SequenceBuilderValues } from "@/lib/validations/sequence";
import { generateWorkflowDraft } from "@/server/actions/ai";
import { createAutomationDraft } from "@/server/actions/automations";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";

type AIStatus = {
  configured: boolean;
  model: string | null;
  provider: string | null;
  reason: string | null;
};

type DraftResult = Awaited<ReturnType<typeof generateWorkflowDraft>>;
type WorkflowKind = "sequence" | "automation";

function formatCost(value: number): string {
  if (value <= 0) return "0 $";
  return `${value.toFixed(value < 0.01 ? 6 : 4)} $`;
}

function stepLabel(step: SequenceBuilderValues["steps"][number]): string {
  if (step.type === "email") return `Email: ${step.subject}`;
  if (step.type === "wait") {
    const parts = [
      step.waitDays ? `${step.waitDays} d` : "",
      step.waitHours ? `${step.waitHours} h` : "",
    ].filter(Boolean);
    return `Espera: ${parts.join(" ") || "1 d"}`;
  }
  if (step.type === "condition") return `Condicion: ${step.condition.kind}`;
  return `Tarea: ${step.taskSubject}`;
}

function automationStepLabel(
  node: NonNullable<DraftResult["automation"]>["graph"]["nodes"][number],
): string {
  if (node.type === "wait") {
    const days = Number(node.config?.waitDays ?? 0);
    const hours = Number(node.config?.waitHours ?? 0);
    return `Espera: ${days ? `${days} d` : ""}${
      hours ? ` ${hours} h` : ""
    }`.trim();
  }
  if (node.type === "condition") {
    return `Condicion: ${String(node.config?.field ?? "campo")} ${
      node.config?.op ?? "eq"
    }`;
  }
  return getActionMeta(node.kind)?.label ?? `Accion: ${node.kind ?? ""}`;
}

function WorkflowDraftPreview({ result }: { result: DraftResult }) {
  if (result.kind === "sequence" && result.sequence) {
    return (
      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium break-words">{result.sequence.name}</p>
          <Badge variant="secondary">Borrador</Badge>
          <Badge variant="outline">{result.sequence.steps.length} pasos</Badge>
        </div>
        {result.sequence.description ? (
          <p className="text-muted-foreground text-sm break-words">
            {result.sequence.description}
          </p>
        ) : null}
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
          {result.sequence.steps.map((step) => (
            <li key={step.localId} className="break-words">
              {stepLabel(step)}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (result.kind === "automation" && result.automation) {
    const trigger = getTriggerMeta(result.automation.trigger?.type);
    return (
      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium break-words">{result.automation.name}</p>
          <Badge variant="secondary">Borrador</Badge>
          <Badge variant="outline">{trigger?.label ?? "Sin disparador"}</Badge>
        </div>
        {result.automation.description ? (
          <p className="text-muted-foreground text-sm break-words">
            {result.automation.description}
          </p>
        ) : null}
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
          {result.automation.graph.nodes.map((node) => (
            <li key={node.id} className="break-words">
              {automationStepLabel(node)}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return null;
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex gap-2 rounded-lg border px-3 py-2 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">Revisiones recomendadas</p>
        <ul className="list-disc space-y-1 pl-4">
          {warnings.map((warning, index) => (
            <li key={`${warning}-${index}`} className="break-words">
              {warning}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WorkflowDraftDialog({
  aiStatus,
  kind,
  onSequenceDraft,
  open,
  onOpenChange,
}: {
  aiStatus: AIStatus;
  kind: WorkflowKind;
  onSequenceDraft?: (draft: SequenceBuilderValues) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [instruction, setInstruction] = React.useState("");
  const [result, setResult] = React.useState<DraftResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const isSequence = kind === "sequence";
  const canGenerate =
    aiStatus.configured && instruction.trim().length >= 10 && !loading;

  function reset() {
    setInstruction("");
    setResult(null);
    setError(null);
    setLoading(false);
    setSaving(false);
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function generate() {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    try {
      const draft = await generateWorkflowDraft({
        instruction,
        kind,
      });
      setResult(draft);
      toast.success(
        draft.estimatedCostUsd > 0
          ? `Borrador generado (${draft.model}, ${formatCost(
              draft.estimatedCostUsd,
            )})`
          : `Borrador generado (${draft.model})`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo generar el borrador.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function applyDraft() {
    if (!result) return;
    if (isSequence) {
      if (!result.sequence || !onSequenceDraft) return;
      changeOpen(false);
      onSequenceDraft(result.sequence);
      return;
    }
    if (!result.automation || saving) return;

    setSaving(true);
    try {
      const { id } = await createAutomationDraft(result.automation);
      toast.success("Automatizacion creada en borrador");
      changeOpen(false);
      router.push(`/automations/${id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo crear el borrador.";
      toast.error(message);
      setSaving(false);
    }
  }

  const title = isSequence ? "Crear secuencia con IA" : "Crear automatizacion con IA";
  const description = isSequence
    ? "Describe objetivo, audiencia, tono y numero de pasos. La abriremos como borrador editable."
    : "Describe el disparador, condiciones y acciones. Se guardara como borrador revisable.";

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            aria-label={
              isSequence
                ? "Instrucciones para crear una secuencia con IA"
                : "Instrucciones para crear una automatizacion con IA"
            }
            placeholder={
              isSequence
                ? "Ejemplo: secuencia de 4 pasos para leads de campana 005, tono cercano, con espera de 2 dias..."
                : "Ejemplo: cuando un negocio entre en Go, etiquetar como caliente y crear una tarea de llamada..."
            }
            className="min-h-28 resize-y"
            maxLength={4000}
            disabled={loading || saving}
            autoFocus
          />

          {!aiStatus.configured ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
              {aiStatus.reason ?? "IA no configurada."}
            </div>
          ) : aiStatus.provider && aiStatus.model ? (
            <p className="text-muted-foreground text-xs">
              IA: {aiStatus.provider} - {aiStatus.model}
            </p>
          ) : null}

          {error ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex gap-2 rounded-lg border px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p className="break-words">{error}</p>
            </div>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <WorkflowDraftPreview result={result} />
              <WarningList warnings={result.warnings} />
              {result.rationale ? (
                <div className="text-muted-foreground flex gap-2 rounded-lg border px-3 py-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <p className="break-words">{result.rationale}</p>
                </div>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {result.model} - {formatCost(result.estimatedCostUsd)} - run{" "}
                {result.runId.slice(0, 8)}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            type="button"
            variant={result ? "outline" : "secondary"}
            onClick={() => void generate()}
            disabled={!canGenerate || saving}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {loading ? "Generando..." : result ? "Regenerar" : "Generar"}
          </Button>
          <Button
            type="button"
            onClick={() => void applyDraft()}
            disabled={!result || loading || saving}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save />}
            {isSequence
              ? "Abrir en editor"
              : saving
                ? "Creando..."
                : "Crear borrador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AISequenceDraftButton({
  aiStatus,
  onDraft,
}: {
  aiStatus: AIStatus;
  onDraft: (draft: SequenceBuilderValues) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles />
        Crear con IA
      </Button>
      <WorkflowDraftDialog
        aiStatus={aiStatus}
        kind="sequence"
        onSequenceDraft={onDraft}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function AIAutomationDraftButton({
  aiStatus,
}: {
  aiStatus: AIStatus;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles />
        Crear con IA
      </Button>
      <WorkflowDraftDialog
        aiStatus={aiStatus}
        kind="automation"
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
