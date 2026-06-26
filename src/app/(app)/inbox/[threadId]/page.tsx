import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Eye,
  Handshake,
  MousePointerClick,
  Reply,
  User,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildMergeCatalog, buildMergeContext } from "@/lib/email/merge-tags";
import { formatDateTime, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAISettingsStatus } from "@/server/queries/ai";
import { listAllCustomFieldDefs } from "@/server/queries/custom-fields";
import { getThreadWithMessages } from "@/server/queries/email-threads";
import { listEmailTemplates } from "@/server/queries/email-templates";
import { getGmailConnectionStatus } from "@/server/queries/gmail";
import { AISentimentButton } from "@/components/ai/ai-sentiment-button";
import { EmailComposerButton } from "@/components/email/email-composer-button";
import type { EmailComposerRecipient } from "@/components/email/send-email-dialog";
import type { EmailSentiment } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Conversación" };

const sentimentMeta: Record<
  EmailSentiment,
  { label: string; className: string }
> = {
  positive: {
    label: "Positivo",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  neutral: {
    label: "Neutral",
    className: "bg-muted text-muted-foreground",
  },
  negative: { label: "Negativo", className: "bg-destructive/10 text-destructive" },
};

/** Convierte HTML a texto plano legible (seguro: no inyecta HTML). */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function recipientsLabel(
  list: { email: string; name?: string | null }[],
): string {
  return list.map((r) => r.name || r.email).join(", ");
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function fallbackContext(input: {
  email: string;
  name: string;
  organizationName?: string | null;
}): Record<string, string> {
  const [firstName = "", ...rest] = input.name.split(/\s+/).filter(Boolean);
  return {
    apellidos: rest.join(" "),
    campaign: "",
    campana: "",
    cargo: "",
    email: input.email,
    empresa: input.organizationName ?? "",
    "empresa.nombre_comercial": "",
    "empresa.sector": "",
    "empresa.web": "",
    nombre: firstName,
    nombre_completo: input.name,
    telefono: "",
  };
}

function buildReplyRecipient({
  customFieldDefs,
  thread,
}: {
  customFieldDefs: Awaited<ReturnType<typeof listAllCustomFieldDefs>>;
  thread: NonNullable<Awaited<ReturnType<typeof getThreadWithMessages>>>;
}): EmailComposerRecipient[] {
  const latestInbound = [...thread.messages]
    .reverse()
    .find((message) => message.direction === "inbound");
  const latestOutbound = [...thread.messages]
    .reverse()
    .find((message) => message.direction === "outbound");
  const address =
    latestInbound?.replyToRecipients[0] ??
    (latestInbound
      ? { email: latestInbound.fromEmail, name: latestInbound.fromName }
      : null) ??
    latestOutbound?.toRecipients[0] ??
    null;
  if (!address?.email) return [];

  const personName = thread.person
    ? fullName(thread.person.firstName, thread.person.lastName)
    : "";
  const name = address.name || personName || address.email;
  const context = thread.person
    ? buildMergeContext(
        {
          campaign: thread.person.campaign,
          customFields: thread.person.customFields,
          email: thread.person.email ?? address.email,
          firstName: thread.person.firstName,
          lastName: thread.person.lastName,
          phone: thread.person.phone,
          title: thread.person.title,
        },
        thread.organization,
        customFieldDefs.person,
        customFieldDefs.organization,
      )
    : fallbackContext({
        email: address.email,
        name,
        organizationName: thread.organization?.name,
      });

  return [
    {
      context,
      dealId: thread.dealId ?? undefined,
      email: address.email,
      id: `${thread.id}:${address.email}`,
      name,
      orgId: thread.orgId ?? undefined,
      personId: thread.personId ?? undefined,
    },
  ];
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const [thread, customFieldDefs, emailTemplates, gmailStatus, aiStatus] =
    await Promise.all([
      getThreadWithMessages(threadId),
      listAllCustomFieldDefs(),
      listEmailTemplates(),
      getGmailConnectionStatus(),
      getAISettingsStatus(),
    ]);
  if (!thread) notFound();
  const mergeCatalog = buildMergeCatalog(
    customFieldDefs.person,
    customFieldDefs.organization,
    Boolean(thread.organization),
  );
  const replyRecipients = buildReplyRecipient({ customFieldDefs, thread });
  const inboundMessages = thread.messages.filter(
    (message) => message.direction === "inbound",
  );
  const inboundCount = inboundMessages.length;
  const unanalyzedCount = inboundMessages.filter(
    (message) => !message.sentiment,
  ).length;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/inbox" />}>
          <ArrowLeft />
        </Button>
        <span className="text-muted-foreground text-sm">Bandeja</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight break-words">
            {thread.subject || "(sin asunto)"}
          </h2>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span>
              {thread.messageCount}{" "}
              {thread.messageCount === 1 ? "mensaje" : "mensajes"}
            </span>
            {thread.person ? (
              <Link
                href={`/contacts/${thread.person.id}`}
                className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <User className="size-3.5" />
                {fullName(thread.person.firstName, thread.person.lastName)}
              </Link>
            ) : null}
            {thread.organization ? (
              <Link
                href={`/organizations/${thread.organization.id}`}
                className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <Building2 className="size-3.5" />
                {thread.organization.name}
              </Link>
            ) : null}
            {thread.deal ? (
              <Link
                href={`/deals/${thread.deal.id}`}
                className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <Handshake className="size-3.5" />
                {thread.deal.title}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AISentimentButton
            threadId={thread.id}
            aiStatus={{ configured: aiStatus.configured, reason: aiStatus.reason }}
            inboundCount={inboundCount}
            unanalyzedCount={unanalyzedCount}
          />
          <EmailComposerButton
            aiStatus={aiStatus}
            catalog={mergeCatalog}
            defaultSubject={thread.subject ?? ""}
            gmailReady={gmailStatus.ready}
            label="Responder"
            mode="reply"
            recipients={replyRecipients}
            templates={emailTemplates}
            threadId={thread.id}
            variant="default"
          />
        </div>
      </div>

      <ol className="space-y-3">
        {thread.messages.map((message) => {
          const outbound = message.direction === "outbound";
          const body =
            message.bodyText?.trim() ||
            (message.bodyHtml ? htmlToText(message.bodyHtml) : "") ||
            message.snippet ||
            "(sin contenido)";
          const date =
            message.sentAt ?? message.receivedAt ?? message.createdAt;
          return (
            <li
              key={message.id}
              className={cn(
                "rounded-xl border p-4",
                outbound ? "bg-primary/5 border-primary/20" : "bg-card",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={outbound ? "default" : "secondary"}>
                    {outbound ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownLeft className="size-3" />
                    )}
                    {outbound ? "Enviado" : "Recibido"}
                  </Badge>
                  <span className="text-sm font-medium">
                    {message.fromName || message.fromEmail}
                  </span>
                  {!outbound && message.sentiment ? (
                    <Badge
                      variant="secondary"
                      className={sentimentMeta[message.sentiment].className}
                    >
                      {sentimentMeta[message.sentiment].label}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatDateTime(date)}
                </span>
              </div>

              {message.toRecipients.length ? (
                <p className="text-muted-foreground mt-1 truncate text-xs">
                  Para: {recipientsLabel(message.toRecipients)}
                </p>
              ) : null}

              {outbound && message.trackingId ? (
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3.5" />
                    {countLabel(message.openCount, "apertura", "aperturas")}
                  </span>
                  {message.openedAt ? (
                    <span>
                      Primera apertura: {formatDateTime(message.openedAt)}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <MousePointerClick className="size-3.5" />
                    {countLabel(message.clickCount, "clic", "clics")}
                  </span>
                  {message.clickedAt ? (
                    <span>
                      Primer clic: {formatDateTime(message.clickedAt)}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {outbound && message.repliedAt ? (
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Reply className="size-3.5" />
                  Respondido · {formatDateTime(message.repliedAt)}
                </p>
              ) : null}

              <p className="mt-3 text-sm break-words whitespace-pre-wrap">
                {body}
              </p>
            </li>
          );
        })}
      </ol>
    </>
  );
}
