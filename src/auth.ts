import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import type { Account } from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { GOOGLE_OAUTH_AUTHORIZATION_PARAMS } from "@/lib/google-oauth";
import { getDb } from "@/server/db";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";

const db = getDb();

/** Allowlist monousuario: solo estos correos pueden iniciar sesión. */
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

async function persistGoogleAccount(account?: Account | null) {
  if (account?.provider !== "google" || !account.providerAccountId) return;

  const update: Partial<typeof accounts.$inferInsert> = {};
  if (account.access_token) update.access_token = account.access_token;
  if (account.refresh_token) update.refresh_token = account.refresh_token;
  if (typeof account.expires_at === "number")
    update.expires_at = account.expires_at;
  if (account.token_type) update.token_type = account.token_type;
  if (account.scope) update.scope = account.scope;
  if (account.id_token) update.id_token = account.id_token;
  if (Object.keys(update).length === 0) return;

  await db
    .update(accounts)
    .set(update)
    .where(
      and(
        eq(accounts.provider, "google"),
        eq(accounts.providerAccountId, account.providerAccountId),
      ),
    );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  session: { strategy: "database" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Offline + consentimiento explícito: necesitamos refresh_token y scopes
      // Gmail para enviar y leer correo 1:1 desde la Fase 3.
      authorization: {
        params: GOOGLE_OAUTH_AUTHORIZATION_PARAMS,
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (allowedEmails.length > 0) {
        const email = user.email?.toLowerCase();
        if (!email || !allowedEmails.includes(email)) return false;
      }

      await persistGoogleAccount(account);
      const email = user.email?.toLowerCase();
      return Boolean(email || allowedEmails.length === 0);
    },
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
