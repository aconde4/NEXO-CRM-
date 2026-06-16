import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { db } from "@/server/db";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";

/** Allowlist monousuario: solo estos correos pueden iniciar sesión. */
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

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
      // access_type=offline + prompt=consent → obtenemos refresh_token,
      // necesario para la futura integración con Gmail API (Fase 3).
      authorization: {
        params: { access_type: "offline", prompt: "consent" },
      },
    }),
  ],
  callbacks: {
    signIn({ user }) {
      if (allowedEmails.length === 0) return true;
      const email = user.email?.toLowerCase();
      return Boolean(email && allowedEmails.includes(email));
    },
  },
});
