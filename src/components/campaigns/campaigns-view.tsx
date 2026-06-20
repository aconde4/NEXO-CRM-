"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Clock,
  Eye,
  Heading1,
  Link2,
  MailCheck,
  MoreHorizontal,
  Pencil,
  Plus,
  Rows3,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  CAMPAIGN_BLOCK_LABELS,
  type CampaignEmailBlock,
  type CampaignEmailBlockType,
  campaignBlocksHaveContent,
  createCampaignBlock,
  createDefaultCampaignBlocks,
} from "@/lib/campaign-blocks";
import type { MergeTag } from "@/lib/email/merge-tags";
import {
  type CampaignDraftValues,
  campaignDraftSchema,
} from "@/lib/validations/campaign";
import {
  cancelScheduledCampaign,
  deleteCampaignDraft,
  previewCampaignEmail,
  saveCampaignDraft,
  scheduleCampaign,
  sendCampaignNow,
  sendCampaignTest,
} from "@/server/actions/campaigns";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MergeTagMenu } from "@/components/email/merge-tag-menu";
import {
  RichEmailEditor,
  type RichEmailEditorHandle,
  type RichEmailEditorValue,
} from "@/components/email/rich-email-editor";

export type CampaignRow = {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused" | "failed";
  segmentId: string | null;
  segmentName: string | null;
  bodyHtml: string;
  bodyText: string;
  blocks: CampaignEmailBlock[];
  scheduledAt: string | null;
  sentAt: string | null;
  stats: {
    audience?: number;
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    bounced?: number;
    complained?: number;
    unsubscribed?: number;
    suppressed?: number;
    failed?: number;
  };
  updatedAt: string;
  createdAt: string;
};

export type CampaignSegmentOption = {
  id: string;
  name: string;
  audience: {
    total: number;
    withEmail: number;
    reachable: number;
  };
};

export type CampaignDefaults = {
  fromName: string;
  fromEmail: string;
  resendConfigured: boolean;
};

type DialogState =
  | { mode: "create"; campaign: null }
  | { mode: "edit"; campaign: CampaignRow };

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

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
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toDateTimeLocalValue(value: Date): string {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function defaultScheduleValue(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return toDateTimeLocalValue(date);
}

function statusLabel(status: CampaignRow["status"]): string {
  const labels: Record<CampaignRow["status"], string> = {
    draft: "Borrador",
    scheduled: "Programada",
    sending: "Enviando",
    sent: "Enviada",
    paused: "Pausada",
    failed: "Con error",
  };
  return labels[status];
}

function statusVariant(
  status: CampaignRow["status"],
): React.ComponentProps<typeof Badge>["variant"] {
  if (status === "failed") return "destructive";
  if (status === "scheduled" || status === "sending") return "default";
  return "secondary";
}

function defaultValues(
  campaign: CampaignRow | null,
  defaults: CampaignDefaults,
): CampaignDraftValues {
  return {
    id: campaign?.id,
    name: campaign?.name ?? "",
    subject: campaign?.subject ?? "",
    preheader: campaign?.preheader ?? "",
    fromName: campaign?.fromName || defaults.fromName,
    fromEmail: campaign?.fromEmail || defaults.fromEmail,
    replyTo: campaign?.replyTo ?? "",
    segmentId: campaign?.segmentId ?? null,
    blocks:
      campaign?.blocks && campaign.blocks.length > 0
        ? campaign.blocks
        : createDefaultCampaignBlocks(),
  };
}

function getNestedError(
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

export function CampaignsView({
  campaigns,
  segments,
  defaults,
  catalog,
  testEmail,
}: {
  campaigns: CampaignRow[];
  segments: CampaignSegmentOption[];
  defaults: CampaignDefaults;
  catalog: MergeTag[];
  testEmail: string;
}) {
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  const [deleting, setDeleting] = React.useState<CampaignRow | null>(null);
  const [scheduling, setScheduling] = React.useState<CampaignRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ mode: "create", campaign: null })}>
          <Plus />
          Nueva campaña
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <Send className="text-muted-foreground size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Aún no tienes campañas</p>
              <p className="text-muted-foreground text-sm">
                Prepara el contenido y envía pruebas antes de lanzar a un
                segmento.
              </p>
            </div>
            <Button
              onClick={() => setDialog({ mode: "create", campaign: null })}
            >
              <Plus />
              Nueva campaña
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              resendConfigured={defaults.resendConfigured}
              onEdit={() => setDialog({ mode: "edit", campaign })}
              onSchedule={() => setScheduling(campaign)}
              onDelete={() => setDeleting(campaign)}
            />
          ))}
        </div>
      )}

      {dialog ? (
        <CampaignEditorDialog
          key={dialog.campaign?.id ?? "new-campaign"}
          state={dialog}
          defaults={defaults}
          segments={segments}
          catalog={catalog}
          testEmail={testEmail}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <DeleteCampaignDialog
        campaign={deleting}
        onClose={() => setDeleting(null)}
      />

      {scheduling ? (
        <ScheduleCampaignDialog
          key={scheduling.id}
          campaign={scheduling}
          onClose={() => setScheduling(null)}
        />
      ) : null}
    </div>
  );
}

function CampaignCard({
  campaign,
  resendConfigured,
  onEdit,
  onSchedule,
  onDelete,
}: {
  campaign: CampaignRow;
  resendConfigured: boolean;
  onEdit: () => void;
  onSchedule: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"send" | "cancel" | null>(null);
  const canLaunch = campaign.status !== "sending" && campaign.status !== "sent";
  const canCancel = campaign.status === "scheduled";

  async function launchNow() {
    if (!resendConfigured) {
      toast.error("Configura RESEND_API_KEY antes de enviar campañas.");
      return;
    }
    setBusy("send");
    try {
      await sendCampaignNow(campaign.id);
      toast.success("Campaña encolada para envío");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo enviar ahora",
      );
    } finally {
      setBusy(null);
    }
  }

  async function cancelSchedule() {
    setBusy("cancel");
    try {
      await cancelScheduledCampaign(campaign.id);
      toast.success("Programación cancelada");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cancelar",
      );
    } finally {
      setBusy(null);
    }
  }

  function requestSchedule() {
    if (!resendConfigured) {
      toast.error("Configura RESEND_API_KEY antes de programar campañas.");
      return;
    }
    onSchedule();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate text-base">{campaign.name}</CardTitle>
        <CardDescription className="truncate">
          {campaign.subject || "Sin asunto"}
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
              <DropdownMenuItem disabled={!canLaunch} onClick={onEdit}>
                <Pencil />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={campaign.status === "sending"}
                variant="destructive"
                onClick={onDelete}
              >
                <Trash2 />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(campaign.status)}>
            {statusLabel(campaign.status)}
          </Badge>
          {campaign.segmentName ? (
            <Badge variant="outline">{campaign.segmentName}</Badge>
          ) : (
            <Badge variant="outline">Sin segmento</Badge>
          )}
        </div>
        {campaign.preheader ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {campaign.preheader}
          </p>
        ) : null}
        <CampaignTiming campaign={campaign} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CampaignMetric label="Audiencia" value={campaign.stats.audience} />
          <CampaignMetric label="Enviados" value={campaign.stats.sent} />
          <CampaignMetric
            label="Suprimidos"
            value={campaign.stats.suppressed}
          />
          <CampaignMetric label="Fallidos" value={campaign.stats.failed} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canLaunch || busy !== null}
            onClick={launchNow}
          >
            <Send />
            {busy === "send" ? "Encolando..." : "Enviar ahora"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canLaunch || busy !== null}
            onClick={requestSchedule}
          >
            <CalendarClock />
            Programar
          </Button>
          {canCancel ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={cancelSchedule}
            >
              <XCircle />
              {busy === "cancel" ? "Cancelando..." : "Cancelar"}
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          Actualizada {formatDate(campaign.updatedAt)}
        </p>
      </CardContent>
    </Card>
  );
}

function CampaignTiming({ campaign }: { campaign: CampaignRow }) {
  if (campaign.status === "scheduled" && campaign.scheduledAt) {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Clock className="size-3.5" />
        Programada para {formatDate(campaign.scheduledAt)}
      </p>
    );
  }
  if (campaign.status === "sent" && campaign.sentAt) {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <MailCheck className="size-3.5" />
        Enviada {formatDate(campaign.sentAt)}
      </p>
    );
  }
  if (campaign.status === "sending") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Send className="size-3.5" />
        Envío en curso por lotes
      </p>
    );
  }
  return null;
}

function CampaignMetric({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="rounded-md border px-2 py-1.5">
      <p className="text-muted-foreground text-[0.7rem] leading-none">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value ?? 0}</p>
    </div>
  );
}

function ScheduleCampaignDialog({
  campaign,
  onClose,
}: {
  campaign: CampaignRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(defaultScheduleValue);
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    const scheduledAt = new Date(value);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast.error("Indica una fecha y hora válidas.");
      return;
    }
    setBusy(true);
    try {
      await scheduleCampaign({
        campaignId: campaign.id,
        scheduledAt: scheduledAt.toISOString(),
      });
      toast.success("Campaña programada");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo programar",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Programar campaña</DialogTitle>
          <DialogDescription>
            {campaign.name} se enviara por lotes al segmento{" "}
            <span className="text-foreground font-medium">
              {campaign.segmentName ?? "sin segmento"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Fecha y hora</Label>
            <Input
              type="datetime-local"
              min={toDateTimeLocalValue(new Date())}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <CampaignMetric label="Audiencia" value={campaign.stats.audience} />
            <CampaignMetric label="Enviados" value={campaign.stats.sent} />
            <CampaignMetric label="Fallidos" value={campaign.stats.failed} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={confirm} disabled={busy}>
            <CalendarClock />
            {busy ? "Programando..." : "Programar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignEditorDialog({
  state,
  defaults,
  segments,
  catalog,
  testEmail,
  onClose,
}: {
  state: DialogState;
  defaults: CampaignDefaults;
  segments: CampaignSegmentOption[];
  catalog: MergeTag[];
  testEmail: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const campaign = state.campaign;
  const isEdit = state.mode === "edit";
  const subjectRef = React.useRef<HTMLInputElement>(null);
  const preheaderRef = React.useRef<HTMLInputElement>(null);
  const editorRefs = React.useRef<Record<string, RichEmailEditorHandle | null>>(
    {},
  );
  const lastFocused = React.useRef<
    | { type: "subject" }
    | { type: "preheader" }
    | { type: "richText"; id: string }
  >({ type: "subject" });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CampaignDraftValues>({
    resolver: zodResolver(campaignDraftSchema),
    defaultValues: defaultValues(campaign, defaults),
  });

  const watched = useWatch({ control });
  const blocks = getValues("blocks");
  const segmentId = watched.segmentId ?? getValues("segmentId");
  const subjectField = register("subject");
  const preheaderField = register("preheader");
  const [previewHtml, setPreviewHtml] = React.useState(
    campaign?.bodyHtml ?? "",
  );
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [testRecipient, setTestRecipient] = React.useState(testEmail);
  const [testing, setTesting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      const values = getValues();
      if (
        !values.subject?.trim() ||
        !campaignBlocksHaveContent(values.blocks)
      ) {
        if (active) {
          setPreviewHtml("");
          setPreviewLoading(false);
        }
        return;
      }

      setPreviewLoading(true);
      previewCampaignEmail(values)
        .then((rendered) => {
          if (active) setPreviewHtml(rendered.html);
        })
        .catch(() => {
          if (active) setPreviewHtml("");
        })
        .finally(() => {
          if (active) setPreviewLoading(false);
        });
    }, 450);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [watched, getValues]);

  function updateBlocks(next: CampaignEmailBlock[]) {
    setValue("blocks", next, { shouldDirty: true, shouldValidate: true });
  }

  function updateBlock(index: number, next: CampaignEmailBlock) {
    updateBlocks(blocks.map((block, i) => (i === index ? next : block)));
  }

  function addBlock(type: CampaignEmailBlockType) {
    updateBlocks([...blocks, createCampaignBlock(type)]);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const current = next[index];
    const other = next[target];
    if (!current || !other) return;
    next[index] = other;
    next[target] = current;
    updateBlocks(next);
  }

  function removeBlock(index: number) {
    const next = blocks.filter((_, i) => i !== index);
    updateBlocks(next.length > 0 ? next : createDefaultCampaignBlocks());
  }

  function insertTag(tag: string) {
    const token = `{{${tag}}}`;
    const focus = lastFocused.current;
    if (focus.type === "subject") {
      const value = getValues("subject");
      insertIntoInput(subjectRef.current, value, token, (next) =>
        setValue("subject", next, { shouldDirty: true, shouldValidate: true }),
      );
      return;
    }
    if (focus.type === "preheader") {
      const value = getValues("preheader") ?? "";
      insertIntoInput(preheaderRef.current, value, token, (next) =>
        setValue("preheader", next, {
          shouldDirty: true,
          shouldValidate: true,
        }),
      );
      return;
    }
    editorRefs.current[focus.id]?.insertText(token);
  }

  async function onSubmit(values: CampaignDraftValues) {
    try {
      await saveCampaignDraft(values);
      toast.success(isEdit ? "Campaña actualizada" : "Campaña creada");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar",
      );
    }
  }

  async function sendTest() {
    const valid = await trigger();
    if (!valid) {
      toast.error("Revisa la campaña antes de enviar la prueba.");
      return;
    }
    if (!testRecipient.trim()) {
      toast.error("Indica el email de prueba.");
      return;
    }

    setTesting(true);
    try {
      await sendCampaignTest({ ...getValues(), testEmail: testRecipient });
      toast.success("Prueba enviada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo enviar la prueba",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar campaña" : "Nueva campaña"}
          </DialogTitle>
          <DialogDescription>
            Crea un borrador con bloques React Email y envía una prueba antes
            del lanzamiento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid gap-4">
              <div className="grid gap-4 rounded-lg border p-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>
                    Nombre<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    {...register("name")}
                    placeholder="Newsletter de junio"
                    autoFocus
                  />
                  {errors.name ? (
                    <p className="text-destructive text-xs">
                      {errors.name.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <Label>Segmento</Label>
                  <select
                    className={selectClass}
                    value={segmentId ?? ""}
                    onChange={(event) =>
                      setValue("segmentId", event.target.value || null, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <option value="">Sin segmento todavía</option>
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name} ({segment.audience.reachable}{" "}
                        alcanzables)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <MergeTagMenu catalog={catalog} onSelect={insertTag} />
                    <span className="text-muted-foreground text-xs">
                      Variables disponibles para asunto y cuerpo.
                    </span>
                  </div>
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>
                    Asunto<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    {...subjectField}
                    ref={(node) => {
                      subjectField.ref(node);
                      subjectRef.current = node;
                    }}
                    onFocus={() => (lastFocused.current = { type: "subject" })}
                    placeholder={'Hola {{nombre|"ahí"}}, novedades para ti'}
                  />
                  {errors.subject ? (
                    <p className="text-destructive text-xs">
                      {errors.subject.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Preheader</Label>
                  <Input
                    {...preheaderField}
                    ref={(node) => {
                      preheaderField.ref(node);
                      preheaderRef.current = node;
                    }}
                    onFocus={() =>
                      (lastFocused.current = { type: "preheader" })
                    }
                    placeholder="Texto corto que se ve junto al asunto"
                  />
                  {errors.preheader ? (
                    <p className="text-destructive text-xs">
                      {errors.preheader.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <Label>Nombre del remitente</Label>
                  <Input {...register("fromName")} placeholder="Nexo CRM" />
                </div>

                <div className="grid gap-1.5">
                  <Label>Email remitente</Label>
                  <Input
                    {...register("fromEmail")}
                    placeholder="newsletter@tudominio.com"
                  />
                  {errors.fromEmail ? (
                    <p className="text-destructive text-xs">
                      {errors.fromEmail.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Reply-To</Label>
                  <Input
                    {...register("replyTo")}
                    placeholder="respuestas@tudominio.com"
                  />
                  {errors.replyTo ? (
                    <p className="text-destructive text-xs">
                      {errors.replyTo.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Bloques</p>
                    <p className="text-muted-foreground text-xs">
                      El HTML final se renderiza con React Email en servidor.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BlockAddButton type="richText" onAdd={addBlock} />
                    <BlockAddButton type="heading" onAdd={addBlock} />
                    <BlockAddButton type="button" onAdd={addBlock} />
                    <BlockAddButton type="divider" onAdd={addBlock} />
                  </div>
                </div>

                {blocks.map((block, index) => (
                  <CampaignBlockEditor
                    key={block.id}
                    block={block}
                    index={index}
                    total={blocks.length}
                    blockErrors={errors.blocks}
                    onFocusRichText={(id) =>
                      (lastFocused.current = { type: "richText", id })
                    }
                    setRichTextRef={(id, handle) => {
                      editorRefs.current[id] = handle;
                    }}
                    onChange={(next) => updateBlock(index, next)}
                    onMove={moveBlock}
                    onRemove={removeBlock}
                  />
                ))}

                {errors.blocks ? (
                  <p className="text-destructive text-xs">
                    {typeof errors.blocks.message === "string"
                      ? errors.blocks.message
                      : "Revisa los bloques de la campaña."}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid content-start gap-3">
              <div className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Eye className="text-muted-foreground size-4" />
                    <p className="text-sm font-medium">Vista previa</p>
                  </div>
                  {previewLoading ? (
                    <span className="text-muted-foreground text-xs">
                      renderizando...
                    </span>
                  ) : null}
                </div>
                <div className="bg-muted/50 overflow-hidden rounded-md border">
                  {previewHtml ? (
                    <iframe
                      title="Vista previa de campaña"
                      srcDoc={previewHtml}
                      className="h-[560px] w-full bg-white"
                    />
                  ) : (
                    <div className="flex h-[260px] items-center justify-center px-6 text-center">
                      <p className="text-muted-foreground text-sm">
                        Completa asunto y contenido para ver el email
                        renderizado.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <MailCheck className="text-muted-foreground size-4" />
                  <p className="text-sm font-medium">Prueba</p>
                </div>
                {!defaults.resendConfigured ? (
                  <p className="text-muted-foreground text-xs">
                    Falta RESEND_API_KEY. Puedes guardar borradores; el envío de
                    prueba funcionará cuando Resend esté configurado.
                  </p>
                ) : null}
                <div className="grid gap-1.5">
                  <Label>Email de prueba</Label>
                  <Input
                    value={testRecipient}
                    onChange={(event) => setTestRecipient(event.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={sendTest}
                  disabled={testing}
                >
                  <Send />
                  {testing ? "Enviando..." : "Enviar prueba"}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : isEdit
                  ? "Guardar cambios"
                  : "Crear borrador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BlockAddButton({
  type,
  onAdd,
}: {
  type: CampaignEmailBlockType;
  onAdd: (type: CampaignEmailBlockType) => void;
}) {
  const Icon =
    type === "richText"
      ? Rows3
      : type === "heading"
        ? Heading1
        : type === "button"
          ? Link2
          : Rows3;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => onAdd(type)}
    >
      <Icon />
      {CAMPAIGN_BLOCK_LABELS[type]}
    </Button>
  );
}

function CampaignBlockEditor({
  block,
  index,
  total,
  blockErrors,
  onFocusRichText,
  setRichTextRef,
  onChange,
  onMove,
  onRemove,
}: {
  block: CampaignEmailBlock;
  index: number;
  total: number;
  blockErrors: unknown;
  onFocusRichText: (id: string) => void;
  setRichTextRef: (id: string, handle: RichEmailEditorHandle | null) => void;
  onChange: (block: CampaignEmailBlock) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="bg-background grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{CAMPAIGN_BLOCK_LABELS[block.type]}</Badge>
          <span className="text-muted-foreground text-xs">#{index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Subir bloque"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bajar bloque"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar bloque"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {block.type === "richText" ? (
        <div className="grid gap-1.5">
          <RichEmailEditor
            ref={(handle) => setRichTextRef(block.id, handle)}
            value={block.html}
            onFocus={() => onFocusRichText(block.id)}
            minHeightClassName="min-h-44"
            placeholder={'Hola {{nombre|"amigo"}},'}
            onChange={(value: RichEmailEditorValue) =>
              onChange({ ...block, html: value.html, text: value.text })
            }
          />
          {getNestedError(blockErrors, index, "html") ? (
            <p className="text-destructive text-xs">
              {getNestedError(blockErrors, index, "html")}
            </p>
          ) : null}
        </div>
      ) : null}

      {block.type === "heading" ? (
        <div className="grid gap-1.5">
          <Label>Título</Label>
          <Input
            value={block.text}
            onChange={(event) =>
              onChange({ ...block, text: event.target.value })
            }
            placeholder="Una novedad importante"
          />
          {getNestedError(blockErrors, index, "text") ? (
            <p className="text-destructive text-xs">
              {getNestedError(blockErrors, index, "text")}
            </p>
          ) : null}
        </div>
      ) : null}

      {block.type === "button" ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr]">
          <div className="grid gap-1.5">
            <Label>Texto</Label>
            <Input
              value={block.label}
              onChange={(event) =>
                onChange({ ...block, label: event.target.value })
              }
              placeholder="Reservar llamada"
            />
            {getNestedError(blockErrors, index, "label") ? (
              <p className="text-destructive text-xs">
                {getNestedError(blockErrors, index, "label")}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label>URL</Label>
            <Input
              value={block.href}
              onChange={(event) =>
                onChange({ ...block, href: event.target.value })
              }
              placeholder="https://..."
            />
            {getNestedError(blockErrors, index, "href") ? (
              <p className="text-destructive text-xs">
                {getNestedError(blockErrors, index, "href")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {block.type === "divider" ? (
        <div className="bg-border h-px" aria-hidden="true" />
      ) : null}
    </div>
  );
}

function DeleteCampaignDialog({
  campaign,
  onClose,
}: {
  campaign: CampaignRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    if (!campaign) return;
    setBusy(true);
    try {
      await deleteCampaignDraft(campaign.id);
      toast.success("Campaña eliminada");
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
    <Dialog
      open={Boolean(campaign)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Eliminar campaña</DialogTitle>
          <DialogDescription>
            Se eliminara{" "}
            <span className="text-foreground font-medium">
              {campaign?.name}
            </span>
            . Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
