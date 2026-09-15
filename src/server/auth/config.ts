import { CredentialsSignin, type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";

import { getClientIp } from "~/lib/client-ip";
import { db } from "~/server/db";
import { detectNewDeviceSignIn, recordFailedLogin } from "~/server/notifications";
import { checkRateLimit, peekRateLimit, rateLimiters } from "~/server/rate-limit";
import { readSessionValidation, writeSessionValidation } from "~/server/session-validation-cache";
import { getPreferences } from "~/server/preferences";
import { DEFAULT_PREFERENCES, type UserPreferences } from "~/lib/preferences-shared";

/**
 * Module augmentation for `next-auth` types.
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      emailVerified: Date | null;
      avatarUrl: string | null;
      // P21-01: platform admin role, surfaced so middleware can gate /admin.
      role: "USER" | "ADMIN";
      // P34B-01: per-user UI preferences, always fully populated via DEFAULT_PREFERENCES merge.
      preferences: Required<UserPreferences>;
    } & DefaultSession["user"];
    jti?: string;
    // Set by P18-07 (TOTP) — user authenticated with password but TOTP code not yet submitted
    pendingTotp?: boolean;
    // Set by P18-09 (account deletion) — account is in the 30-day grace period
    pendingDeletion?: boolean;
    // P21-07: present when an admin is impersonating this user (read-only view).
    impersonatedBy?: string;
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

class AccountLockedSigninError extends CredentialsSignin {
  code = "account_locked";
}

/**
 * P48-03: a valid bcrypt hash of a value nobody can supply. Compared against
 * when the email is unknown so an attacker cannot distinguish "no such account"
 * from "wrong password" by response time. Copied (not imported) from
 * `~/server/app-passwords` on purpose — that module is Node-only and pulling it
 * into the auth config would drag its DAV dependencies along.
 */
const DUMMY_BCRYPT_HASH =
  "$2b$12$3Y0mFQ0M0l9n4Y3Q6p0g2uh2jQ7JmYI3d2eY0m4rA4Aq0vN5iVfL2";

export const authConfig = {
  // Required for self-hosted deploys behind a reverse proxy (Coolify): trust the
  // proxy's x-forwarded-host / x-forwarded-proto headers. Without this, Auth.js
  // throws UntrustedHost and mis-detects https, breaking the session cookie.
  trustHost: true,
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

        // Capture IP + UA for UserSession creation in JWT callback (P18-06) and
        // for failed-login detection (P22-04).
        const ip = request?.headers ? getClientIp(request.headers) : null;
        const ua = request?.headers?.get("user-agent") ?? null;

        // P34D-01: brute-force protection.
        // Peek (no consume) so successful logins don't drain the bucket.
        // IP bucket checked first — cheap gate before any DB work.
        if (ip) {
          const ipPeek = await peekRateLimit(rateLimiters.loginByIp, `ip:${ip}`);
          if (!ipPeek.allowed) return null;
        }

        const user = await db.user.findUnique({
          where: { email: parsedCredentials.data.email },
        });

        if (!user) {
          // P48-03: burn the same ~250ms a real bcrypt.compare costs so the
          // response time does not reveal whether the account exists.
          await bcrypt.compare(parsedCredentials.data.password, DUMMY_BCRYPT_HASH);
          return null;
        }

        // Peek the per-account bucket before the bcrypt call.
        const emailPeek = await peekRateLimit(rateLimiters.loginByEmail, `email:${user.email}`);
        if (!emailPeek.allowed) return null;

        const passwordMatches = await bcrypt.compare(
          parsedCredentials.data.password,
          user.password,
        );
        if (!passwordMatches) {
          // Consume a point only on failure so successful logins don't lock users out.
          await checkRateLimit(rateLimiters.loginByEmail, `email:${user.email}`);
          if (ip) await checkRateLimit(rateLimiters.loginByIp, `ip:${ip}`);
          // P22-04 Rule 3: track repeated failed logins against this account.
          await recordFailedLogin(user.id, ip);
          return null;
        }

        // P48-02: LOCKED now means *admin suspension* only. A user who
        // scheduled their own deletion stays ACTIVE with a non-null
        // `scheduledDeleteAt`, so they can sign back in and cancel — which is
        // what the UI has always promised.
        if (user.lifecycleState === "LOCKED") {
          throw new AccountLockedSigninError();
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Custom fields passed through to jwt callback
          _ip: ip,
          _ua: ua,
          // P18-07: flag pending TOTP challenge if user has 2FA enabled
          _pendingTotp: user.totpEnabled,
          // P18-09: flag pending deletion grace period
          _pendingDeletion: !!user.scheduledDeleteAt,
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
        const deviceHint = parseDeviceHint(ua);

        // P22-DB05: raise a security alert when this (device, IP) pair has never
        // been seen on a prior session. Runs BEFORE the new session row is
        // inserted so the lookup reflects history. Never throws — sign-in must
        // not be blocked.
        await detectNewDeviceSignIn({ userId: user.id!, ipAddress: ip, deviceHint });

        const [dbUser, preferences] = await Promise.all([
          db.user.findUnique({
            where: { id: user.id },
            select: { sessionVersion: true, emailVerified: true, name: true, avatarUrl: true, role: true, lifecycleState: true },
          }),
          getPreferences(user.id!),
          // Create UserSession row (P18-06)
          db.userSession.create({
            data: {
              userId: user.id!,
              jti,
              ipAddress: ip,
              userAgent: ua,
              deviceHint,
            },
          }),
        ]);

        token.sub = user.id;
        // Store the UserSession id under `sid`, NOT `jti`: `jti` is a reserved JWT
        // claim that Auth.js overwrites with its own UUID during encoding, so a
        // value written to token.jti never survives to be matched against the DB.
        token.sid = jti;
        token.sv = dbUser?.sessionVersion ?? 1;
        token.emailVerified = dbUser?.emailVerified?.toISOString() ?? null;
        token.name = dbUser?.name ?? null;
        token.avatarUrl = dbUser?.avatarUrl ?? null;
        token.role = dbUser?.role ?? "USER";
        token.preferences = preferences;
        // P18-07: embed pendingTotp if credentials verified but TOTP not yet confirmed
        if ((user as { _pendingTotp?: boolean })._pendingTotp) {
          token.pendingTotp = true;
        }
        // P18-09: embed pendingDeletion if account is in 30-day grace period
        if ((user as { _pendingDeletion?: boolean })._pendingDeletion) {
          token.pendingDeletion = true;
        }

      } else if (token.sub && token.sid) {
        // Every subsequent request: validate sessionVersion + session revocation.
        // P38-09: a 45s Redis snapshot fronts the two DB queries; every
        // security-relevant write (revoke, revoke-all, password change,
        // lockdown, admin lock, deletion, email change) explicitly deletes the
        // affected keys, so revocation still takes effect on the next request.
        // pendingTotp sessions bypass the cache — they need a fresh
        // totpChallengeVerified read so the 2FA gate lifts immediately.
        const cached = token.pendingTotp
          ? null
          : await readSessionValidation(token.sub, token.sid as string);

        if (cached) {
          if (cached.revoked || cached.lifecycleState === "LOCKED" || cached.sessionVersion !== token.sv) {
            // P48-03: `null` (not `{}`) so Auth.js clears the cookie instead of
            // leaving an empty-but-present token that every `session?.user`
            // gate then has to defend against.
            return null;
          }
          token.emailVerified = cached.emailVerified;
          token.role = cached.role;
          // P48-02: keep pendingDeletion in step with the DB, so cancelling the
          // deletion lifts the read-only gate on the very next request.
          token.pendingDeletion = cached.scheduledDeleteAt ? true : undefined;
          // lastActiveAt refresh is skipped on cache hits: the 45s TTL is far
          // inside the 5-minute staleness window, so a miss updates it soon.
        } else {
          const [dbUser, userSession] = await Promise.all([
            db.user.findUnique({
              where: { id: token.sub },
              select: { sessionVersion: true, emailVerified: true, role: true, lifecycleState: true, scheduledDeleteAt: true },
            }),
            db.userSession.findUnique({
              where: { jti: token.sid as string },
              select: { revokedAt: true, lastActiveAt: true, totpChallengeVerified: true },
            }),
          ]);

          if (!dbUser || dbUser.lifecycleState === "LOCKED" || dbUser.sessionVersion !== token.sv || !userSession || userSession.revokedAt) {
            return null;
          }

          // P18-07: TOTP challenge completed — clear pendingTotp from token
          if (token.pendingTotp && userSession.totpChallengeVerified) {
            token.pendingTotp = undefined;
          }

          // Keep emailVerified + role fresh
          token.emailVerified = dbUser.emailVerified?.toISOString() ?? null;
          token.role = dbUser.role;
          // P48-02: same refresh as the cache-hit path — the flag follows
          // `scheduledDeleteAt`, it is never sticky on the token.
          token.pendingDeletion = dbUser.scheduledDeleteAt ? true : undefined;

          // Update lastActiveAt if stale by > 5 minutes (fire-and-forget)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          if (userSession.lastActiveAt < fiveMinutesAgo) {
            void db.userSession.update({
              where: { jti: token.sid as string },
              data: { lastActiveAt: new Date() },
            });
          }

          // Only cache fully-validated, non-pendingTotp sessions.
          // P48-03: awaited, not fire-and-forget. A concurrent revoke deletes
          // the key while this request is in flight; if the write lands after
          // that delete, the revoked session stays valid for the full 45s TTL.
          // Awaiting a single local SETEX costs well under a millisecond.
          if (!token.pendingTotp) {
            await writeSessionValidation(token.sub, token.sid as string, {
              sessionVersion: dbUser.sessionVersion,
              lifecycleState: dbUser.lifecycleState,
              role: dbUser.role,
              emailVerified: dbUser.emailVerified?.toISOString() ?? null,
              revoked: false,
              scheduledDeleteAt: dbUser.scheduledDeleteAt?.toISOString() ?? null,
            });
          }
        }

      } else if (token.sub && !token.sid) {
        // Sessions created before P18-06 — validate sessionVersion only
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          select: { sessionVersion: true, emailVerified: true, role: true, lifecycleState: true, scheduledDeleteAt: true },
        });
        if (!dbUser || dbUser.lifecycleState === "LOCKED" || dbUser.sessionVersion !== token.sv) return null;
        token.emailVerified = dbUser.emailVerified?.toISOString() ?? null;
        token.role = dbUser.role;
        token.pendingDeletion = dbUser.scheduledDeleteAt ? true : undefined;
      }

      if (trigger === "update" && session) {
        const [fresh, preferences] = await Promise.all([
          db.user.findUnique({
            where: { id: token.sub ?? "" },
            select: { sessionVersion: true, emailVerified: true, name: true, avatarUrl: true, lifecycleState: true, scheduledDeleteAt: true },
          }),
          getPreferences(token.sub ?? ""),
        ]);
        if (fresh?.lifecycleState === "LOCKED") {
          return null;
        }
        // P48 review: never re-sync `sv` here — a client-triggered update must not
        // let a token survive a sessionVersion bump that is still propagating.
        token.emailVerified = fresh?.emailVerified?.toISOString() ?? null;
        token.pendingDeletion = fresh?.scheduledDeleteAt ? true : undefined;
        token.name = fresh?.name ?? token.name;
        token.avatarUrl = fresh?.avatarUrl ?? null;
        token.preferences = preferences;
        // P48-01: `pendingTotp` is NEVER cleared from the client-supplied update
        // payload. The only path that clears it is the DB-backed check above
        // (`userSession.totpChallengeVerified`), which the 2FA page triggers by
        // fetching /api/auth/session after a successful challenge.
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
        role: (token.role as "USER" | "ADMIN" | undefined) ?? "USER",
        emailVerified: token.emailVerified
          ? new Date(token.emailVerified as string)
          : null,
        preferences: (token.preferences as Required<UserPreferences> | undefined) ?? DEFAULT_PREFERENCES,
      },
      // Expose the UserSession id as `jti` to the app layer (sessions.ts, totp.ts
      // compare session.jti against UserSession.jti). Sourced from token.sid.
      jti: token.sid as string | undefined,
      pendingTotp: token.pendingTotp as boolean | undefined,
      pendingDeletion: token.pendingDeletion as boolean | undefined,
    }),
  },
} satisfies NextAuthConfig;
