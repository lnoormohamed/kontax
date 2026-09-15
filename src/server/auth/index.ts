import NextAuth, { type Session } from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const baseAuth = cache(uncachedAuth);

/** Session as seen by the app: the Auth.js session plus impersonation metadata. */
export type AppSession = Session & { impersonationExpiresAt?: number };

/**
 * Request-scoped session resolver. P21-07: if the real (ADMIN) user has a valid
 * impersonation cookie, resolve the session to the impersonated USER so every
 * read renders as that user. `impersonatedBy` is set so write actions can refuse
 * (assertWritable) and the app can show the banner. Normal users pay only a
 * cheap early return.
 *
 * This is the RAW resolver: it returns password-only sessions that still owe a
 * TOTP challenge (`pendingTotp: true`). Only the 2FA challenge flow may use it —
 * everything else goes through `auth()` below.
 */
const resolveSession = cache(async (): Promise<AppSession | null> => {
  const session = await baseAuth();
  if (session?.user?.role !== "ADMIN") return session;

  // Lazily imported so the common (non-admin) path stays free of cookie/db work.
  const { readImpersonation } = await import("~/server/admin/impersonation");
  const imp = await readImpersonation();
  if (imp?.adminId !== session.user.id) return session;

  const { db } = await import("~/server/db");
  const target = await db.user.findUnique({
    where: { id: imp.targetId },
    select: { id: true, email: true, name: true, avatarUrl: true, emailVerified: true },
  });
  if (!target) return session;

  return {
    ...session,
    user: {
      ...session.user,
      id: target.id,
      email: target.email,
      name: target.name,
      avatarUrl: target.avatarUrl,
      emailVerified: target.emailVerified,
      role: "USER" as const,
    },
    impersonatedBy: imp.adminId,
    impersonationExpiresAt: imp.exp,
  };
});

/**
 * The session every page, server action and API route must use.
 *
 * P48-01: a user who has entered a correct password but not yet completed the
 * TOTP challenge is NOT signed in. Their JWT carries `pendingTotp: true`, and
 * this wrapper returns `null` for it, so every existing `session?.user?.id`
 * check treats them as anonymous. The 2FA challenge actions and the login page
 * use `authIncludingPendingTotp()` to see the pending session and route the
 * user to `/login/verify-2fa`.
 */
const auth = cache(async (): Promise<AppSession | null> => {
  const session = await resolveSession();
  if (!session?.user?.id) return null;
  if (session.pendingTotp) return null;
  return session;
});

/**
 * Session resolver that also returns pending-TOTP sessions. Restricted to the
 * 2FA challenge flow (`actions/totp.ts` challenge/recovery, `/login` redirect
 * logic). Do not use anywhere that grants access to user data.
 */
const authIncludingPendingTotp = resolveSession;

export { auth, authIncludingPendingTotp, handlers, signIn, signOut };
