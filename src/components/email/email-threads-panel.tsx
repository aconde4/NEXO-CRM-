import { Mail, MailOpen } from "lucide-react";
import Link from "next/link";

import { formatDateTime } from "@/lib/format";
import type { ThreadPreview } from "@/server/queries/email-threads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EmailThreadsPanel({ threads }: { threads: ThreadPreview[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="text-muted-foreground size-4" />
          Conversaciones
          {threads.length ? (
            <span className="text-muted-foreground text-sm font-normal">
              ({threads.length})
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {threads.length === 0 ? (
          <p className="text-muted-foreground px-6 py-6 text-center text-sm">
            Sin correos vinculados. Conecta y sincroniza Gmail desde{" "}
            <Link href="/inbox" className="text-primary hover:underline">
              Bandeja
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/inbox/${thread.id}`}
                  className="hover:bg-muted/30 flex items-start gap-3 px-6 py-2.5 transition-colors"
                >
                  <div className="text-muted-foreground mt-0.5">
                    {thread.unread ? (
                      <Mail className="text-primary size-4" />
                    ) : (
                      <MailOpen className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        "truncate text-sm " +
                        (thread.unread ? "font-semibold" : "font-medium")
                      }
                    >
                      {thread.subject || "(sin asunto)"}
                    </p>
                    {thread.snippet ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {thread.snippet}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground shrink-0 text-right text-xs">
                    <p className="tabular-nums">
                      {formatDateTime(thread.lastMessageAt)}
                    </p>
                    <p>
                      {thread.messageCount}{" "}
                      {thread.messageCount === 1 ? "mensaje" : "mensajes"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
