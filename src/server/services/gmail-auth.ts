import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { GMAIL_OAUTH_SCOPES, parseOAuthScope } from "@/lib/google-oauth";
import { db } from "@/server/db";
import { accounts, mailboxes, users } from "@/server/db/schema";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_EXPIRY_SKEW_SECONDS = 60;

export const GMAIL_SEND_SCOPE = GMAIL_OAUTH_SCOPES[0];
export const GMAIL_READ_SCOPE = GMAIL_OAUTH_SCOPES[1];

export type GoogleAccount = {
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

export class GmailServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "missing_credentials"
      | "missing_google_account"
      | "missing_scope"
      | "needs_reauth"
      | "mailbox_paused"
      | "daily_limit"
      | "thread_mismatch"
      | "gmail_api_error",
  ) {
    super(message);
  }
}

export function cleanOptional(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function nextUtcMidnight(from = new Date()): Date {
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

export function excerpt(text: string | null | undefined): string | null {
  const clean = text?.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 240) : null;
}

function scopeLabel(scope: string): string {
  if (scope === GMAIL_SEND_SCOPE) return "gmail.send";
  if (scope === GMAIL_READ_SCOPE) return "gmail.readonly";
  return scope;
}

export async function getGoogleAccount(
  userId: string,
  requiredScopes: string[],
): Promise<GoogleAccount> {
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
      "Conecta Gmail antes de usar el email 1:1.",
      "missing_google_account",
    );
  }
  if (!row.refreshToken) {
    throw new GmailServiceError(
      "Falta el refresh token de Google. Reautoriza Gmail desde Bandeja.",
      "needs_reauth",
    );
  }

  const grantedScopes = parseOAuthScope(row.scope);
  const missingScopes = requiredScopes.filter(
    (scope) => !grantedScopes.has(scope),
  );
  if (missingScopes.length > 0) {
    throw new GmailServiceError(
      `Falta el permiso ${missingScopes.map(scopeLabel).join(", ")}. Reautoriza Gmail desde Bandeja.`,
      "missing_scope",
    );
  }

  return row;
}

export async function markMailboxNeedsReauth(ownerId: string, error: string) {
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

export async function getGoogleAccessToken(
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

export async function ensureGmailMailbox(
  userId: string,
  account: GoogleAccount,
) {
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
      "El buzón está pausado. Actívalo antes de enviar o sincronizar.",
      "mailbox_paused",
    );
  }
  return mailbox;
}

export async function listGmailSyncCandidates() {
  const rows = await db
    .select({
      mailboxStatus: mailboxes.status,
      refreshToken: accounts.refresh_token,
      scope: accounts.scope,
      userId: accounts.userId,
    })
    .from(accounts)
    .leftJoin(
      mailboxes,
      and(
        eq(mailboxes.ownerId, accounts.userId),
        eq(mailboxes.provider, "gmail"),
        eq(mailboxes.accountProvider, "google"),
        eq(mailboxes.accountProviderAccountId, accounts.providerAccountId),
      ),
    )
    .where(eq(accounts.provider, "google"));

  return rows
    .filter((row) => {
      if (!row.refreshToken || row.mailboxStatus === "paused") return false;
      return parseOAuthScope(row.scope).has(GMAIL_READ_SCOPE);
    })
    .map((row) => ({ userId: row.userId }));
}
