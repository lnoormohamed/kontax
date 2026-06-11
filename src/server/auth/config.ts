import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types.
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      emailVerified: Date | null;
      avatarUrl: string | null;
    } & DefaultSession["user"];
    jti?: string;
    // Set by P18-07 (TOTP) — user authenticated with password but TOTP code not yet submitted
    pendingTotp?: boolean;
    // Set by P18-09 (account deletion) — account is in the 30-day grace period
    pendingDeletion?: boolean;
  }
}

/** Lightweight UA parser — avoids a heavy dependency. */
function parseDeviceHint(ua: string | null | undefined): string | null {
  if (!ua) return null;
  if (ua.includes("iPhone") || ua.includes("iPod")) return "Safari on iPhone";
  if (ua.includes("iPad")) return "Safari on iPad";
  if (ua.includes("Android") && ua.includes("Mobile")) return "Chrome on Android";
  if (ua.includes("Android")) return "Chrome on Android Tablet";
  const browser = ua.includes("Edg/") ? "Edge"
    : ua.includes("OPR/") || ua.includes("Opera") ? "Opera"
    : ua.includes("Firefox/") ? "Firefox"
    : ua.includes("Chrome/") ? "Chrome"
    : ua.includes("Safari/") ? "Safari"
    : "Browser";
  const os = ua.includes("Windows NT") ? "Windows"
    : ua.includes("Mac OS X") ? "macOS"
    : ua.includes("Linux") ? "Linux"
    : "Device";
  return `${browser} on ${os}`;
}

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,    // 30-day absolute token lifetime
    updateAge: 7 * 24 * 60 * 60,  // re-issue after 7 days of activity
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsedCredentials = z
          .object({
            email: z.string().trim().toLowerCase().email(),
            password: z.string().min(8),
          })
          .safeParse(credentials);

        if (!parsedCredentials.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsedCredentials.data.email },
        });

        if (!user) return null;

        const passwordMatches = await bcrypt.compare(
          parsedCredentials.data.password,
          user.password,
        );
        if (!passwordMatches) return null;

        // Capture IP + UA for UserSession creation in JWT callback (P18-06)
        const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? request?.headers?.get("x-real-ip")
          ?? null;
        const ua = request?.headers?.get("user-agent") ?? null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Custom fields passed through to jwt callback
          _ip: ip,
          _ua: ua,
          // P18-07: flag pending TOTP challenge if user has 2FA enabled
          _pendingTotp: user.totpEnabled,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        // Initial sign-in: create UserSession + load DB fields
        const jti = createId();
        const ip = (user as { _ip?: string | null })._ip ?? null;
        const ua = (user as { _ua?: string | null })._ua ?? null;

        const [dbUser] = await Promise.all([
          db.user.findUnique({
            where: { id: user.id },
            select: { sessionVersion: true, emailVerified: true, name: true, avatarUrl: true },
          }),
          // Create UserSession row (P18-06)
          db.userSession.create({
            data: {
              userId: user.id!,
              jti,
              ipAddress: ip,
              userAgent: ua,
              deviceHint: parseDeviceHint(ua),
            },
          }),
        ]);

        token.sub = user.id;
        token.jti = jti;
        token.sv = dbUser?.sessionVersion ?? 1;
        token.emailVerified = dbUser?.emailVerified?.toISOString() ?? null;
        token.name = dbUser?.name ?? null;
        token.avatarUrl = dbUser?.avatarUrl ?? null;
        // P18-07: embed pendingTotp if credentials verified but TOTP not yet confirmed
        if ((user as { _pendingTotp?: boolean })._pendingTotp) {
          token.pendingTotp = true;
        }

      } else if (token.sub && token.jti) {
        // Every subsequent request: validate sessionVersion + jti revocation
        const [dbUser, userSession] = await Promise.all([
          db.user.findUnique({
            where: { id: token.sub },
            select: { sessionVersion: true, emailVerified: true },
          }),
          db.userSession.findUnique({
            where: { jti: token.jti },
            select: { revokedAt: true, lastActiveAt: true, totpChallengeVerified: true },
          }),
        ]);

        if (!dbUser || dbUser.sessionVersion !== token.sv || !userSession || userSession.revokedAt) {
          return {};
        }

        // P18-07: TOTP challenge completed — clear pendingTotp from token
        if (token.pendingTotp && userSession.totpChallengeVerified) {
          token.pendingTotp = undefined;
        }

        // Keep emailVerified fresh
        token.emailVerified = dbUser.emailVerified?.toISOString() ?? null;

        // Update lastActiveAt if stale by > 5 minutes (fire-and-forget)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (userSession.lastActiveAt < fiveMinutesAgo) {
          void db.userSession.update({
            where: { jti: token.jti },
            data: { lastActiveAt: new Date() },
          });
        }

      } else if (token.sub && !token.jti) {
        // Sessions created before P18-06 — validate sessionVersion only
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          select: { sessionVersion: true, emailVerified: true },
        });
        if (!dbUser || dbUser.sessionVersion !== token.sv) return {};
        token.emailVerified = dbUser.emailVerified?.toISOString() ?? null;
      }

      if (trigger === "update" && session) {
        const fresh = await db.user.findUnique({
          where: { id: token.sub ?? "" },
          select: { sessionVersion: true, emailVerified: true, name: true, avatarUrl: true },
        });
        token.sv = fresh?.sessionVersion ?? token.sv;
        token.emailVerified = fresh?.emailVerified?.toISOString() ?? null;
        token.name = fresh?.name ?? token.name;
        token.avatarUrl = fresh?.avatarUrl ?? null;
        // P18-07: clear pendingTotp after successful TOTP challenge
        if ((session as { clearPendingTotp?: boolean }).clearPendingTotp) {
          token.pendingTotp = undefined;
        }
      }
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub ?? session.user.id,
        name: token.name as string | null,
        avatarUrl: token.avatarUrl as string | null,
        emailVerified: token.emailVerified
          ? new Date(token.emailVerified as string)
          : null,
      },
      jti: token.jti,
    }),
  },
} satisfies NextAuthConfig;
