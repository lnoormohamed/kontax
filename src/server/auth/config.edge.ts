import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config — no DB or Node.js-only imports.
 * Used exclusively by src/middleware.ts to validate JWTs on the Edge Runtime.
 * The full credentials provider + DB logic lives in config.ts.
 */
export const authConfigEdge = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,     // 30 days absolute token lifetime
    updateAge: 7 * 24 * 60 * 60,   // re-issue token after 7 days of activity
  },
  providers: [],
  callbacks: {
    jwt: ({ token }) => token,
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub ?? session.user.id,
      },
      pendingTotp: (token.pendingTotp as boolean | undefined) ?? false,
      pendingDeletion: (token.pendingDeletion as boolean | undefined) ?? false,
    }),
  },
} satisfies NextAuthConfig;
