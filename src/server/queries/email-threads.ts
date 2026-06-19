import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { fullName } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  deals,
  emailMessages,
  emailThreads,
  mailboxes,
  organizations,
  persons,
  type EmailAddress,
  type EmailDirection,
  type EmailThreadStatus,
} from "@/server/db/schema";

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

export type InboxThreadFilter = "all" | "unread" | "linked" | "unlinked";
export type InboxThreadSort = "recent" | "oldest";

export type InboxThreadItem = {
  id: string;
  subject: string | null;
  snippet: string | null;
  status: EmailThreadStatus;
  unread: boolean;
  messageCount: number;
  lastMessageAt: Date | null;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  mailboxEmail: string;
  person: { id: string; name: string; email: string | null } | null;
  organization: { id: string; name: string } | null;
  deal: { id: string; title: string } | null;
  latestMessage: {
    direction: EmailDirection;
    fromEmail: string;
    fromName: string | null;
    toRecipients: EmailAddress[];
    at: Date | null;
  } | null;
};

export type InboxThreadStats = {
  total: number;
  unread: number;
  linked: number;
  unlinked: number;
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

function linkedThreadCondition() {
  return or(
    isNotNull(emailThreads.personId),
    isNotNull(emailThreads.orgId),
    isNotNull(emailThreads.dealId),
  );
}

function unlinkedThreadCondition() {
  return and(
    isNull(emailThreads.personId),
    isNull(emailThreads.orgId),
    isNull(emailThreads.dealId),
  );
}

function inboxFilterCondition(filter: InboxThreadFilter): SQL | undefined {
  if (filter === "unread") return eq(emailThreads.unread, true);
  if (filter === "linked") return linkedThreadCondition();
  if (filter === "unlinked") return unlinkedThreadCondition();
  return undefined;
}

/** Bandeja unificada: todos los hilos Gmail del usuario, con filtros de venta. */
export async function listInboxThreads({
  filter = "all",
  limit = 75,
  query = "",
  sort = "recent",
}: {
  filter?: InboxThreadFilter;
  limit?: number;
  query?: string;
  sort?: InboxThreadSort;
} = {}): Promise<{ stats: InboxThreadStats; threads: InboxThreadItem[] }> {
  const user = await requireUser();
  const baseConds: SQL[] = [
    eq(emailThreads.ownerId, user.id),
    isNull(emailThreads.deletedAt),
  ];
  const conds = [...baseConds];
  const filterCond = inboxFilterCondition(filter);
  if (filterCond) conds.push(filterCond);

  const cleanQuery = query.trim();
  if (cleanQuery) {
    const pattern = `%${cleanQuery}%`;
    const searchCond = or(
      ilike(emailThreads.subject, pattern),
      ilike(emailThreads.snippet, pattern),
      ilike(mailboxes.email, pattern),
      ilike(persons.firstName, pattern),
      ilike(persons.lastName, pattern),
      ilike(persons.email, pattern),
      ilike(organizations.name, pattern),
      ilike(deals.title, pattern),
    );
    if (searchCond) conds.push(searchCond);
  }

  const [statsRow] = await db
    .select({
      linked: sql<number>`count(*) filter (where (${emailThreads.personId} is not null or ${emailThreads.orgId} is not null or ${emailThreads.dealId} is not null))::int`,
      total: sql<number>`count(*)::int`,
      unread: sql<number>`count(*) filter (where ${emailThreads.unread} = true)::int`,
      unlinked: sql<number>`count(*) filter (where (${emailThreads.personId} is null and ${emailThreads.orgId} is null and ${emailThreads.dealId} is null))::int`,
    })
    .from(emailThreads)
    .where(and(...baseConds));

  const rows = await db
    .select({
      dealId: deals.id,
      dealTitle: deals.title,
      id: emailThreads.id,
      lastInboundAt: emailThreads.lastInboundAt,
      lastMessageAt: emailThreads.lastMessageAt,
      lastOutboundAt: emailThreads.lastOutboundAt,
      mailboxEmail: mailboxes.email,
      messageCount: emailThreads.messageCount,
      orgId: organizations.id,
      orgName: organizations.name,
      personEmail: persons.email,
      personFirstName: persons.firstName,
      personId: persons.id,
      personLastName: persons.lastName,
      snippet: emailThreads.snippet,
      status: emailThreads.status,
      subject: emailThreads.subject,
      unread: emailThreads.unread,
    })
    .from(emailThreads)
    .innerJoin(mailboxes, eq(mailboxes.id, emailThreads.mailboxId))
    .leftJoin(persons, eq(persons.id, emailThreads.personId))
    .leftJoin(organizations, eq(organizations.id, emailThreads.orgId))
    .leftJoin(deals, eq(deals.id, emailThreads.dealId))
    .where(and(...conds))
    .orderBy(
      sort === "oldest"
        ? sql`${emailThreads.lastMessageAt} asc nulls last`
        : sql`${emailThreads.lastMessageAt} desc nulls last`,
      sort === "oldest"
        ? asc(emailThreads.updatedAt)
        : desc(emailThreads.updatedAt),
    )
    .limit(Math.max(1, Math.min(limit, 200)));

  const threadIds = rows.map((row) => row.id);
  const latestMessages = threadIds.length
    ? await db
        .select({
          at: sql<Date>`coalesce(${emailMessages.sentAt}, ${emailMessages.receivedAt}, ${emailMessages.createdAt})`,
          direction: emailMessages.direction,
          fromEmail: emailMessages.fromEmail,
          fromName: emailMessages.fromName,
          threadId: emailMessages.threadId,
          toRecipients: emailMessages.toRecipients,
        })
        .from(emailMessages)
        .where(
          and(
            eq(emailMessages.ownerId, user.id),
            inArray(emailMessages.threadId, threadIds),
          ),
        )
        .orderBy(
          desc(
            sql`coalesce(${emailMessages.sentAt}, ${emailMessages.receivedAt}, ${emailMessages.createdAt})`,
          ),
        )
    : [];

  const latestByThread = new Map<string, (typeof latestMessages)[number]>();
  for (const message of latestMessages) {
    if (!latestByThread.has(message.threadId)) {
      latestByThread.set(message.threadId, message);
    }
  }

  return {
    stats: {
      linked: statsRow?.linked ?? 0,
      total: statsRow?.total ?? 0,
      unread: statsRow?.unread ?? 0,
      unlinked: statsRow?.unlinked ?? 0,
    },
    threads: rows.map((row) => {
      const latestMessage = latestByThread.get(row.id) ?? null;
      return {
        deal: row.dealId
          ? { id: row.dealId, title: row.dealTitle ?? "" }
          : null,
        id: row.id,
        lastInboundAt: row.lastInboundAt,
        lastMessageAt: row.lastMessageAt,
        lastOutboundAt: row.lastOutboundAt,
        latestMessage: latestMessage
          ? {
              at: latestMessage.at,
              direction: latestMessage.direction,
              fromEmail: latestMessage.fromEmail,
              fromName: latestMessage.fromName,
              toRecipients: latestMessage.toRecipients,
            }
          : null,
        mailboxEmail: row.mailboxEmail,
        messageCount: row.messageCount,
        organization: row.orgId
          ? { id: row.orgId, name: row.orgName ?? "" }
          : null,
        person: row.personId
          ? {
              email: row.personEmail,
              id: row.personId,
              name: fullName(row.personFirstName ?? "", row.personLastName),
            }
          : null,
        snippet: row.snippet,
        status: row.status,
        subject: row.subject,
        unread: row.unread,
      };
    }),
  };
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
