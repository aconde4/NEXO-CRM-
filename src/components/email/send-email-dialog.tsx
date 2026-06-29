"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Eye,
  Mail,
  Pencil,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  renderMergeTags,
  textToHtml,
  unknownMergeTags,
  type MergeTag,
} from "@/lib/email/merge-tags";
import type { EmailDraftMode, EmailDraftTone } from "@/lib/validations/email";
import { generateEmailDraft, sendEmail } from "@/server/actions/emails";
import type { EmailTemplateItem } from "@/server/queries/email-templates";
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
import { MergeTagMenu } from "@/components/email/merge-tag-menu";
import {
  RichEmailEditor,
  type RichEmailEditorHandle,
  type RichEmailEditorValue,
} from "@/components/email/rich-email-editor";
import { Textarea } from "@/components/ui/textarea";

export type EmailComposerRecipient = {
  id: string;
  email: string;
  name: string;
  personId?: string;
  orgId?: string;
  dealId?: string;
  context: Record<string, string>;
};

export type EmailComposerDealOption = {
  id: string;
  title: string;
  personId: string | null;
  orgId: string | null;
  pipelineName: string | null;
  stageName: string | null;
};

export type EmailComposerAIStatus = {
  configured: boolean;
  model: string | null;
  provider: string | null;
  reason: string | null;
};

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

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

function recipientLabel(recipient: EmailComposerRecipient): string {
  return recipient.name
    ? `${recipient.name} · ${recipient.email}`
    : recipient.email;
}

function dealLabel(deal: EmailComposerDealOption): string {
  const location = [deal.pipelineName, deal.stageName].filter(Boolean).join(" → ");
  return location ? `${deal.title} · ${location}` : deal.title;
}

function isDealForRecipient(
  deal: EmailComposerDealOption,
  recipient: EmailComposerRecipient | null,
): boolean {
  if (!recipient) return false;
  return Boolean(
    (deal.personId && recipient.personId === deal.personId) ||
      (deal.orgId && recipient.orgId === deal.orgId),
  );
}

export function SendEmailDialog({
  open,
  onOpenChange,
  recipients,
  catalog,
  templates,
  gmailReady,
  aiStatus,
  defaultSubject = "",
  mode = "new",
  threadId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: EmailComposerRecipient[];
  catalog: MergeTag[];
  templates: EmailTemplateItem[];
  gmailReady: boolean;
  aiStatus: EmailComposerAIStatus;
  defaultSubject?: string;
  mode?: EmailDraftMode;
  threadId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {open ? (
          <EmailComposerForm
            recipients={recipients}
            catalog={catalog}
            templates={templates}
            gmailReady={gmailReady}
            aiStatus={aiStatus}
            defaultSubject={defaultSubject}
            mode={mode}
            threadId={threadId}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function EmailComposerForm({
  recipients,
  catalog,
  templates,
  gmailReady,
  aiStatus,
  defaultSubject = "",
  mode = "new",
  threadId,
  dealOptions = [],
  initialRecipientId,
  initialDealId,
  onDone,
  redirectToThreadOnSend = false,
  surface = "dialog",
}: {
  recipients: EmailComposerRecipient[];
  catalog: MergeTag[];
  templates: EmailTemplateItem[];
  gmailReady: boolean;
  aiStatus: EmailComposerAIStatus;
  defaultSubject?: string;
  mode?: EmailDraftMode;
  threadId?: string;
  dealOptions?: EmailComposerDealOption[];
  initialRecipientId?: string;
  initialDealId?: string;
  onDone?: () => void;
  redirectToThreadOnSend?: boolean;
  surface?: "dialog" | "page";
}) {
  const router = useRouter();
  const [recipientId, setRecipientId] = React.useState(
    initialRecipientId ?? recipients[0]?.id ?? "",
  );
  const [dealId, setDealId] = React.useState(initialDealId ?? "");
  const [templateId, setTemplateId] = React.useState("");
  const [subject, setSubject] = React.useState(defaultSubject);
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [bodyText, setBodyText] = React.useState("");
  const [aiInstruction, setAiInstruction] = React.useState("");
  const [aiTone, setAiTone] =
    React.useState<EmailDraftTone>("professional");
  const [preview, setPreview] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const subjectRef = React.useRef<HTMLInputElement>(null);
  const editorRef = React.useRef<RichEmailEditorHandle>(null);
  const lastFocused = React.useRef<"subject" | "body">("body");

  const recipient =
    recipients.find((item) => item.id === recipientId) ?? recipients[0] ?? null;
  const availableDeals = dealOptions.filter((deal) =>
    isDealForRecipient(deal, recipient),
  );
  const selectedDeal =
    availableDeals.find((deal) => deal.id === dealId) ?? null;
  const context = recipient?.context ?? {};
  const missingVariables = unknownMergeTags(
    `${subject}\n${bodyHtml}\n${bodyText}`,
    context,
  );
  const subjectLocked = mode === "reply" && Boolean(defaultSubject.trim());
  const resolvedSubject = renderMergeTags(subject, context);
  const resolvedBodyText = renderMergeTags(bodyText, context);
  const resolvedBodyHtml = renderMergeTags(bodyHtml, context, {
    escapeValues: true,
  });
  const hasBody = Boolean(bodyText.trim() || bodyHtml.trim());
  const effectiveDealId = selectedDeal?.id ?? recipient?.dealId;
  const effectiveOrgId = selectedDeal?.orgId ?? recipient?.orgId;

  function handleRecipientChange(id: string) {
    const nextRecipient =
      recipients.find((item) => item.id === id) ?? recipients[0] ?? null;
    setRecipientId(id);
    setDealId((current) =>
      dealOptions.some(
        (deal) => deal.id === current && isDealForRecipient(deal, nextRecipient),
      )
        ? current
        : "",
    );
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBodyText(template.bodyText);
    setBodyHtml(template.bodyHtml || textToHtml(template.bodyText));
    lastFocused.current = "body";
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  function insertTag(tag: string) {
    const token = `{{${tag}}}`;
    if (lastFocused.current === "subject") {
      insertIntoInput(subjectRef.current, subject, token, setSubject);
      return;
    }
    editorRef.current?.insertText(token);
  }

  function handleEditorChange(value: RichEmailEditorValue) {
    setBodyHtml(value.html);
    setBodyText(value.text);
  }

  async function draftWithAI() {
    if (!recipient) {
      toast.error("No hay destinatario con email.");
      return;
    }
    if (!aiStatus.configured) {
      toast.error(aiStatus.reason ?? "La IA no está configurada.");
      return;
    }

    setDrafting(true);
    try {
      const draft = await generateEmailDraft({
        bodyText,
        dealId: effectiveDealId,
        instruction: aiInstruction,
        mode,
        orgId: effectiveOrgId,
        personId: recipient.personId,
        subject,
        threadId,
        to: [{ email: recipient.email, name: recipient.name || undefined }],
        tone: aiTone,
      });
      setTemplateId("");
      setSubject(draft.subject);
      setBodyText(draft.bodyText);
      setBodyHtml(draft.bodyHtml);
      setPreview(false);
      toast.success(
        draft.estimatedCostUsd > 0
          ? `Borrador generado (${draft.model}, ${draft.estimatedCostUsd.toFixed(4)} $)`
          : `Borrador generado (${draft.model})`,
      );
      requestAnimationFrame(() => editorRef.current?.focus());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo generar el borrador",
      );
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    if (!recipient) {
      toast.error("No hay destinatario con email.");
      return;
    }
    if (!subject.trim() || !hasBody) {
      toast.error("Añade asunto y cuerpo.");
      return;
    }
    if (missingVariables.length > 0) {
      toast.error("Revisa las variables desconocidas antes de enviar.");
      return;
    }

    setSending(true);
    try {
      const result = await sendEmail({
        to: [{ email: recipient.email, name: recipient.name || undefined }],
        subject: resolvedSubject,
        bodyText: resolvedBodyText,
        bodyHtml: resolvedBodyHtml || textToHtml(resolvedBodyText),
        personId: recipient.personId,
        orgId: effectiveOrgId,
        dealId: effectiveDealId,
        threadId,
      });
      toast.success("Email enviado");
      onDone?.();
      if (redirectToThreadOnSend) {
        router.push(`/inbox/${result.threadId}`);
        return;
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo enviar el email",
      );
    } finally {
      setSending(false);
    }
  }

  if (recipients.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Mail className="text-muted-foreground mx-auto size-8" />
        <h3 className="mt-3 text-base font-semibold">
          No hay contactos con email
        </h3>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
          Añade un email a un contacto para poder redactar y enviar mensajes 1:1
          desde el CRM.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          render={<Link href="/contacts" />}
        >
          Ir a contactos
        </Button>
      </div>
    );
  }

  const footer = (
    <>
      {surface === "dialog" ? (
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancelar
        </DialogClose>
      ) : (
        <Button type="button" variant="outline" render={<Link href="/inbox" />}>
          Cancelar
        </Button>
      )}
      <Button
        onClick={send}
        disabled={
          sending ||
          !gmailReady ||
          !recipient ||
          !subject.trim() ||
          !hasBody ||
          missingVariables.length > 0
        }
      >
        {sending ? (
          <Mail className="size-4 animate-pulse" />
        ) : (
          <Send className="size-4" />
        )}
        {sending ? "Enviando..." : "Enviar"}
      </Button>
    </>
  );

  return (
    <div className="grid gap-4">
      {surface === "dialog" ? (
        <DialogHeader>
          <DialogTitle>
            {mode === "reply" ? "Responder email" : "Enviar email"}
          </DialogTitle>
          <DialogDescription>
            {recipient
              ? recipientLabel(recipient)
              : "Selecciona un destinatario para redactar."}
          </DialogDescription>
        </DialogHeader>
      ) : null}

      {!gmailReady ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Conecta Gmail en <span className="font-medium">Bandeja</span> para
          poder enviar. Puedes redactar y previsualizar mientras tanto.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {recipients.length > 1 || surface === "page" ? (
          <select
            className={selectClass}
            value={recipient?.id ?? ""}
            onChange={(e) => handleRecipientChange(e.target.value)}
            aria-label="Destinatario"
          >
            {recipients.map((item) => (
              <option key={item.id} value={item.id}>
                {recipientLabel(item)}
              </option>
            ))}
          </select>
        ) : null}

        {dealOptions.length > 0 ? (
          <select
            className={selectClass}
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            aria-label="Negocio vinculado"
          >
            <option value="">Sin negocio vinculado</option>
            {availableDeals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {dealLabel(deal)}
              </option>
            ))}
          </select>
        ) : null}

        {templates.length ? (
          <select
            className={selectClass}
            value={templateId}
            onChange={(e) => {
              if (e.target.value) applyTemplate(e.target.value);
              else setTemplateId("");
            }}
            aria-label="Plantilla"
          >
            <option value="">Usar plantilla...</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        ) : null}

        <MergeTagMenu catalog={catalog} onSelect={insertTag} />

        <Button
          type="button"
          variant={preview ? "default" : "outline"}
          size="sm"
          onClick={() => setPreview((value) => !value)}
          className="ml-auto"
        >
          {preview ? <Pencil className="size-4" /> : <Eye className="size-4" />}
          {preview ? "Editar" : "Vista previa"}
        </Button>
      </div>

      <div className="bg-muted/20 grid gap-2 rounded-lg border p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-start">
          <Textarea
            value={aiInstruction}
            onChange={(event) => setAiInstruction(event.target.value)}
            aria-label="Objetivo para la IA"
            placeholder={
              mode === "reply"
                ? "Objetivo de la respuesta..."
                : "Objetivo del email..."
            }
            className="min-h-16 resize-y"
            maxLength={2000}
          />
          <select
            className={selectClass}
            value={aiTone}
            onChange={(event) => setAiTone(event.target.value as EmailDraftTone)}
            aria-label="Tono"
          >
            <option value="professional">Profesional</option>
            <option value="warm">Cercano</option>
            <option value="brief">Breve</option>
            <option value="direct">Directo</option>
          </select>
          <Button
            type="button"
            variant="secondary"
            onClick={draftWithAI}
            disabled={drafting || !recipient || !aiStatus.configured}
          >
            <Sparkles
              className={drafting ? "size-4 animate-pulse" : "size-4"}
            />
            {drafting
              ? "Redactando..."
              : mode === "reply"
                ? "Responder con IA"
                : subject || hasBody
                  ? "Mejorar con IA"
                  : "Redactar con IA"}
          </Button>
        </div>
        {!aiStatus.configured ? (
          <p className="text-muted-foreground text-xs">
            {aiStatus.reason ?? "IA no configurada."}
          </p>
        ) : aiStatus.provider && aiStatus.model ? (
          <p className="text-muted-foreground text-xs">
            IA: {aiStatus.provider} · {aiStatus.model}
          </p>
        ) : null}
      </div>

      {missingVariables.length > 0 ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="break-words">
            Variables desconocidas:{" "}
            <span className="font-mono">{missingVariables.join(", ")}</span>
          </p>
        </div>
      ) : null}

      {preview ? (
        <div className="space-y-3">
          <div className="rounded-md border px-3 py-2">
            <p className="text-muted-foreground text-xs">Asunto</p>
            <p className="text-sm font-medium break-words">
              {resolvedSubject || "—"}
            </p>
          </div>
          <div className="nexo-email-preview min-h-48 rounded-md border px-3 py-3 text-sm break-words">
            {resolvedBodyHtml ? (
              <div dangerouslySetInnerHTML={{ __html: resolvedBodyHtml }} />
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Asunto</Label>
            <Input
              ref={subjectRef}
              value={subject}
              onFocus={() => (lastFocused.current = "subject")}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Hola {{nombre}}, sobre..."
              readOnly={subjectLocked}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Mensaje</Label>
            <RichEmailEditor
              ref={editorRef}
              value={bodyHtml}
              onFocus={() => (lastFocused.current = "body")}
              onChange={handleEditorChange}
              placeholder={'Hola {{nombre|"amigo"}},'}
            />
          </div>
        </div>
      )}

      {surface === "dialog" ? (
        <DialogFooter>{footer}</DialogFooter>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {footer}
        </div>
      )}
    </div>
  );
}
