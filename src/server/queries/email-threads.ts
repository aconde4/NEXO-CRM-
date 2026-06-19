import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { emailMessages, emailThreads } from "@/server/db/schema";

export type EntityThreadRef = {
  personId?: string;
  orgId?: string;
  dealId?: string;
};

export type ThreadPreview = {
  id: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: Date | null;
  messageCount: number;
  unread: boolean;
};

/** Hilos de email vinculados a un contacto, empresa o negocio. */
export async function listEntityThreads(
  ref: EntityThreadRef,
  limit = 25,
): Promise<ThreadPreview[]> {
  const user = await requireUser();
  const conds = [
    eq(emailThreads.ownerId, user.id),
    isNull(emailThreads.deletedAt),
  ];
  if (ref.personId) conds.push(eq(emailThreads.personId, ref.personId));
  else if (ref.orgId) conds.push(eq(emailThreads.orgId, ref.orgId));
  else if (ref.dealId) conds.push(eq(emailThreads.dealId, ref.dealId));
  else return [];

  return db
    .select({
      id: emailThreads.id,
      subject: emailThreads.subject,
      snippet: emailThreads.snippet,
      lastMessageAt: emailThreads.lastMessageAt,
      messageCount: emailThreads.messageCount,
      unread: emailThreads.unread,
    })
    .from(emailThreads)
    .where(and(...conds))
    .orderBy(
      sql`${emailThreads.lastMessageAt} desc nulls last`,
      desc(emailThreads.updatedAt),
    )
    .limit(limit);
}

/** Hilo con sus mensajes en orden cronológico (vista de conversación). */
export async function getThreadWithMessages(threadId: string) {
  const user = await requireUser();
  return db.query.emailThreads.findFirst({
    where: and(
      eq(emailThreads.id, threadId),
      eq(emailThreads.ownerId, user.id),
      isNull(emailThreads.deletedAt),
    ),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true } },
      organization: { columns: { id: true, name: true } },
      deal: { columns: { id: true, title: true } },
      messages: {
        orderBy: [
          asc(
            sql`coalesce(${emailMessages.sentAt}, ${emailMessages.receivedAt}, ${emailMessages.createdAt})`,
          ),
        ],
      },
    },
  });
}

export type ThreadWithMessages = Awaited<
  ReturnType<typeof getThreadWithMessages>
>;
