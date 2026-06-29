"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckSquare,
  Clock3,
  Copy,
  GitBranch,
  Mail,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Save,
  Send,
  Trash2,
  UserPlus,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import type { MergeTag } from "@/lib/email/merge-tags";
import {
  CRM_ACTION_KINDS,
  CRM_ACTION_LABELS,
  defaultCrmAction,
} from "@/lib/sequences";
import {
  type CrmActionConfig,
  type CrmActionKind,
  type SequenceBuilderStepValues,
  type SequenceBuilderValues,
  type SequenceVariantValues,
  sequenceBuilderSchema,
} from "@/lib/validations/sequence";
import {
  deleteSequence,
  duplicateSequence,
  saveSequence,
  sendSequenceStepTest,
  setSequenceStatus,
} from "@/server/actions/sequences";
import type { EmailTemplateItem } from "@/server/queries/email-templates";
import type {
  SequenceCrmActionOptions,
  SequenceEnrollmentPersonOption,
  SequenceEnrollmentSequenceOption,
  SequenceListItem,
  SequenceStepListItem,
} from "@/server/queries/sequences";
import type { SegmentListItem } from "@/server/queries/segments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MergeTagMenu } from "@/components/email/merge-tag-menu";
import {
  RichEmailEditor,
  type RichEmailEditorHandle,
  type RichEmailEditorValue,
} from "@/components/email/rich-email-editor";
import {
  SequenceEnrollmentButton,
  SequenceEnrollmentDialog,
} from "@/components/sequences/sequence-enrollment-dialog";
import { AISequenceDraftButton } from "@/components/ai/ai-workflow-draft-dialog";

type DialogState =
  | { initial?: SequenceBuilderValues; mode: "create"; sequence: null }
  | { mode: "edit"; sequence: SequenceListItem };
type AIStatus = {
  configured: boolean;
  model: string | null;
  provider: string | null;
  reason: string | null;
};

type StepType = SequenceBuilderStepValues["type"];
type ConditionKind = Extract<
  SequenceBuilderStepValues,
  { type: "condition" }
>["condition"]["kind"];
type StepFocus =
  | { localId: string; target: "subject" }
  | { localId: string; target: "body" };

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

const CHANNEL_LABELS: Record<SequenceBuilderValues["channel"], string> = {
  gmail_1to1: "Gmail 1:1",
  resend: "Resend",
};

const STATUS_LABELS: Record<SequenceBuilderValues["status"], string> = {
  active: "Activa",
  archived: "Archivada",
  draft: "Borrador",
  paused: "Pausada",
};

const CONDITION_LABELS: Record<ConditionKind, string> = {
  clicked: "Hizo clic",
  not_replied: "No respondió",
  opened: "Abrió",
  replied: "Respondió",
};
const CONDITION_KINDS = new Set<ConditionKind>(
  Object.keys(CONDITION_LABELS) as ConditionKind[],
);

function createLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `step-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function insertIntoInput(
  input: HTMLInputElement | null,
  value: string,
  token: string,
  setValue: (value: string) => void,
) {
  const start = input?.selectionStart ?? value.length;
  const end = input?.selectionEnd ?? start;
  const next = value.slice(0, start) + token + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    input?.focus();
    const pos = start + token.length;
    input?.setSelectionRange(pos, pos);
  });
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusVariant(
  status: SequenceBuilderValues["status"],
): React.ComponentProps<typeof Badge>["variant"] {
  if (status === "active") return "default";
  if (status === "archived") return "outline";
  return "secondary";
}

function StepTypeIcon({
  type,
  className,
}: {
  type: StepType;
  className?: string;
}) {
  if (type === "email") return <Mail className={className} />;
  if (type === "wait") return <Clock3 className={className} />;
  if (type === "condition") return <GitBranch className={className} />;
  if (type === "crm_action") return <Zap className={className} />;
  return <CheckSquare className={className} />;
}

function createStep(
  type: StepType,
  channel: SequenceBuilderValues["channel"],
): SequenceBuilderStepValues {
  const localId = createLocalId();
  if (type === "email") {
    return {
      bodyHtml: "",
      bodyText: "",
      channel,
      localId,
      name: "Email",
      preheader: "",
      subject: "",
      templateId: null,
      type: "email",
      variants: [],
    };
  }
  if (type === "wait") {
    return {
      localId,
      name: "Espera",
      type: "wait",
      waitDays: 3,
      waitHours: 0,
    };
  }
  if (type === "condition") {
    return {
      condition: { kind: "not_replied", value: "" },
      localId,
      name: "Condición",
      type: "condition",
    };
  }
  if (type === "crm_action") {
    return {
      action: defaultCrmAction(),
      localId,
      name: "Acción CRM",
      type: "crm_action",
    };
  }
  return {
    localId,
    name: "Tarea",
    taskNotes: "",
    taskSubject: "Revisar contacto",
    type: "task",
    waitDays: 0,
    waitHours: 0,
  };
}

function stepFromRow(step: SequenceStepListItem): SequenceBuilderStepValues {
  if (step.type === "email") {
    return {
      bodyHtml: step.bodyHtml,
      bodyText: step.bodyText,
      channel: step.channel ?? "gmail_1to1",
      id: step.id,
      localId: step.localId,
      name: step.name || "Email",
      preheader: step.preheader,
      subject: step.subject,
      templateId: step.templateId,
      type: "email",
      variants: (step.variants ?? []).map((variant) => ({
        bodyHtml: variant.bodyHtml ?? "",
        bodyText: variant.bodyText ?? "",
        id: variant.id,
        name: variant.name ?? "",
        subject: variant.subject ?? "",
        weight: variant.weight ?? 1,
      })),
    };
  }
  if (step.type === "wait") {
    return {
      id: step.id,
      localId: step.localId,
      name: step.name || "Espera",
      type: "wait",
      waitDays: step.waitDays,
      waitHours: step.waitHours,
    };
  }
  if (step.type === "condition") {
    const kind =
      typeof step.condition.kind === "string" &&
      CONDITION_KINDS.has(step.condition.kind as ConditionKind)
        ? (step.condition.kind as ConditionKind)
        : "not_replied";
    return {
      condition: {
        kind,
        value:
          typeof step.condition.value === "string" ? step.condition.value : "",
      },
      id: step.id,
      localId: step.localId,
      name: step.name || "Condición",
      type: "condition",
    };
  }
  if (step.type === "crm_action") {
    return {
      action: step.action ?? defaultCrmAction(),
      id: step.id,
      localId: step.localId,
      name: step.name || "Acción CRM",
      type: "crm_action",
    };
  }
  return {
    id: step.id,
    localId: step.localId,
    name: step.name || "Tarea",
    taskNotes: step.taskNotes,
    taskSubject: step.taskSubject || step.name || "Revisar contacto",
    type: "task",
    waitDays: step.waitDays,
    waitHours: step.waitHours,
  };
}

function defaultValues(
  sequence: SequenceListItem | null,
  initial?: SequenceBuilderValues,
): SequenceBuilderValues {
  if (sequence) {
    return {
      channel: sequence.channel,
      dailyLimit: sequence.dailyLimit,
      description: sequence.description,
      id: sequence.id,
      name: sequence.name,
      status: sequence.status,
      steps: sequence.steps.map(stepFromRow),
      stopOnReply: sequence.stopOnReply,
      timeZone: sequence.timeZone,
      windowEnd: sequence.windowEnd,
      windowStart: sequence.windowStart,
    };
  }
  if (initial) return initial;
  return {
    channel: "gmail_1to1",
    dailyLimit: 50,
    description: "",
    name: "",
    status: "draft",
    steps: [createStep("email", "gmail_1to1")],
    stopOnReply: true,
    timeZone: "Europe/Madrid",
    windowEnd: "18:00",
    windowStart: "09:00",
  };
}

function stepTitle(step: SequenceBuilderStepValues, index: number): string {
  if (step.type === "email") {
    return step.subject.trim() || step.name.trim() || `Email ${index + 1}`;
  }
  if (step.type === "wait") {
    return (
      `${step.waitDays ? `${step.waitDays} d` : ""}${
        step.waitHours ? ` ${step.waitHours} h` : ""
      }`.trim() || "Espera"
    );
  }
  if (step.type === "condition") {
    return CONDITION_LABELS[step.condition.kind];
  }
  if (step.type === "crm_action") {
    return CRM_ACTION_LABELS[step.action.kind];
  }
  return step.taskSubject.trim() || "Tarea";
}

function stepCaption(step: SequenceBuilderStepValues): string {
  if (step.type === "email") return CHANNEL_LABELS[step.channel];
  if (step.type === "wait") return "Pausa antes del siguiente paso";
  if (step.type === "condition") return "Rama lógica para el workflow";
  if (step.type === "crm_action") return "Acción interna del CRM";
  return "Actividad comercial";
}

function getStepError(
  errors: unknown,
  index: number,
  field: string,
): string | null {
  if (!Array.isArray(errors)) return null;
  const item = errors[index];
  if (!item || typeof item !== "object") return null;
  const value = (item as Record<string, unknown>)[field];
  if (!value || typeof value !== "object") return null;
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function getVariantError(
  errors: unknown,
  index: number,
  variantIndex: number,
  field: string,
): string | null {
  if (!Array.isArray(errors)) return null;
  const step = errors[index];
  if (!step || typeof step !== "object") return null;
  const variants = (step as Record<string, unknown>).variants;
  if (!Array.isArray(variants)) return null;
  const variant = variants[variantIndex];
  if (!variant || typeof variant !== "object") return null;
  const value = (variant as Record<string, unknown>)[field];
  if (!value || typeof value !== "object") return null;
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

/** Letra de variante: A = base, B/C/D = alternativas (índice 0 → B). */
function variantLetter(alternativeIndex: number): string {
  return String.fromCharCode(66 + alternativeIndex);
}

function createVariant(): SequenceVariantValues {
  return {
    bodyHtml: "",
    bodyText: "",
    id: createLocalId(),
    name: "",
    subject: "",
    weight: 1,
  };
}

export function SequencesView({
  aiStatus,
  sequences,
  templates,
  catalog,
  personOptions,
  segmentOptions,
  crmOptions,
}: {
  aiStatus: AIStatus;
  sequences: SequenceListItem[];
  templates: EmailTemplateItem[];
  catalog: MergeTag[];
  personOptions: SequenceEnrollmentPersonOption[];
  segmentOptions: Pick<SegmentListItem, "id" | "name">[];
  crmOptions: SequenceCrmActionOptions;
}) {
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  const [deleting, setDeleting] = React.useState<SequenceListItem | null>(null);
  const [enrollingSequenceId, setEnrollingSequenceId] = React.useState<
    string | null
  >(null);
  const enrollmentSequenceOptions = React.useMemo<
    SequenceEnrollmentSequenceOption[]
  >(
    () =>
      sequences.map((sequence) => ({
        canEnroll: sequence.status === "active" && sequence.steps.length > 0,
        id: sequence.id,
        name: sequence.name,
        status: sequence.status,
        stepCount: sequence.steps.length,
      })),
    [sequences],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <SequenceEnrollmentButton
          sequenceOptions={enrollmentSequenceOptions}
          personOptions={personOptions}
          segmentOptions={segmentOptions}
        />
        <AISequenceDraftButton
          aiStatus={aiStatus}
          onDraft={(initial) =>
            setDialog({ initial, mode: "create", sequence: null })
          }
        />
        <Button onClick={() => setDialog({ mode: "create", sequence: null })}>
          <Plus />
          Nueva secuencia
        </Button>
      </div>

      {sequences.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <Repeat className="text-muted-foreground size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Aún no tienes secuencias</p>
              <p className="text-muted-foreground text-sm">
                Prepara pasos de email, espera, condición y tarea.
              </p>
            </div>
            <Button
              onClick={() => setDialog({ mode: "create", sequence: null })}
            >
              <Plus />
              Nueva secuencia
            </Button>
            <AISequenceDraftButton
              aiStatus={aiStatus}
              onDraft={(initial) =>
                setDialog({ initial, mode: "create", sequence: null })
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {sequences.map((sequence) => (
            <SequenceCard
              key={sequence.id}
              sequence={sequence}
              onEnroll={() => setEnrollingSequenceId(sequence.id)}
              onEdit={() => setDialog({ mode: "edit", sequence })}
              onDelete={() => setDeleting(sequence)}
            />
          ))}
        </div>
      )}

      {dialog ? (
        <SequenceEditorDialog
          key={dialog.sequence?.id ?? "new-sequence"}
          state={dialog}
          templates={templates}
          catalog={catalog}
          crmOptions={crmOptions}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <DeleteSequenceDialog
        sequence={deleting}
        onClose={() => setDeleting(null)}
      />

      {enrollingSequenceId ? (
        <SequenceEnrollmentDialog
          key={enrollingSequenceId}
          open
          onOpenChange={(open) => {
            if (!open) setEnrollingSequenceId(null);
          }}
          defaultSequenceId={enrollingSequenceId}
          sequenceOptions={enrollmentSequenceOptions}
          personOptions={personOptions}
          segmentOptions={segmentOptions}
        />
      ) : null}
    </div>
  );
}

function SequenceCard({
  sequence,
  onEnroll,
  onEdit,
  onDelete,
}: {
  sequence: SequenceListItem;
  onEnroll: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const active = sequence.enrollmentSummary.active;
  const total = sequence.enrollmentSummary.total;
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const isActive = sequence.status === "active";

  async function duplicate() {
    setBusy(true);
    try {
      await duplicateSequence(sequence.id);
      toast.success("Secuencia duplicada como borrador");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo duplicar",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    setBusy(true);
    try {
      await setSequenceStatus(sequence.id, isActive ? "paused" : "active");
      toast.success(isActive ? "Secuencia pausada" : "Secuencia activada");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cambiar el estado",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate text-base">
          <Link href={`/sequences/${sequence.id}`} className="hover:underline">
            {sequence.name}
          </Link>
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {sequence.description || "Sin descripción"}
        </CardDescription>
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
                render={<Link href={`/sequences/${sequence.id}`} />}
              >
                <BarChart3 />
                Ver panel
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={
                  sequence.status !== "active" || sequence.steps.length === 0
                }
                onClick={onEnroll}
              >
                <UserPlus />
                Inscribir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy || (!isActive && sequence.steps.length === 0)}
                onClick={toggleStatus}
              >
                {isActive ? <Pause /> : <Play />}
                {isActive ? "Pausar" : "Activar"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={busy} onClick={duplicate}>
                <Copy />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(sequence.status)}>
            {STATUS_LABELS[sequence.status]}
          </Badge>
          <Badge variant="outline">{CHANNEL_LABELS[sequence.channel]}</Badge>
          {sequence.stopOnReply ? (
            <Badge variant="secondary">Para al responder</Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <SequenceMetric label="Pasos" value={sequence.steps.length} />
          <SequenceMetric label="Activos" value={active} />
          <SequenceMetric label="Total" value={total} />
        </div>

        <div className="grid gap-2">
          {sequence.steps.slice(0, 4).map((step, index) => {
            return (
              <div
                key={step.id}
                className="grid grid-cols-[auto_1fr] gap-2 text-sm"
              >
                <div className="bg-muted flex size-7 items-center justify-center rounded-md">
                  <StepTypeIcon
                    type={step.type}
                    className="text-muted-foreground size-4"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {index + 1}. {stepTitle(stepFromRow(step), index)}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {stepCaption(stepFromRow(step))}
                  </p>
                </div>
              </div>
            );
          })}
          {sequence.steps.length > 4 ? (
            <p className="text-muted-foreground text-xs">
              +{sequence.steps.length - 4} pasos más
            </p>
          ) : null}
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span>
            Límite {sequence.dailyLimit}/día · {sequence.windowStart}-
            {sequence.windowEnd}
          </span>
          <span>Actualizada {formatDate(sequence.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SequenceMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-2 py-1.5">
      <p className="text-muted-foreground text-[0.7rem] leading-none">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function SequenceEditorDialog({
  state,
  templates,
  catalog,
  crmOptions,
  onClose,
}: {
  state: DialogState;
  templates: EmailTemplateItem[];
  catalog: MergeTag[];
  crmOptions: SequenceCrmActionOptions;
  onClose: () => void;
}) {
  const router = useRouter();
  const sequence = state.sequence;
  const isEdit = state.mode === "edit";
  const subjectRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const editorRefs = React.useRef<Record<string, RichEmailEditorHandle | null>>(
    {},
  );
  const [focusedTarget, setFocusedTarget] = React.useState<StepFocus | null>(
    null,
  );

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<SequenceBuilderValues>({
    defaultValues: defaultValues(
      sequence,
      state.mode === "create" ? state.initial : undefined,
    ),
    resolver: zodResolver(
      sequenceBuilderSchema,
    ) as Resolver<SequenceBuilderValues>,
  });

  const steps = useWatch({ control, name: "steps" }) ?? [];
  const channel = useWatch({ control, name: "channel" }) ?? "gmail_1to1";
  const stopOnReply = useWatch({ control, name: "stopOnReply" }) ?? true;

  function setSteps(next: SequenceBuilderStepValues[]) {
    setValue("steps", next, { shouldDirty: true, shouldValidate: false });
  }

  function replaceStep(next: SequenceBuilderStepValues) {
    setSteps(
      steps.map((step) => (step.localId === next.localId ? next : step)),
    );
  }

  function addStep(type: StepType) {
    setSteps([...steps, createStep(type, channel)]);
  }

  function removeStep(localId: string) {
    setSteps(steps.filter((step) => step.localId !== localId));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    setSteps(next);
  }

  function insertTag(tag: string) {
    const focus = focusedTarget;
    if (!focus) return;
    const token = `{{${tag}}}`;
    const step = steps.find((item) => item.localId === focus.localId);
    if (!step || step.type !== "email") return;
    if (focus.target === "subject") {
      insertIntoInput(
        subjectRefs.current[step.localId] ?? null,
        step.subject,
        token,
        (subject) => replaceStep({ ...step, subject }),
      );
      return;
    }
    editorRefs.current[step.localId]?.insertText(token);
  }

  function applyTemplate(localId: string, templateId: string) {
    const step = steps.find((item) => item.localId === localId);
    const template = templates.find((item) => item.id === templateId);
    if (!step || step.type !== "email" || !template) return;
    replaceStep({
      ...step,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      subject: template.subject,
      templateId,
    });
    setFocusedTarget({ localId, target: "body" });
    requestAnimationFrame(() => editorRefs.current[localId]?.focus());
  }

  async function submit(values: SequenceBuilderValues) {
    try {
      await saveSequence(values);
      toast.success(isEdit ? "Secuencia actualizada" : "Secuencia creada");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar",
      );
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar secuencia" : "Nueva secuencia"}
          </DialogTitle>
          <DialogDescription>
            Configura el borrador y sus pasos antes de activar el workflow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <div className="grid content-start gap-4">
              <div className="grid gap-3 rounded-lg border p-3">
                <div className="grid gap-1.5">
                  <Label>
                    Nombre<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    {...register("name")}
                    placeholder="Prospección inbound"
                    autoFocus
                  />
                  {errors.name ? (
                    <p className="text-destructive text-xs">
                      {errors.name.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <Label>Descripción</Label>
                  <Textarea
                    {...register("description")}
                    rows={3}
                    placeholder="Objetivo, audiencia o contexto interno"
                  />
                  {errors.description ? (
                    <p className="text-destructive text-xs">
                      {errors.description.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Estado</Label>
                    <select className={selectClass} {...register("status")}>
                      <option value="draft">Borrador</option>
                      <option value="active">Activa</option>
                      <option value="paused">Pausada</option>
                      <option value="archived">Archivada</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Canal por defecto</Label>
                    <select className={selectClass} {...register("channel")}>
                      <option value="gmail_1to1">Gmail 1:1</option>
                      <option value="resend">Resend</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Límite diario</Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      {...register("dailyLimit", { valueAsNumber: true })}
                    />
                    {errors.dailyLimit ? (
                      <p className="text-destructive text-xs">
                        {errors.dailyLimit.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Zona horaria</Label>
                    <Input {...register("timeZone")} />
                    {errors.timeZone ? (
                      <p className="text-destructive text-xs">
                        {errors.timeZone.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Desde</Label>
                    <Input type="time" {...register("windowStart")} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Hasta</Label>
                    <Input type="time" {...register("windowEnd")} />
                    {errors.windowEnd ? (
                      <p className="text-destructive text-xs">
                        {errors.windowEnd.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={stopOnReply}
                    onCheckedChange={(checked) =>
                      setValue("stopOnReply", Boolean(checked), {
                        shouldDirty: true,
                      })
                    }
                  />
                  Parar al recibir respuesta
                </label>
              </div>
            </div>

            <div className="grid content-start gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStep("email")}
                  >
                    <Mail />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStep("wait")}
                  >
                    <Clock3 />
                    Espera
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStep("condition")}
                  >
                    <GitBranch />
                    Condición
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStep("task")}
                  >
                    <CheckSquare />
                    Tarea
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStep("crm_action")}
                  >
                    <Zap />
                    Acción CRM
                  </Button>
                </div>
                <MergeTagMenu
                  catalog={catalog}
                  onSelect={insertTag}
                  disabled={!focusedTarget}
                />
              </div>

              {typeof errors.steps?.message === "string" ? (
                <p className="text-destructive text-xs">
                  {errors.steps.message}
                </p>
              ) : null}

              <div className="grid gap-3">
                {steps.map((step, index) => (
                  <SequenceStepEditor
                    key={step.localId}
                    step={step}
                    index={index}
                    total={steps.length}
                    templates={templates}
                    crmOptions={crmOptions}
                    stepErrors={errors.steps}
                    onApplyTemplate={applyTemplate}
                    onChange={replaceStep}
                    onFocus={(focus) => {
                      setFocusedTarget(focus);
                    }}
                    onMove={moveStep}
                    onRemove={removeStep}
                    setEditorRef={(localId, handle) => {
                      editorRefs.current[localId] = handle;
                    }}
                    setSubjectRef={(localId, node) => {
                      subjectRefs.current[localId] = node;
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              <Save />
              {isSubmitting
                ? "Guardando..."
                : isEdit
                  ? "Guardar cambios"
                  : "Crear secuencia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SequenceStepEditor({
  step,
  index,
  total,
  templates,
  crmOptions,
  stepErrors,
  onApplyTemplate,
  onChange,
  onFocus,
  onMove,
  onRemove,
  setEditorRef,
  setSubjectRef,
}: {
  step: SequenceBuilderStepValues;
  index: number;
  total: number;
  templates: EmailTemplateItem[];
  crmOptions: SequenceCrmActionOptions;
  stepErrors: unknown;
  onApplyTemplate: (localId: string, templateId: string) => void;
  onChange: (step: SequenceBuilderStepValues) => void;
  onFocus: (focus: StepFocus) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (localId: string) => void;
  setEditorRef: (localId: string, handle: RichEmailEditorHandle | null) => void;
  setSubjectRef: (localId: string, node: HTMLInputElement | null) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
            <StepTypeIcon
              type={step.type}
              className="text-muted-foreground size-4"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {index + 1}. {stepTitle(step, index)}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {stepCaption(step)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Subir paso"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bajar paso"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar paso"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(step.localId)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {step.type === "email" ? (
        <EmailStepFields
          step={step}
          index={index}
          templates={templates}
          stepErrors={stepErrors}
          onApplyTemplate={onApplyTemplate}
          onChange={onChange}
          onFocus={onFocus}
          setEditorRef={setEditorRef}
          setSubjectRef={setSubjectRef}
        />
      ) : null}

      {step.type === "wait" ? (
        <WaitStepFields
          step={step}
          index={index}
          stepErrors={stepErrors}
          onChange={onChange}
        />
      ) : null}

      {step.type === "condition" ? (
        <ConditionStepFields step={step} onChange={onChange} />
      ) : null}

      {step.type === "task" ? (
        <TaskStepFields
          step={step}
          index={index}
          stepErrors={stepErrors}
          onChange={onChange}
        />
      ) : null}

      {step.type === "crm_action" ? (
        <CrmActionStepFields
          step={step}
          index={index}
          stepErrors={stepErrors}
          options={crmOptions}
          onChange={onChange}
        />
      ) : null}
    </div>
  );
}

function EmailStepFields({
  step,
  index,
  templates,
  stepErrors,
  onApplyTemplate,
  onChange,
  onFocus,
  setEditorRef,
  setSubjectRef,
}: {
  step: Extract<SequenceBuilderStepValues, { type: "email" }>;
  index: number;
  templates: EmailTemplateItem[];
  stepErrors: unknown;
  onApplyTemplate: (localId: string, templateId: string) => void;
  onChange: (step: SequenceBuilderStepValues) => void;
  onFocus: (focus: StepFocus) => void;
  setEditorRef: (localId: string, handle: RichEmailEditorHandle | null) => void;
  setSubjectRef: (localId: string, node: HTMLInputElement | null) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Canal</Label>
          <select
            className={selectClass}
            value={step.channel}
            onChange={(event) =>
              onChange({
                ...step,
                channel: event.target.value as SequenceBuilderValues["channel"],
              })
            }
          >
            <option value="gmail_1to1">Gmail 1:1</option>
            <option value="resend">Resend</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label>Plantilla</Label>
          <select
            className={selectClass}
            value={step.templateId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              if (value) onApplyTemplate(step.localId, value);
              else onChange({ ...step, templateId: null });
            }}
          >
            <option value="">Sin plantilla</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>
          Asunto<span className="text-destructive"> *</span>
        </Label>
        <Input
          ref={(node) => setSubjectRef(step.localId, node)}
          value={step.subject}
          onFocus={() => onFocus({ localId: step.localId, target: "subject" })}
          onChange={(event) =>
            onChange({ ...step, subject: event.target.value })
          }
          placeholder={'Hola {{nombre|"ahí"}}, quería comentarte algo'}
        />
        {getStepError(stepErrors, index, "subject") ? (
          <p className="text-destructive text-xs">
            {getStepError(stepErrors, index, "subject")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label>Preheader</Label>
        <Input
          value={step.preheader}
          onChange={(event) =>
            onChange({ ...step, preheader: event.target.value })
          }
          placeholder="Texto corto de apoyo"
        />
      </div>

      <div className="grid gap-1.5">
        <Label>
          Mensaje<span className="text-destructive"> *</span>
        </Label>
        <RichEmailEditor
          ref={(handle) => setEditorRef(step.localId, handle)}
          value={step.bodyHtml}
          onFocus={() => onFocus({ localId: step.localId, target: "body" })}
          minHeightClassName="min-h-44"
          placeholder={'Hola {{nombre|"amigo"}},'}
          onChange={(value: RichEmailEditorValue) =>
            onChange({ ...step, bodyHtml: value.html, bodyText: value.text })
          }
        />
        {getStepError(stepErrors, index, "bodyText") ? (
          <p className="text-destructive text-xs">
            {getStepError(stepErrors, index, "bodyText")}
          </p>
        ) : null}
      </div>

      <EmailVariantsEditor
        step={step}
        index={index}
        stepErrors={stepErrors}
        onChange={onChange}
      />

      <SequenceStepTest step={step} />
    </div>
  );
}

/** Envío de prueba del paso/variante de email al propio correo (Fase T.5). */
function SequenceStepTest({
  step,
}: {
  step: Extract<SequenceBuilderStepValues, { type: "email" }>;
}) {
  const [variantId, setVariantId] = React.useState("base");
  const [busy, setBusy] = React.useState(false);

  async function send() {
    const variant =
      variantId === "base"
        ? null
        : step.variants.find((item) => item.id === variantId);
    const content = variant
      ? {
          bodyHtml: variant.bodyHtml || step.bodyHtml,
          bodyText: variant.bodyText || step.bodyText,
          subject: variant.subject || step.subject,
        }
      : {
          bodyHtml: step.bodyHtml,
          bodyText: step.bodyText,
          subject: step.subject,
        };
    setBusy(true);
    try {
      const result = await sendSequenceStepTest({
        channel: step.channel,
        ...content,
      });
      toast.success(`Prueba enviada a ${result.to}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo enviar la prueba",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      {step.variants.length > 0 ? (
        <select
          className={`${selectClass} h-8 max-w-[220px] text-xs`}
          value={variantId}
          onChange={(event) => setVariantId(event.target.value)}
        >
          <option value="base">Variante A (base)</option>
          {step.variants.map((variant, i) => (
            <option key={variant.id} value={variant.id}>
              Variante {variantLetter(i)}
            </option>
          ))}
        </select>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={send}
      >
        <Send />
        {busy ? "Enviando…" : "Enviar prueba a mí"}
      </Button>
    </div>
  );
}

function EmailVariantsEditor({
  step,
  index,
  stepErrors,
  onChange,
}: {
  step: Extract<SequenceBuilderStepValues, { type: "email" }>;
  index: number;
  stepErrors: unknown;
  onChange: (step: SequenceBuilderStepValues) => void;
}) {
  const variants = step.variants;

  function update(variantIndex: number, patch: Partial<SequenceVariantValues>) {
    onChange({
      ...step,
      variants: variants.map((variant, i) =>
        i === variantIndex ? { ...variant, ...patch } : variant,
      ),
    });
  }

  function add() {
    if (variants.length >= 3) return;
    onChange({ ...step, variants: [...variants, createVariant()] });
  }

  function remove(variantIndex: number) {
    onChange({
      ...step,
      variants: variants.filter((_, i) => i !== variantIndex),
    });
  }

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Variantes A/B</p>
          <p className="text-muted-foreground text-xs">
            El email de arriba es la <strong>Variante A</strong>. Añade
            alternativas y se repartirán por peso entre los inscritos.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={variants.length >= 3}
        >
          <Plus className="size-4" />
          Añadir variante
        </Button>
      </div>

      {variants.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Sin prueba A/B: se envía siempre la Variante A.
        </p>
      ) : (
        <div className="grid gap-3">
          {variants.map((variant, i) => (
            <div key={variant.id} className="grid gap-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Variante {variantLetter(i)}
                </p>
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground text-xs">Peso</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    className="h-8 w-20"
                    value={variant.weight}
                    onChange={(event) =>
                      update(i, { weight: Number(event.target.value) })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar variante"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>
                  Asunto<span className="text-destructive"> *</span>
                </Label>
                <Input
                  value={variant.subject}
                  onChange={(event) =>
                    update(i, { subject: event.target.value })
                  }
                  placeholder={'Otro asunto para {{nombre|"ahí"}}'}
                />
                {getVariantError(stepErrors, index, i, "subject") ? (
                  <p className="text-destructive text-xs">
                    {getVariantError(stepErrors, index, i, "subject")}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <Label>
                  Mensaje<span className="text-destructive"> *</span>
                </Label>
                <RichEmailEditor
                  value={variant.bodyHtml}
                  minHeightClassName="min-h-32"
                  placeholder={"Cuerpo alternativo de esta variante"}
                  onChange={(value: RichEmailEditorValue) =>
                    update(i, { bodyHtml: value.html, bodyText: value.text })
                  }
                />
                {getVariantError(stepErrors, index, i, "bodyText") ? (
                  <p className="text-destructive text-xs">
                    {getVariantError(stepErrors, index, i, "bodyText")}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WaitStepFields({
  step,
  index,
  stepErrors,
  onChange,
}: {
  step: Extract<SequenceBuilderStepValues, { type: "wait" }>;
  index: number;
  stepErrors: unknown;
  onChange: (step: SequenceBuilderStepValues) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label>Días</Label>
        <Input
          type="number"
          min={0}
          max={365}
          value={step.waitDays}
          onChange={(event) =>
            onChange({ ...step, waitDays: Number(event.target.value) })
          }
        />
        {getStepError(stepErrors, index, "waitDays") ? (
          <p className="text-destructive text-xs">
            {getStepError(stepErrors, index, "waitDays")}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label>Horas</Label>
        <Input
          type="number"
          min={0}
          max={23}
          value={step.waitHours}
          onChange={(event) =>
            onChange({ ...step, waitHours: Number(event.target.value) })
          }
        />
      </div>
    </div>
  );
}

function ConditionStepFields({
  step,
  onChange,
}: {
  step: Extract<SequenceBuilderStepValues, { type: "condition" }>;
  onChange: (step: SequenceBuilderStepValues) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
      <div className="grid gap-1.5">
        <Label>Condición</Label>
        <select
          className={selectClass}
          value={step.condition.kind}
          onChange={(event) =>
            onChange({
              ...step,
              condition: {
                ...step.condition,
                kind: event.target.value as typeof step.condition.kind,
              },
            })
          }
        >
          <option value="not_replied">No respondió</option>
          <option value="replied">Respondió</option>
          <option value="opened">Abrió</option>
          <option value="clicked">Hizo clic</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label>Valor opcional</Label>
        <Input
          value={step.condition.value}
          onChange={(event) =>
            onChange({
              ...step,
              condition: { ...step.condition, value: event.target.value },
            })
          }
          placeholder="URL, etiqueta interna o nota de rama"
        />
      </div>
    </div>
  );
}

function TaskStepFields({
  step,
  index,
  stepErrors,
  onChange,
}: {
  step: Extract<SequenceBuilderStepValues, { type: "task" }>;
  index: number;
  stepErrors: unknown;
  onChange: (step: SequenceBuilderStepValues) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>
          Asunto de la tarea<span className="text-destructive"> *</span>
        </Label>
        <Input
          value={step.taskSubject}
          onChange={(event) =>
            onChange({
              ...step,
              name: event.target.value,
              taskSubject: event.target.value,
            })
          }
          placeholder="Llamar si no responde"
        />
        {getStepError(stepErrors, index, "taskSubject") ? (
          <p className="text-destructive text-xs">
            {getStepError(stepErrors, index, "taskSubject")}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Días antes de crearla</Label>
          <Input
            type="number"
            min={0}
            max={365}
            value={step.waitDays}
            onChange={(event) =>
              onChange({ ...step, waitDays: Number(event.target.value) })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Horas</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={step.waitHours}
            onChange={(event) =>
              onChange({ ...step, waitHours: Number(event.target.value) })
            }
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Notas</Label>
        <Textarea
          value={step.taskNotes}
          rows={3}
          onChange={(event) =>
            onChange({ ...step, taskNotes: event.target.value })
          }
          placeholder="Contexto para la actividad"
        />
      </div>
    </div>
  );
}

function getActionError(
  errors: unknown,
  index: number,
  field: string,
): string | null {
  if (!Array.isArray(errors)) return null;
  const item = errors[index];
  if (!item || typeof item !== "object") return null;
  const action = (item as Record<string, unknown>).action;
  if (!action || typeof action !== "object") return null;
  const value = (action as Record<string, unknown>)[field];
  if (!value || typeof value !== "object") return null;
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

function CrmActionStepFields({
  step,
  index,
  stepErrors,
  options,
  onChange,
}: {
  step: Extract<SequenceBuilderStepValues, { type: "crm_action" }>;
  index: number;
  stepErrors: unknown;
  options: SequenceCrmActionOptions;
  onChange: (step: SequenceBuilderStepValues) => void;
}) {
  const action = step.action;

  function setAction(next: CrmActionConfig) {
    onChange({ ...step, action: next });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Acción</Label>
        <select
          className={selectClass}
          value={action.kind}
          onChange={(event) =>
            setAction(defaultCrmAction(event.target.value as CrmActionKind))
          }
        >
          {CRM_ACTION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {CRM_ACTION_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>

      {action.kind === "move_stage" ? (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Embudo destino</Label>
              <select
                className={selectClass}
                value={action.pipelineId}
                onChange={(event) =>
                  setAction({
                    ...action,
                    pipelineId: event.target.value,
                    stageId: "",
                  })
                }
              >
                <option value="">Elige un embudo…</option>
                {options.pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
              <ActionError
                message={getActionError(stepErrors, index, "pipelineId")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Etapa destino</Label>
              <select
                className={selectClass}
                value={action.stageId}
                disabled={!action.pipelineId}
                onChange={(event) =>
                  setAction({ ...action, stageId: event.target.value })
                }
              >
                <option value="">Elige una etapa…</option>
                {(
                  options.pipelines.find((p) => p.id === action.pipelineId)
                    ?.stages ?? []
                ).map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <ActionError
                message={getActionError(stepErrors, index, "stageId")}
              />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={action.createIfMissing}
              onCheckedChange={(checked) =>
                setAction({ ...action, createIfMissing: Boolean(checked) })
              }
            />
            <span>
              Crear la entrada en el embudo si el contacto aún no tiene un
              negocio ahí.
              <span className="text-muted-foreground block text-xs">
                Si lo desmarcas y no existe, el paso se omite y se registra.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {action.kind === "add_label" || action.kind === "remove_label" ? (
        <div className="grid gap-1.5">
          <Label>Etiqueta</Label>
          <select
            className={selectClass}
            value={action.labelId}
            onChange={(event) =>
              setAction({ ...action, labelId: event.target.value })
            }
          >
            <option value="">Elige una etiqueta…</option>
            {options.labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
          <ActionError message={getActionError(stepErrors, index, "labelId")} />
          {options.labels.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No tienes etiquetas todavía. Créalas desde un contacto.
            </p>
          ) : null}
        </div>
      ) : null}

      {action.kind === "update_field" ? (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Sobre</Label>
              <select
                className={selectClass}
                value={action.scope}
                onChange={(event) =>
                  setAction({
                    ...action,
                    scope: event.target.value as typeof action.scope,
                  })
                }
              >
                <option value="person">Contacto</option>
                <option value="organization">Empresa</option>
                <option value="deal">Negocio</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>
                Campo personalizado<span className="text-destructive"> *</span>
              </Label>
              <Input
                value={action.field}
                onChange={(event) =>
                  setAction({ ...action, field: event.target.value })
                }
                placeholder="p. ej. estado_comercial"
              />
              <ActionError
                message={getActionError(stepErrors, index, "field")}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Valor</Label>
            <Input
              value={action.value}
              onChange={(event) =>
                setAction({ ...action, value: event.target.value })
              }
              placeholder="Valor a guardar"
            />
          </div>
        </div>
      ) : null}

      {action.kind === "create_task" ? (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>
              Asunto de la tarea<span className="text-destructive"> *</span>
            </Label>
            <Input
              value={action.taskSubject}
              onChange={(event) =>
                setAction({ ...action, taskSubject: event.target.value })
              }
              placeholder="Llamar al contacto"
            />
            <ActionError
              message={getActionError(stepErrors, index, "taskSubject")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Notas</Label>
            <Textarea
              value={action.taskNotes}
              rows={3}
              onChange={(event) =>
                setAction({ ...action, taskNotes: event.target.value })
              }
              placeholder="Contexto para la actividad"
            />
          </div>
        </div>
      ) : null}

      {action.kind === "enroll_sequence" || action.kind === "stop_sequence" ? (
        <div className="grid gap-1.5">
          <Label>Secuencia</Label>
          <select
            className={selectClass}
            value={action.sequenceId}
            onChange={(event) =>
              setAction({ ...action, sequenceId: event.target.value })
            }
          >
            <option value="">Elige una secuencia…</option>
            {options.sequences
              .filter((sequence) =>
                action.kind === "enroll_sequence" ? sequence.canEnroll : true,
              )
              .map((sequence) => (
                <option key={sequence.id} value={sequence.id}>
                  {sequence.name}
                </option>
              ))}
          </select>
          <ActionError
            message={getActionError(stepErrors, index, "sequenceId")}
          />
          {action.kind === "enroll_sequence" ? (
            <p className="text-muted-foreground text-xs">
              Solo se listan secuencias activas y con pasos.
            </p>
          ) : null}
        </div>
      ) : null}

      {action.kind === "notify" ? (
        <div className="grid gap-1.5">
          <Label>
            Aviso<span className="text-destructive"> *</span>
          </Label>
          <Input
            value={action.message}
            onChange={(event) =>
              setAction({ ...action, message: event.target.value })
            }
            placeholder="Qué quieres recordar"
          />
          <ActionError message={getActionError(stepErrors, index, "message")} />
        </div>
      ) : null}

      {action.kind === "webhook" ? (
        <div className="grid gap-1.5">
          <Label>
            URL del webhook<span className="text-destructive"> *</span>
          </Label>
          <Input
            value={action.url}
            onChange={(event) =>
              setAction({ ...action, url: event.target.value })
            }
            placeholder="https://…"
          />
          <ActionError message={getActionError(stepErrors, index, "url")} />
        </div>
      ) : null}
    </div>
  );
}

function DeleteSequenceDialog({
  sequence,
  onClose,
}: {
  sequence: SequenceListItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    if (!sequence) return;
    setBusy(true);
    try {
      await deleteSequence(sequence.id);
      toast.success("Secuencia eliminada");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={Boolean(sequence)}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar secuencia</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará{" "}
            <span className="text-foreground font-medium">
              {sequence?.name}
            </span>
            . Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={confirm}
          >
            {busy ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
