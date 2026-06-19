"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, Mail, Pencil, Send } from "lucide-react";
import { toast } from "sonner";

import {
  renderMergeTags,
  textToHtml,
  unknownMergeTags,
  type MergeTag,
} from "@/lib/email/merge-tags";
import { sendEmail } from "@/server/actions/emails";
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

export type EmailComposerRecipient = {
  id: string;
  email: string;
  name: string;
  personId?: string;
  orgId?: string;
  dealId?: string;
  context: Record<string, string>;
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

export function SendEmailDialog({
  open,
  onOpenChange,
  recipients,
  catalog,
  templates,
  gmailReady,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: EmailComposerRecipient[];
  catalog: MergeTag[];
  templates: EmailTemplateItem[];
  gmailReady: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {open ? (
          <SendEmailBody
            recipients={recipients}
            catalog={catalog}
            templates={templates}
            gmailReady={gmailReady}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SendEmailBody({
  recipients,
  catalog,
  templates,
  gmailReady,
  onDone,
}: {
  recipients: EmailComposerRecipient[];
  catalog: MergeTag[];
  templates: EmailTemplateItem[];
  gmailReady: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [recipientId, setRecipientId] = React.useState(recipients[0]?.id ?? "");
  const [templateId, setTemplateId] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [bodyText, setBodyText] = React.useState("");
  const [preview, setPreview] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const subjectRef = React.useRef<HTMLInputElement>(null);
  const editorRef = React.useRef<RichEmailEditorHandle>(null);
  const lastFocused = React.useRef<"subject" | "body">("body");

  const recipient =
    recipients.find((item) => item.id === recipientId) ?? recipients[0] ?? null;
  const context = recipient?.context ?? {};
  const missingVariables = unknownMergeTags(
    `${subject}\n${bodyHtml}\n${bodyText}`,
    context,
  );
  const resolvedSubject = renderMergeTags(subject, context);
  const resolvedBodyText = renderMergeTags(bodyText, context);
  const resolvedBodyHtml = renderMergeTags(bodyHtml, context, {
    escapeValues: true,
  });
  const hasBody = Boolean(bodyText.trim() || bodyHtml.trim());

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
      await sendEmail({
        to: [{ email: recipient.email, name: recipient.name || undefined }],
        subject: resolvedSubject,
        bodyText: resolvedBodyText,
        bodyHtml: resolvedBodyHtml || textToHtml(resolvedBodyText),
        personId: recipient.personId,
        orgId: recipient.orgId,
        dealId: recipient.dealId,
      });
      toast.success("Email enviado");
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo enviar el email",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Enviar email</DialogTitle>
        <DialogDescription>
          {recipient
            ? `${recipient.name ? `${recipient.name} · ` : ""}${recipient.email}`
            : "Selecciona un destinatario para redactar."}
        </DialogDescription>
      </DialogHeader>

      {!gmailReady ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Conecta Gmail en <span className="font-medium">Bandeja</span> para
          poder enviar. Puedes redactar y previsualizar mientras tanto.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {recipients.length > 1 ? (
          <select
            className={selectClass}
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            aria-label="Destinatario"
          >
            {recipients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name ? `${item.name} · ` : ""}
                {item.email}
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

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancelar
        </DialogClose>
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
      </DialogFooter>
    </>
  );
}
