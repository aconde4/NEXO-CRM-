import "server-only";

import { and, eq } from "drizzle-orm";

import { missingGmailScopes, parseOAuthScope } from "@/lib/google-oauth";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";

export async function getGmailConnectionStatus() {
  const user = await requireUser();
  const [account] = await db
    .select({
      accessToken: accounts.access_token,
      expiresAt: accounts.expires_at,
      providerAccountId: accounts.providerAccountId,
      refreshToken: accounts.refresh_token,
      scope: accounts.scope,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.provider, "google")))
    .limit(1);

  const missingScopes = missingGmailScopes(account?.scope);
  const grantedScopes = Array.from(parseOAuthScope(account?.scope)).sort();
  const hasRefreshToken = Boolean(account?.refreshToken);

  return {
    connected: Boolean(account),
    email: user.email ?? null,
    expiresAt:
      typeof account?.expiresAt === "number"
        ? new Date(account.expiresAt * 1000)
        : null,
    grantedScopes,
    hasAccessToken: Boolean(account?.accessToken),
    hasRefreshToken,
    missingScopes,
    providerAccountId: account?.providerAccountId ?? null,
    ready: Boolean(account && hasRefreshToken && missingScopes.length === 0),
  };
}
