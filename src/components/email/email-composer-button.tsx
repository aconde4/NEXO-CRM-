"use client";

import * as React from "react";
import { Mail, Send } from "lucide-react";

import type { MergeTag } from "@/lib/email/merge-tags";
import type { EmailTemplateItem } from "@/server/queries/email-templates";
import { Button } from "@/components/ui/button";
import {
  SendEmailDialog,
  type EmailComposerRecipient,
} from "@/components/email/send-email-dialog";

export function EmailComposerButton({
  recipients,
  catalog,
  templates,
  gmailReady,
  label = "Enviar email",
  variant = "outline",
}: {
  recipients: EmailComposerRecipient[];
  catalog: MergeTag[];
  templates: EmailTemplateItem[];
  gmailReady: boolean;
  label?: string;
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
        />
      ) : null}
    </>
  );
}
