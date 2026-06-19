import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Eye,
  Handshake,
  MousePointerClick,
  User,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateTime, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getThreadWithMessages } from "@/server/queries/email-threads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Conversación" };

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

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const thread = await getThreadWithMessages(threadId);
  if (!thread) notFound();

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/inbox" />}>
          <ArrowLeft />
        </Button>
        <span className="text-muted-foreground text-sm">Bandeja</span>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
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
