import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  activityLog,
  emailEvents,
  emailMessages,
  emailThreads,
  mailboxes,
  persons,
  type EmailAddress,
  type EmailAttachmentMeta,
  type EmailThreadStatus,
} from "@/server/db/schema";
import {
  cleanOptional,
  ensureGmailMailbox,
  excerpt,
  getGoogleAccessToken,
  getGoogleAccount,
  GmailServiceError,
  GMAIL_READ_SCOPE,
  markMailboxNeedsReauth,
  normalizeEmail,
} from "@/server/services/gmail-auth";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const DEFAULT_FULL_SYNC_LIMIT = 50;
const HISTORY_PAGE_SIZE = 500;

type GmailFetchContext = {
  accessToken: string;
  account: Awaited<ReturnType<typeof getGoogleAccount>>;
  forcedRefreshUsed: boolean;
  userId: string;
};

type GmailApiErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type GmailProfileResponse = {
  emailAddress?: string;
  historyId?: string;
  messagesTotal?: number;
  threadsTotal?: number;
};

type GmailListMessagesResponse = {
  messages?: GmailListedMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailHistoryListResponse = {
  history?: {
    id?: string;
    messagesAdded?: { message?: GmailListedMessage }[];
  }[];
  historyId?: string;
  nextPageToken?: string;
};

type GmailListedMessage = {
  id?: string;
  threadId?: string;
};

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailMessagePart = {
  body?: {
    attachmentId?: string;
    data?: string;
    size?: number;
  };
  filename?: string;
  headers?: GmailHeader[];
  mimeType?: string;
  partId?: string;
  parts?: GmailMessagePart[];
};

type GmailFullMessage = {
  historyId?: string;
  id?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailMessagePart;
  sizeEstimate?: number;
  snippet?: string;
  threadId?: string;
};

type HeaderRecord = Record<string, string | string[]>;

type ParsedGmailMessage = {
  attachments: EmailAttachmentMeta[];
  bccRecipients: EmailAddress[];
  bodyHtml: string | null;
  bodyText: string | null;
  ccRecipients: EmailAddress[];
  fromEmail: string;
  fromName: string | null;
  headers: HeaderRecord;
  historyId: string | null;
  inReplyTo: string | null;
  labelIds: string[];
  providerMessageId: string;
  providerThreadId: string;
  receivedAt: Date;
  referencesHeader: string | null;
  replyToRecipients: EmailAddress[];
  rfcMessageId: string | null;
  sentAt: Date | null;
  snippet: string | null;
  subject: string | null;
  threadStatus: EmailThreadStatus;
  toRecipients: EmailAddress[];
  unread: boolean;
};

type ContactLink = {
  orgId: string | null;
  personId: string;
};

type PersistResult = {
  inserted: boolean;
  linkedContact: boolean;
  replies: number;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type GmailSyncResult = {
  fetched: number;
  historyId: string | null;
  inserted: number;
  linkedContacts: number;
  mailboxId: string;
  mode: "full" | "partial";
  replies: number;
  skipped: number;
  updated: number;
};

class GmailApiHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function gmailUrl(path: string, params?: Record<string, string | number>) {
  const url = new URL(`${GMAIL_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function createGmailFetchContext(
  userId: string,
  account: Awaited<ReturnType<typeof getGoogleAccount>>,
): Promise<GmailFetchContext> {
  const token = await getGoogleAccessToken(userId, account);
  return {
    accessToken: token.accessToken,
    account,
    forcedRefreshUsed: token.refreshed,
    userId,
  };
}

async function fetchJson<T>(ctx: GmailFetchContext, url: URL): Promise<T> {
  const doFetch = () =>
    fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${ctx.accessToken}`,
      },
    });

  let response = await doFetch();
  if (response.status === 401 && !ctx.forcedRefreshUsed) {
    const token = await getGoogleAccessToken(ctx.userId, ctx.account, true);
    ctx.accessToken = token.accessToken;
    ctx.forcedRefreshUsed = true;
    response = await doFetch();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as GmailApiErrorBody;
    const message =
      body.error?.message ??
      body.error?.status ??
      `Gmail HTTP ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      await markMailboxNeedsReauth(ctx.userId, message);
      throw new GmailServiceError(
        "Gmail rechazó la sincronización por permisos. Reautoriza Gmail desde Bandeja.",
        "needs_reauth",
      );
    }
    throw new GmailApiHttpError(response.status, message);
  }

  return (await response.json()) as T;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeMimeHeader(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g,
    (_match, charset: string, encoding: string, encoded: string) => {
      const normalizedCharset = charset.toLowerCase();
      if (!["utf-8", "utf8", "iso-8859-1"].includes(normalizedCharset)) {
        return encoded;
      }
      if (encoding.toLowerCase() === "b") {
        return Buffer.from(encoded, "base64").toString(
          normalizedCharset === "iso-8859-1" ? "latin1" : "utf8",
        );
      }
      const bytes = encoded
        .replace(/_/g, " ")
        .replace(/=([0-9a-f]{2})/gi, (_hex, code: string) =>
          String.fromCharCode(Number.parseInt(code, 16)),
        );
      return Buffer.from(bytes, "binary").toString(
        normalizedCharset === "iso-8859-1" ? "latin1" : "utf8",
      );
    },
  );
}

function splitAddressHeader(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let angleDepth = 0;
  let escaped = false;
  let quoted = false;

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (!quoted && char === "<") angleDepth += 1;
    if (!quoted && char === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (!quoted && angleDepth === 0 && char === ",") {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseAddressHeader(value: string | null): EmailAddress[] {
  if (!value) return [];
  const addresses: EmailAddress[] = [];
  for (const part of splitAddressHeader(decodeMimeHeader(value))) {
    const angle = part.match(/^(.*)<([^>]+)>$/);
    const email = (angle?.[2] ?? part).match(/[^\s<>@,;]+@[^\s<>@,;]+/)?.[0];
    if (!email) continue;
    const rawName = angle?.[1]
      ?.trim()
      .replace(/^"|"$/g, "")
      .replace(/\\"/g, '"');
    addresses.push({
      email: normalizeEmail(email),
      name: cleanOptional(rawName),
    });
  }
  return addresses;
}

function collectHeaders(headers: GmailHeader[] | undefined): HeaderRecord {
  const record: HeaderRecord = {};
  for (const header of headers ?? []) {
    const name = header.name?.trim().toLowerCase();
    const value = header.value ? decodeMimeHeader(header.value).trim() : null;
    if (!name || !value) continue;
    const previous = record[name];
    if (!previous) {
      record[name] = value;
    } else if (Array.isArray(previous)) {
      previous.push(value);
    } else {
      record[name] = [previous, value];
    }
  }
  return record;
}

function headerValue(headers: HeaderRecord, name: string): string | null {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateFromInternalDate(value: string | undefined): Date | null {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp);
}

function threadStatusFromLabels(labelIds: string[]): EmailThreadStatus {
  if (labelIds.includes("TRASH")) return "trash";
  if (labelIds.includes("SPAM")) return "spam";
  if (!labelIds.includes("INBOX")) return "archived";
  return "active";
}

function collectMessageParts(payload: GmailMessagePart | undefined) {
  const result: {
    attachments: EmailAttachmentMeta[];
    bodyHtml: string | null;
    bodyText: string | null;
  } = { attachments: [], bodyHtml: null, bodyText: null };

  function visit(part: GmailMessagePart | undefined) {
    if (!part) return;
    const mimeType = part.mimeType?.toLowerCase() ?? null;
    const filename = part.filename?.trim();
    const body = part.body;
    if (filename) {
      result.attachments.push({
        attachmentId: body?.attachmentId,
        filename,
        mimeType,
        size: body?.size ?? null,
      });
    } else if (body?.data && mimeType === "text/plain" && !result.bodyText) {
      result.bodyText = decodeBase64Url(body.data);
    } else if (body?.data && mimeType === "text/html" && !result.bodyHtml) {
      result.bodyHtml = decodeBase64Url(body.data);
    }

    for (const child of part.parts ?? []) visit(child);
  }

  visit(payload);
  return result;
}

function parseGmailMessage(
  message: GmailFullMessage,
): ParsedGmailMessage | null {
  if (!message.id || !message.threadId) return null;
  const headers = collectHeaders(message.payload?.headers);
  const from = parseAddressHeader(headerValue(headers, "from"))[0];
  if (!from) return null;

  const headerDate = parseDate(headerValue(headers, "date"));
  const receivedAt = dateFromInternalDate(message.internalDate) ?? headerDate;
  if (!receivedAt) return null;

  const parts = collectMessageParts(message.payload);
  const labelIds = message.labelIds ?? [];
  return {
    attachments: parts.attachments,
    bccRecipients: parseAddressHeader(headerValue(headers, "bcc")),
    bodyHtml: cleanOptional(parts.bodyHtml),
    bodyText: cleanOptional(parts.bodyText),
    ccRecipients: parseAddressHeader(headerValue(headers, "cc")),
    fromEmail: from.email,
    fromName: cleanOptional(from.name),
    headers,
    historyId: cleanOptional(message.historyId),
    inReplyTo: cleanOptional(headerValue(headers, "in-reply-to")),
    labelIds,
    providerMessageId: message.id,
    providerThreadId: message.threadId,
    receivedAt,
    referencesHeader: cleanOptional(headerValue(headers, "references")),
    replyToRecipients: parseAddressHeader(headerValue(headers, "reply-to")),
    rfcMessageId: cleanOptional(headerValue(headers, "message-id")),
    sentAt: headerDate,
    snippet: cleanOptional(message.snippet),
    subject: cleanOptional(headerValue(headers, "subject")),
    threadStatus: threadStatusFromLabels(labelIds),
    toRecipients: parseAddressHeader(headerValue(headers, "to")),
    unread: labelIds.includes("UNREAD"),
  };
}

async function listRecentInboxMessages(
  ctx: GmailFetchContext,
  maxMessages: number,
) {
  const messages: GmailListedMessage[] = [];
  let pageToken: string | undefined;

  while (messages.length < maxMessages) {
    const url = gmailUrl("/messages", {
      includeSpamTrash: "false",
      labelIds: "INBOX",
      maxResults: Math.min(100, maxMessages - messages.length),
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await fetchJson<GmailListMessagesResponse>(ctx, url);
    messages.push(...(page.messages ?? []));
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }

  return messages.filter((message) => message.id);
}

async function listHistoryAddedMessages(
  ctx: GmailFetchContext,
  startHistoryId: string,
) {
  const byId = new Map<string, GmailListedMessage>();
  let historyId: string | null = null;
  let pageToken: string | undefined;

  do {
    const url = gmailUrl("/history", {
      historyTypes: "messageAdded",
      labelId: "INBOX",
      maxResults: HISTORY_PAGE_SIZE,
      pageToken: pageToken ?? "",
      startHistoryId,
    });
    if (!pageToken) url.searchParams.delete("pageToken");
    const page = await fetchJson<GmailHistoryListResponse>(ctx, url);
    historyId = cleanOptional(page.historyId) ?? historyId;
    for (const entry of page.history ?? []) {
      for (const added of entry.messagesAdded ?? []) {
        const message = added.message;
        if (message?.id) byId.set(message.id, message);
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  return { historyId, messages: Array.from(byId.values()) };
}

async function getFullMessage(ctx: GmailFetchContext, messageId: string) {
  const url = gmailUrl(`/messages/${messageId}`, { format: "full" });
  return fetchJson<GmailFullMessage>(ctx, url);
}

async function getGmailProfile(ctx: GmailFetchContext) {
  return fetchJson<GmailProfileResponse>(ctx, gmailUrl("/profile"));
}

async function findContactLink(
  ownerId: string,
  email: string,
): Promise<ContactLink | null> {
  const [person] = await db
    .select({ orgId: persons.orgId, personId: persons.id })
    .from(persons)
    .where(
      and(
        eq(persons.ownerId, ownerId),
        isNull(persons.deletedAt),
        sql`lower(${persons.email}) = ${normalizeEmail(email)}`,
      ),
    )
    .orderBy(desc(persons.updatedAt))
    .limit(1);

  return person ?? null;
}

function normalizeMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, "").trim();
}

/** Ids de mensaje referenciados por un entrante (In-Reply-To + References). */
function collectReferenceIds(
  inReplyTo: string | null,
  references: string | null,
): Set<string> {
  const ids = new Set<string>();
  for (const value of [inReplyTo, references]) {
    if (!value) continue;
    const matches = value.match(/<[^>]+>/g);
    if (matches) {
      for (const match of matches) ids.add(normalizeMessageId(match));
    } else {
      ids.add(normalizeMessageId(value));
    }
  }
  return ids;
}

/**
 * Detección de respuestas (Fase 3.9): si un mensaje entrante responde a uno de
 * nuestros salientes del mismo hilo, marca el saliente como respondido
 * (`replied_at`) y registra un evento `reply`. Base para parar secuencias (Fase 5).
 */
async function markRepliesForInbound(
  tx: Tx,
  params: {
    fromEmail: string;
    inReplyTo: string | null;
    inboundMessageId: string;
    inboundProviderMessageId: string;
    mailboxId: string;
    ownerId: string;
    receivedAt: Date;
    referencesHeader: string | null;
    threadId: string;
  },
): Promise<number> {
  const outbound = await tx
    .select({
      id: emailMessages.id,
      repliedAt: emailMessages.repliedAt,
      rfcMessageId: emailMessages.rfcMessageId,
      sentAt: emailMessages.sentAt,
    })
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.threadId, params.threadId),
        eq(emailMessages.ownerId, params.ownerId),
        eq(emailMessages.direction, "outbound"),
      ),
    );
  if (outbound.length === 0) return 0;

  const refs = collectReferenceIds(params.inReplyTo, params.referencesHeader);
  let matched = outbound.filter(
    (message) =>
      message.rfcMessageId &&
      refs.has(normalizeMessageId(message.rfcMessageId)),
  );

  // Fallback: si los headers no enlazan, el último saliente sin responder
  // enviado antes del entrante (en un hilo Gmail, un entrante es una respuesta).
  if (matched.length === 0) {
    const candidate = outbound
      .filter(
        (message) =>
          !message.repliedAt &&
          (!message.sentAt || message.sentAt <= params.receivedAt),
      )
      .sort(
        (a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0),
      )[0];
    if (candidate) matched = [candidate];
  }

  let count = 0;
  for (const message of matched) {
    if (message.repliedAt) continue;
    await tx
      .update(emailMessages)
      .set({ repliedAt: params.receivedAt })
      .where(eq(emailMessages.id, message.id));

    await tx
      .insert(emailEvents)
      .values({
        mailboxId: params.mailboxId,
        messageId: message.id,
        meta: {
          inboundMessageId: params.inboundMessageId,
          inboundProviderMessageId: params.inboundProviderMessageId,
          threadId: params.threadId,
        },
        occurredAt: params.receivedAt,
        ownerId: params.ownerId,
        provider: "gmail",
        providerEventId: `gmail:reply:${message.id}:${params.inboundProviderMessageId}`,
        recipientEmail: params.fromEmail,
        type: "reply",
      })
      .onConflictDoNothing();
    count += 1;
  }

  if (count > 0) {
    await tx.insert(activityLog).values({
      actorId: params.ownerId,
      entityId: params.inboundMessageId,
      entityType: "email_message",
      payload: { from: params.fromEmail, threadId: params.threadId },
      verb: "email_replied",
    });
  }

  return count;
}

async function persistSyncedMessage({
  mailbox,
  mode,
  ownerId,
  parsed,
}: {
  mailbox: Awaited<ReturnType<typeof ensureGmailMailbox>>;
  mode: GmailSyncResult["mode"];
  ownerId: string;
  parsed: ParsedGmailMessage;
}): Promise<PersistResult> {
  const contactLink =
    parsed.fromEmail === mailbox.emailNormalized
      ? null
      : await findContactLink(ownerId, parsed.fromEmail);

  return db.transaction(async (tx) => {
    let [thread] = await tx
      .select({
        dealId: emailThreads.dealId,
        id: emailThreads.id,
        orgId: emailThreads.orgId,
        personId: emailThreads.personId,
        snippet: emailThreads.snippet,
        subject: emailThreads.subject,
      })
      .from(emailThreads)
      .where(
        and(
          eq(emailThreads.mailboxId, mailbox.id),
          eq(emailThreads.providerThreadId, parsed.providerThreadId),
        ),
      )
      .limit(1);

    if (!thread) {
      const [created] = await tx
        .insert(emailThreads)
        .values({
          lastInboundAt: parsed.receivedAt,
          lastMessageAt: parsed.receivedAt,
          mailboxId: mailbox.id,
          messageCount: 0,
          metadata: {
            firstSyncMode: mode,
            firstSyncedProviderMessageId: parsed.providerMessageId,
          },
          orgId: contactLink?.orgId ?? null,
          ownerId,
          personId: contactLink?.personId ?? null,
          providerLabels: parsed.labelIds,
          providerThreadId: parsed.providerThreadId,
          snippet: parsed.snippet ?? excerpt(parsed.bodyText),
          status: parsed.threadStatus,
          subject: parsed.subject,
          unread: parsed.unread,
        })
        .onConflictDoNothing()
        .returning({
          dealId: emailThreads.dealId,
          id: emailThreads.id,
          orgId: emailThreads.orgId,
          personId: emailThreads.personId,
          snippet: emailThreads.snippet,
          subject: emailThreads.subject,
        });

      if (created) {
        thread = created;
      } else {
        [thread] = await tx
          .select({
            dealId: emailThreads.dealId,
            id: emailThreads.id,
            orgId: emailThreads.orgId,
            personId: emailThreads.personId,
            snippet: emailThreads.snippet,
            subject: emailThreads.subject,
          })
          .from(emailThreads)
          .where(
            and(
              eq(emailThreads.mailboxId, mailbox.id),
              eq(emailThreads.providerThreadId, parsed.providerThreadId),
            ),
          )
          .limit(1);
      }
    }

    if (!thread) throw new Error("No se pudo registrar el hilo sincronizado");

    const existingMessage = await tx
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.mailboxId, mailbox.id),
          eq(emailMessages.providerMessageId, parsed.providerMessageId),
        ),
      )
      .limit(1);

    const [inserted] =
      existingMessage.length === 0
        ? await tx
            .insert(emailMessages)
            .values({
              attachments: parsed.attachments,
              bccRecipients: parsed.bccRecipients,
              bodyHtml: parsed.bodyHtml,
              bodyText: parsed.bodyText,
              ccRecipients: parsed.ccRecipients,
              direction: "inbound",
              fromEmail: parsed.fromEmail,
              fromName: parsed.fromName,
              headers: parsed.headers,
              inReplyTo: parsed.inReplyTo,
              mailboxId: mailbox.id,
              metadata: {
                historyId: parsed.historyId,
                internalSyncMode: mode,
                labelIds: parsed.labelIds,
              },
              ownerId,
              provider: "gmail",
              providerMessageId: parsed.providerMessageId,
              providerThreadId: parsed.providerThreadId,
              receivedAt: parsed.receivedAt,
              referencesHeader: parsed.referencesHeader,
              replyToRecipients: parsed.replyToRecipients,
              rfcMessageId: parsed.rfcMessageId,
              sentAt: parsed.sentAt,
              snippet: parsed.snippet ?? excerpt(parsed.bodyText),
              status: "received",
              subject: parsed.subject,
              threadId: thread.id,
              toRecipients: parsed.toRecipients,
            })
            .onConflictDoNothing()
            .returning({ id: emailMessages.id })
        : [];

    const messageId = inserted?.id ?? existingMessage[0]?.id ?? null;
    const linkedContact = Boolean(contactLink && !thread.personId);
    let repliesCount = 0;
    const receivedAtIso = parsed.receivedAt.toISOString();
    const baseThreadUpdate = {
      lastInboundAt: sql`greatest(coalesce(${emailThreads.lastInboundAt}, ${receivedAtIso}::timestamptz), ${receivedAtIso}::timestamptz)`,
      lastMessageAt: sql`greatest(coalesce(${emailThreads.lastMessageAt}, ${receivedAtIso}::timestamptz), ${receivedAtIso}::timestamptz)`,
      orgId: thread.orgId ?? contactLink?.orgId ?? null,
      personId: thread.personId ?? contactLink?.personId ?? null,
      providerLabels: parsed.labelIds,
      snippet: parsed.snippet ?? thread.snippet ?? excerpt(parsed.bodyText),
      status: parsed.threadStatus,
      subject: thread.subject ?? parsed.subject,
      unread: parsed.unread ? true : sql`${emailThreads.unread}`,
    };

    if (inserted) {
      if (!messageId) {
        throw new Error("No se pudo registrar el mensaje sincronizado");
      }

      await tx
        .update(emailThreads)
        .set({
          ...baseThreadUpdate,
          messageCount: sql`${emailThreads.messageCount} + 1`,
        })
        .where(eq(emailThreads.id, thread.id));

      await tx
        .insert(emailEvents)
        .values({
          mailboxId: mailbox.id,
          messageId,
          meta: {
            historyId: parsed.historyId,
            mode,
            providerMessageId: parsed.providerMessageId,
            providerThreadId: parsed.providerThreadId,
          },
          occurredAt: parsed.receivedAt,
          ownerId,
          provider: "gmail",
          providerEventId: `gmail:sync:${mailbox.id}:${parsed.providerMessageId}`,
          recipientEmail: mailbox.emailNormalized,
          type: "sync",
        })
        .onConflictDoNothing();

      await tx.insert(activityLog).values({
        actorId: ownerId,
        entityId: messageId,
        entityType: "email_message",
        payload: {
          from: parsed.fromEmail,
          subject: parsed.subject,
          threadId: thread.id,
        },
        verb: "email_received",
      });

      repliesCount = await markRepliesForInbound(tx, {
        fromEmail: parsed.fromEmail,
        inReplyTo: parsed.inReplyTo,
        inboundMessageId: messageId,
        inboundProviderMessageId: parsed.providerMessageId,
        mailboxId: mailbox.id,
        ownerId,
        receivedAt: parsed.receivedAt,
        referencesHeader: parsed.referencesHeader,
        threadId: thread.id,
      });
    } else {
      await tx
        .update(emailThreads)
        .set(baseThreadUpdate)
        .where(eq(emailThreads.id, thread.id));

      if (messageId) {
        await tx
          .update(emailMessages)
          .set({
            headers: parsed.headers,
            metadata: {
              historyId: parsed.historyId,
              internalSyncMode: mode,
              labelIds: parsed.labelIds,
            },
            receivedAt: parsed.receivedAt,
            snippet: parsed.snippet ?? excerpt(parsed.bodyText),
          })
          .where(eq(emailMessages.id, messageId));
      }
    }

    return {
      inserted: Boolean(inserted),
      linkedContact,
      replies: repliesCount,
    };
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function runFullSync(
  ctx: GmailFetchContext,
  mailbox: Awaited<ReturnType<typeof ensureGmailMailbox>>,
  ownerId: string,
  maxMessages: number,
): Promise<GmailSyncResult> {
  const profile = await getGmailProfile(ctx);
  const messages = await listRecentInboxMessages(ctx, maxMessages);
  const result: GmailSyncResult = {
    fetched: 0,
    historyId: cleanOptional(profile.historyId),
    inserted: 0,
    linkedContacts: 0,
    mailboxId: mailbox.id,
    mode: "full",
    replies: 0,
    skipped: 0,
    updated: 0,
  };

  for (const message of messages) {
    if (!message.id) continue;
    try {
      const full = await getFullMessage(ctx, message.id);
      result.fetched += 1;
      const parsed = parseGmailMessage(full);
      if (!parsed) {
        result.skipped += 1;
        continue;
      }
      const persisted = await persistSyncedMessage({
        mailbox,
        mode: "full",
        ownerId,
        parsed,
      });
      if (persisted.inserted) result.inserted += 1;
      else result.updated += 1;
      if (persisted.linkedContact) result.linkedContacts += 1;
      result.replies += persisted.replies;
    } catch (error) {
      if (error instanceof GmailApiHttpError && error.status === 404) {
        result.skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return result;
}

async function runPartialSync(
  ctx: GmailFetchContext,
  mailbox: Awaited<ReturnType<typeof ensureGmailMailbox>>,
  ownerId: string,
  startHistoryId: string,
): Promise<GmailSyncResult> {
  const history = await listHistoryAddedMessages(ctx, startHistoryId);
  const result: GmailSyncResult = {
    fetched: 0,
    historyId: history.historyId ?? startHistoryId,
    inserted: 0,
    linkedContacts: 0,
    mailboxId: mailbox.id,
    mode: "partial",
    replies: 0,
    skipped: 0,
    updated: 0,
  };

  for (const message of history.messages) {
    if (!message.id) continue;
    try {
      const full = await getFullMessage(ctx, message.id);
      result.fetched += 1;
      const parsed = parseGmailMessage(full);
      if (!parsed) {
        result.skipped += 1;
        continue;
      }
      const persisted = await persistSyncedMessage({
        mailbox,
        mode: "partial",
        ownerId,
        parsed,
      });
      if (persisted.inserted) result.inserted += 1;
      else result.updated += 1;
      if (persisted.linkedContact) result.linkedContacts += 1;
      result.replies += persisted.replies;
    } catch (error) {
      if (error instanceof GmailApiHttpError && error.status === 404) {
        result.skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return result;
}

async function recordMailboxSyncResult(
  mailboxId: string,
  ownerId: string,
  result: GmailSyncResult,
) {
  const finishedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(mailboxes)
      .set({
        gmailHistoryId: result.historyId,
        lastSyncError: null,
        lastSyncedAt: finishedAt,
        status: "active",
      })
      .where(eq(mailboxes.id, mailboxId));

    await tx
      .insert(emailEvents)
      .values({
        mailboxId,
        meta: {
          fetched: result.fetched,
          inserted: result.inserted,
          linkedContacts: result.linkedContacts,
          mode: result.mode,
          replies: result.replies,
          skipped: result.skipped,
          updated: result.updated,
        },
        occurredAt: finishedAt,
        ownerId,
        provider: "gmail",
        providerEventId: `gmail:mailbox-sync:${mailboxId}:${finishedAt.getTime()}`,
        type: "sync",
      })
      .onConflictDoNothing();
  });
}

export async function syncGmailMailbox(
  userId: string,
  options: { maxMessages?: number } = {},
): Promise<GmailSyncResult> {
  const maxMessages = options.maxMessages ?? DEFAULT_FULL_SYNC_LIMIT;
  const startedAt = new Date();
  const account = await getGoogleAccount(userId, [GMAIL_READ_SCOPE]);
  const mailbox = await ensureGmailMailbox(userId, account);

  await db
    .update(mailboxes)
    .set({ lastSyncError: null, lastSyncStartedAt: startedAt })
    .where(eq(mailboxes.id, mailbox.id));

  const ctx = await createGmailFetchContext(userId, account);

  try {
    let result: GmailSyncResult;
    if (mailbox.gmailHistoryId) {
      try {
        result = await runPartialSync(
          ctx,
          mailbox,
          userId,
          mailbox.gmailHistoryId,
        );
      } catch (error) {
        if (!(error instanceof GmailApiHttpError && error.status === 404)) {
          throw error;
        }
        result = await runFullSync(ctx, mailbox, userId, maxMessages);
      }
    } else {
      result = await runFullSync(ctx, mailbox, userId, maxMessages);
    }

    await recordMailboxSyncResult(mailbox.id, userId, result);
    return result;
  } catch (error) {
    await db
      .update(mailboxes)
      .set({
        lastSyncError: errorMessage(error),
        status:
          error instanceof GmailServiceError &&
          ["missing_scope", "needs_reauth"].includes(error.code)
            ? "needs_reauth"
            : "error",
      })
      .where(eq(mailboxes.id, mailbox.id));
    throw error;
  }
}
