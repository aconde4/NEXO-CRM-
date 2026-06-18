import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { buildGmailRawMessage, type EmailAddressInput } from "@/lib/email/mime";
import { GMAIL_OAUTH_SCOPES, parseOAuthScope } from "@/lib/google-oauth";
import { sendEmailSchema, type SendEmailValues } from "@/lib/validations/email";
import { db } from "@/server/db";
import {
  accounts,
  activityLog,
  deals,
  emailEvents,
  emailMessages,
  emailThreads,
  mailboxes,
  organizations,
  persons,
  users,
} from "@/server/db/schema";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_SEND_SCOPE = GMAIL_OAUTH_SCOPES[0];
const TOKEN_EXPIRY_SKEW_SECONDS = 60;

type GoogleAccount = {
  accessToken: string | null;
  expiresAt: number | null;
  providerAccountId: string;
  refreshToken: string | null;
  scope: string | null;
  tokenType: string | null;
  userEmail: string;
  userName: string | null;
};

type GmailTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GmailMessageResponse = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
};

type LocalThread = {
  id: string;
  mailboxId: string;
  providerThreadId: string;
  subject: string | null;
  personId: string | null;
  orgId: string | null;
  dealId: string | null;
};

type LastThreadMessage = {
  rfcMessageId: string | null;
  referencesHeader: string | null;
};

type PreparedSend = {
  bodyHtml: string | null;
  bodyText: string | null;
  bcc: EmailAddressInput[];
  cc: EmailAddressInput[];
  dealId: string | null;
  inReplyTo: string | null;
  orgId: string | null;
  personId: string | null;
  references: string | null;
  replyTo: EmailAddressInput[];
  subject: string;
  to: EmailAddressInput[];
};

export class GmailServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "missing_credentials"
      | "missing_google_account"
      | "missing_scope"
      | "needs_reauth"
      | "daily_limit"
      | "thread_mismatch"
      | "gmail_api_error",
  ) {
    super(message);
  }
}

function cleanOptional(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAddress(address: EmailAddressInput): EmailAddressInput {
  return {
    email: normalizeEmail(address.email),
    name: cleanOptional(address.name),
  };
}

function normalizeAddresses(addresses: EmailAddressInput[] | undefined) {
  return (addresses ?? []).map(normalizeAddress);
}

function normalizeThreadSubject(subject: string): string {
  return subject
    .trim()
    .replace(/^((re|fw|fwd):\s*)+/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function makeRfcMessageId(fromEmail: string): string {
  const domain = fromEmail
    .split("@")[1]
    ?.toLowerCase()
    .replace(/[^a-z0-9.-]/g, "");
  return `<${crypto.randomUUID()}@${domain || "nexo.local"}>`;
}

function nextUtcMidnight(from = new Date()): Date {
  return new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
}

function effectiveDailyCounter(mailbox: {
  sentToday: number;
  sentTodayResetAt: Date | null;
}) {
  const now = new Date();
  const resetAt =
    mailbox.sentTodayResetAt && mailbox.sentTodayResetAt > now
      ? mailbox.sentTodayResetAt
      : nextUtcMidnight(now);
  const sentToday =
    mailbox.sentTodayResetAt && mailbox.sentTodayResetAt > now
      ? mailbox.sentToday
      : 0;
  return { resetAt, sentToday };
}

function excerpt(text: string | null | undefined): string | null {
  const clean = text?.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 240) : null;
}

function referencesForReply(lastMessage: LastThreadMessage | null): {
  inReplyTo: string | null;
  references: string | null;
} {
  const inReplyTo = lastMessage?.rfcMessageId ?? null;
  const references = [
    cleanOptional(lastMessage?.referencesHeader),
    cleanOptional(lastMessage?.rfcMessageId),
  ]
    .filter(Boolean)
    .join(" ");
  return { inReplyTo, references: references || null };
}

async function getGoogleAccount(userId: string): Promise<GoogleAccount> {
  const [row] = await db
    .select({
      accessToken: accounts.access_token,
      expiresAt: accounts.expires_at,
      providerAccountId: accounts.providerAccountId,
      refreshToken: accounts.refresh_token,
      scope: accounts.scope,
      tokenType: accounts.token_type,
      userEmail: users.email,
      userName: users.name,
    })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")))
    .limit(1);

  if (!row) {
    throw new GmailServiceError(
      "Conecta Gmail antes de enviar correos.",
      "missing_google_account",
    );
  }
  if (!row.refreshToken) {
    throw new GmailServiceError(
      "Falta el refresh token de Google. Reautoriza Gmail desde Bandeja.",
      "needs_reauth",
    );
  }
  if (!parseOAuthScope(row.scope).has(GMAIL_SEND_SCOPE)) {
    throw new GmailServiceError(
      "Falta el permiso gmail.send. Reautoriza Gmail desde Bandeja.",
      "missing_scope",
    );
  }
  return row;
}

async function markMailboxNeedsReauth(ownerId: string, error: string) {
  await db
    .update(mailboxes)
    .set({ lastSyncError: error, status: "needs_reauth" })
    .where(
      and(eq(mailboxes.ownerId, ownerId), eq(mailboxes.provider, "gmail")),
    );
}

async function refreshGoogleAccessToken(
  userId: string,
  account: GoogleAccount,
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new GmailServiceError(
      "Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET.",
      "missing_credentials",
    );
  }
  if (!account.refreshToken) {
    throw new GmailServiceError(
      "Falta el refresh token de Google. Reautoriza Gmail desde Bandeja.",
      "needs_reauth",
    );
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as GmailTokenResponse;

  if (!response.ok || !body.access_token) {
    await markMailboxNeedsReauth(
      userId,
      body.error_description || body.error || `OAuth ${response.status}`,
    );
    throw new GmailServiceError(
      "Google no pudo refrescar el acceso. Reautoriza Gmail desde Bandeja.",
      "needs_reauth",
    );
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600);
  await db
    .update(accounts)
    .set({
      access_token: body.access_token,
      expires_at: expiresAt,
      scope: body.scope ?? account.scope,
      token_type: body.token_type ?? account.tokenType ?? "Bearer",
    })
    .where(
      and(
        eq(accounts.provider, "google"),
        eq(accounts.providerAccountId, account.providerAccountId),
      ),
    );

  return body.access_token;
}

async function getGoogleAccessToken(
  userId: string,
  account: GoogleAccount,
  forceRefresh = false,
): Promise<{ accessToken: string; refreshed: boolean }> {
  const expiresAt = account.expiresAt ?? 0;
  const isFresh = Boolean(
    account.accessToken &&
    expiresAt - Math.floor(Date.now() / 1000) > TOKEN_EXPIRY_SKEW_SECONDS,
  );
  if (isFresh && !forceRefresh) {
    return { accessToken: account.accessToken!, refreshed: false };
  }
  return {
    accessToken: await refreshGoogleAccessToken(userId, account),
    refreshed: true,
  };
}

async function ensureGmailMailbox(userId: string, account: GoogleAccount) {
  const email = account.userEmail.trim();
  const emailNormalized = normalizeEmail(email);
  const [mailbox] = await db
    .insert(mailboxes)
    .values({
      accountProvider: "google",
      accountProviderAccountId: account.providerAccountId,
      displayName: account.userName,
      email,
      emailNormalized,
      fromName: account.userName,
      ownerId: userId,
      provider: "gmail",
      sentTodayResetAt: nextUtcMidnight(),
      status: "active",
    })
    .onConflictDoUpdate({
      target: [
        mailboxes.ownerId,
        mailboxes.provider,
        mailboxes.emailNormalized,
      ],
      set: {
        accountProvider: "google",
        accountProviderAccountId: account.providerAccountId,
        displayName: account.userName,
        lastSyncError: null,
        status: sql`case when ${mailboxes.status} = 'paused' then ${mailboxes.status} else 'active' end`,
      },
    })
    .returning();

  if (!mailbox) {
    throw new GmailServiceError(
      "No se pudo preparar el buzón Gmail.",
      "gmail_api_error",
    );
  }
  if (mailbox.status === "paused") {
    throw new GmailServiceError(
      "El buzón está pausado. Actívalo antes de enviar.",
      "daily_limit",
    );
  }
  return mailbox;
}

async function assertOptionalEntityLinks(
  ownerId: string,
  links: {
    personId: string | null;
    orgId: string | null;
    dealId: string | null;
  },
) {
  const checks: Promise<unknown>[] = [];
  if (links.personId) {
    checks.push(
      db
        .select({ id: persons.id })
        .from(persons)
        .where(
          and(
            eq(persons.id, links.personId),
            eq(persons.ownerId, ownerId),
            isNull(persons.deletedAt),
          ),
        )
        .limit(1)
        .then(([row]) => {
          if (!row) throw new Error("Contacto no encontrado para este usuario");
        }),
    );
  }
  if (links.orgId) {
    checks.push(
      db
        .select({ id: organizations.id })
        .from(organizations)
        .where(
          and(
            eq(organizations.id, links.orgId),
            eq(organizations.ownerId, ownerId),
            isNull(organizations.deletedAt),
          ),
        )
        .limit(1)
        .then(([row]) => {
          if (!row) throw new Error("Empresa no encontrada para este usuario");
        }),
    );
  }
  if (links.dealId) {
    checks.push(
      db
        .select({ id: deals.id })
        .from(deals)
        .where(
          and(
            eq(deals.id, links.dealId),
            eq(deals.ownerId, ownerId),
            isNull(deals.deletedAt),
          ),
        )
        .limit(1)
        .then(([row]) => {
          if (!row) throw new Error("Negocio no encontrado para este usuario");
        }),
    );
  }
  await Promise.all(checks);
}

async function getLocalThread(
  ownerId: string,
  threadId: string | null,
): Promise<LocalThread | null> {
  if (!threadId) return null;
  const [thread] = await db
    .select({
      dealId: emailThreads.dealId,
      id: emailThreads.id,
      mailboxId: emailThreads.mailboxId,
      orgId: emailThreads.orgId,
      personId: emailThreads.personId,
      providerThreadId: emailThreads.providerThreadId,
      subject: emailThreads.subject,
    })
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.id, threadId),
        eq(emailThreads.ownerId, ownerId),
        isNull(emailThreads.deletedAt),
      ),
    )
    .limit(1);
  if (!thread) throw new Error("Hilo de email no encontrado");
  return thread;
}

async function getLastThreadMessage(
  ownerId: string,
  threadId: string,
): Promise<LastThreadMessage | null> {
  const [message] = await db
    .select({
      referencesHeader: emailMessages.referencesHeader,
      rfcMessageId: emailMessages.rfcMessageId,
    })
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.ownerId, ownerId),
        eq(emailMessages.threadId, threadId),
      ),
    )
    .orderBy(desc(emailMessages.createdAt))
    .limit(1);
  return message ?? null;
}

async function prepareSend(
  userId: string,
  raw: SendEmailValues,
  localThread: LocalThread | null,
): Promise<PreparedSend> {
  const data = sendEmailSchema.parse(raw);
  const subject = data.subject.trim();

  if (
    localThread?.subject &&
    normalizeThreadSubject(localThread.subject) !==
      normalizeThreadSubject(subject)
  ) {
    throw new GmailServiceError(
      "Para responder en un hilo de Gmail, el asunto debe coincidir con el hilo.",
      "thread_mismatch",
    );
  }

  const personId =
    cleanOptional(data.personId) ?? localThread?.personId ?? null;
  const orgId = cleanOptional(data.orgId) ?? localThread?.orgId ?? null;
  const dealId = cleanOptional(data.dealId) ?? localThread?.dealId ?? null;
  await assertOptionalEntityLinks(userId, { dealId, orgId, personId });

  const replyHeaders = localThread
    ? referencesForReply(await getLastThreadMessage(userId, localThread.id))
    : { inReplyTo: null, references: null };

  return {
    bcc: normalizeAddresses(data.bcc),
    bodyHtml: cleanOptional(data.bodyHtml),
    bodyText: cleanOptional(data.bodyText),
    cc: normalizeAddresses(data.cc),
    dealId,
    inReplyTo: replyHeaders.inReplyTo,
    orgId,
    personId,
    references: replyHeaders.references,
    replyTo: normalizeAddresses(data.replyTo),
    subject,
    to: normalizeAddresses(data.to),
  };
}

async function callGmailSend(
  accessToken: string,
  raw: string,
  providerThreadId: string | null,
): Promise<
  | { ok: true; data: GmailMessageResponse }
  | { ok: false; status: number; error: string }
> {
  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw,
      ...(providerThreadId ? { threadId: providerThreadId } : {}),
    }),
  });

  const body = (await response.json().catch(() => ({}))) as
    | GmailMessageResponse
    | { error?: { message?: string; status?: string } };
  if (!response.ok) {
    const message =
      "error" in body && body.error?.message
        ? body.error.message
        : `Gmail HTTP ${response.status}`;
    return { error: message, ok: false, status: response.status };
  }
  return { data: body as GmailMessageResponse, ok: true };
}

export async function sendGmailEmail(userId: string, raw: SendEmailValues) {
  const account = await getGoogleAccount(userId);
  const mailbox = await ensureGmailMailbox(userId, account);
  const localThread = await getLocalThread(userId, cleanOptional(raw.threadId));

  if (localThread && localThread.mailboxId !== mailbox.id) {
    throw new GmailServiceError(
      "El hilo pertenece a otro buzón.",
      "thread_mismatch",
    );
  }

  const counter = effectiveDailyCounter(mailbox);
  if (counter.sentToday >= mailbox.dailyLimit) {
    throw new GmailServiceError(
      "Has alcanzado el límite diario de envío del buzón.",
      "daily_limit",
    );
  }

  const prepared = await prepareSend(userId, raw, localThread);
  const fromEmail = normalizeEmail(mailbox.email);
  const fromName =
    cleanOptional(mailbox.fromName) ?? cleanOptional(mailbox.displayName);
  const localMessageId = makeRfcMessageId(fromEmail);

  const rawMessage = buildGmailRawMessage({
    bcc: prepared.bcc,
    bodyHtml: prepared.bodyHtml,
    bodyText: prepared.bodyText,
    cc: prepared.cc,
    from: { email: fromEmail, name: fromName },
    inReplyTo: prepared.inReplyTo,
    messageId: localMessageId,
    references: prepared.references,
    replyTo: prepared.replyTo,
    subject: prepared.subject,
    to: prepared.to,
  });

  let token = await getGoogleAccessToken(userId, account);
  let gmailResult = await callGmailSend(
    token.accessToken,
    rawMessage,
    localThread?.providerThreadId ?? null,
  );
  if (!gmailResult.ok && gmailResult.status === 401 && !token.refreshed) {
    token = await getGoogleAccessToken(userId, account, true);
    gmailResult = await callGmailSend(
      token.accessToken,
      rawMessage,
      localThread?.providerThreadId ?? null,
    );
  }

  if (!gmailResult.ok) {
    if (gmailResult.status === 401 || gmailResult.status === 403) {
      await markMailboxNeedsReauth(userId, gmailResult.error);
      throw new GmailServiceError(
        "Gmail rechazó el envío por permisos. Reautoriza Gmail desde Bandeja.",
        "needs_reauth",
      );
    }
    await db
      .update(mailboxes)
      .set({ lastSyncError: gmailResult.error, status: "error" })
      .where(eq(mailboxes.id, mailbox.id));
    throw new GmailServiceError(
      `Gmail rechazó el envío: ${gmailResult.error}`,
      "gmail_api_error",
    );
  }

  const gmailMessage = gmailResult.data;
  if (!gmailMessage.id || !gmailMessage.threadId) {
    throw new GmailServiceError(
      "Gmail no devolvió identificador de mensaje o hilo.",
      "gmail_api_error",
    );
  }
  const providerMessageId = gmailMessage.id;
  const providerThreadId = gmailMessage.threadId;

  const now = new Date();
  return db.transaction(async (tx) => {
    let thread = localThread;
    if (!thread) {
      const [existing] = await tx
        .select({
          dealId: emailThreads.dealId,
          id: emailThreads.id,
          mailboxId: emailThreads.mailboxId,
          orgId: emailThreads.orgId,
          personId: emailThreads.personId,
          providerThreadId: emailThreads.providerThreadId,
          subject: emailThreads.subject,
        })
        .from(emailThreads)
        .where(
          and(
            eq(emailThreads.mailboxId, mailbox.id),
            eq(emailThreads.providerThreadId, providerThreadId),
          ),
        )
        .limit(1);
      if (existing) {
        thread = existing;
      } else {
        const [created] = await tx
          .insert(emailThreads)
          .values({
            dealId: prepared.dealId,
            lastMessageAt: now,
            lastOutboundAt: now,
            mailboxId: mailbox.id,
            messageCount: 0,
            orgId: prepared.orgId,
            ownerId: userId,
            personId: prepared.personId,
            providerLabels: gmailMessage.labelIds ?? [],
            providerThreadId,
            snippet: gmailMessage.snippet ?? excerpt(prepared.bodyText),
            subject: prepared.subject,
            unread: false,
          })
          .returning({
            dealId: emailThreads.dealId,
            id: emailThreads.id,
            mailboxId: emailThreads.mailboxId,
            orgId: emailThreads.orgId,
            personId: emailThreads.personId,
            providerThreadId: emailThreads.providerThreadId,
            subject: emailThreads.subject,
          });
        if (!created) throw new Error("No se pudo registrar el hilo de Gmail");
        thread = created;
      }
    }

    await tx
      .update(emailThreads)
      .set({
        dealId: prepared.dealId ?? thread.dealId,
        lastMessageAt: now,
        lastOutboundAt: now,
        messageCount: sql`${emailThreads.messageCount} + 1`,
        orgId: prepared.orgId ?? thread.orgId,
        personId: prepared.personId ?? thread.personId,
        snippet: gmailMessage.snippet ?? excerpt(prepared.bodyText),
        subject: thread.subject ?? prepared.subject,
        unread: false,
      })
      .where(eq(emailThreads.id, thread.id));

    const [message] = await tx
      .insert(emailMessages)
      .values({
        bccRecipients: prepared.bcc,
        bodyHtml: prepared.bodyHtml,
        bodyText: prepared.bodyText,
        ccRecipients: prepared.cc,
        direction: "outbound",
        fromEmail,
        fromName,
        inReplyTo: prepared.inReplyTo,
        mailboxId: mailbox.id,
        ownerId: userId,
        provider: "gmail",
        providerMessageId,
        providerThreadId,
        referencesHeader: prepared.references,
        replyToRecipients: prepared.replyTo,
        rfcMessageId: localMessageId,
        sentAt: now,
        snippet: gmailMessage.snippet ?? excerpt(prepared.bodyText),
        status: "sent",
        subject: prepared.subject,
        threadId: thread.id,
        toRecipients: prepared.to,
      })
      .returning({ id: emailMessages.id });
    if (!message) throw new Error("No se pudo registrar el mensaje enviado");

    await tx.insert(emailEvents).values({
      mailboxId: mailbox.id,
      messageId: message.id,
      meta: {
        providerMessageId,
        providerThreadId,
      },
      occurredAt: now,
      ownerId: userId,
      provider: "gmail",
      type: "sent",
    });

    await tx.insert(activityLog).values({
      actorId: userId,
      entityId: message.id,
      entityType: "email_message",
      payload: {
        subject: prepared.subject,
        threadId: thread.id,
        to: prepared.to.map((recipient) => recipient.email),
      },
      verb: "emailed",
    });

    await tx
      .update(mailboxes)
      .set({
        lastSyncError: null,
        sentToday: counter.sentToday + 1,
        sentTodayResetAt: counter.resetAt,
        status: "active",
      })
      .where(eq(mailboxes.id, mailbox.id));

    return {
      id: message.id,
      mailboxId: mailbox.id,
      providerMessageId,
      providerThreadId,
      threadId: thread.id,
    };
  });
}
