"use client";

import * as React from "react";
import { Mail, Send } from "lucide-react";

import type { MergeTag } from "@/lib/email/merge-tags";
import type { EmailTemplateItem } from "@/server/queries/email-templates";
import { Button } from "@/components/ui/button";
import {
  SendEmailDialog,
  type EmailComposerAIStatus,
  type EmailComposerRecipient,
} from "@/components/email/send-email-dialog";
import type { EmailDraftMode } from "@/lib/validations/email";

export function EmailComposerButton({
  recipients,
  catalog,
  templates,
  gmailReady,
  aiStatus,
  defaultSubject,
  label = "Enviar email",
  mode = "new",
  threadId,
  variant = "outline",
}: {
  recipients: EmailComposerRecipient[];
  catalog: MergeTag[];
  templates: EmailTemplateItem[];
  gmailReady: boolean;
  aiStatus: EmailComposerAIStatus;
  defaultSubject?: string;
  label?: string;
  mode?: EmailDraftMode;
  threadId?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const [open, setOpen] = React.useState(false);
  const disabled = recipients.length === 0;

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        {gmailReady ? <Send className="size-4" /> : <Mail className="size-4" />}
        {disabled ? "Sin email" : label}
      </Button>

      {recipients.length > 0 ? (
        <SendEmailDialog
          open={open}
          onOpenChange={setOpen}
          recipients={recipients}
          catalog={catalog}
          templates={templates}
          gmailReady={gmailReady}
          aiStatus={aiStatus}
          defaultSubject={defaultSubject}
          mode={mode}
          threadId={threadId}
        />
      ) : null}
    </>
  );
}
