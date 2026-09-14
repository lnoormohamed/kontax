import "server-only";

import { auth } from "~/server/auth";

/**
 * P48-01 / P48-06: the one place that decides whether a request is allowed to
 * act as a user. Server actions and route handlers should call `requireSession`
 * (or `requireUserId`) instead of hand-rolling `session?.user?.id` checks, so
 * the pending-TOTP, pending-deletion and impersonation rules live in one file.
 *
 * `auth()` already returns `null` for pending-TOTP sessions, so a caller that
 * still uses `auth()` directly is safe against the 2FA bypass; this helper adds
 * the write/impersonation semantics on top and gives callers a typed error.
 */
export type SessionErrorCode =
  | "UNAUTHENTICATED"
  | "PENDING_DELETION"
  | "IMPERSONATION_READ_ONLY";

export class SessionError extends Error {
  readonly code: SessionErrorCode;
  constructor(code: SessionErrorCode) {
    super(code);
    this.name = "SessionError";
    this.code = code;
  }
}

export type RequireSessionOptions = {
  /** The caller mutates data: refuse impersonated and pending-deletion sessions. */
  write?: boolean;
};

type FullSession = NonNullable<Awaited<ReturnType<typeof auth>>>;

/**
 * Resolve the current session or throw a `SessionError`.
 *
 * - Anonymous or pending-TOTP → `UNAUTHENTICATED`
 * - `write: true` and the session is an admin impersonation → `IMPERSONATION_READ_ONLY`
 * - `write: true` and the account is in its deletion grace period → `PENDING_DELETION`
 *   (P48-02 defines which writes remain allowed; today only `cancelAccountDeletion`
 *   should bypass this by reading `auth()` directly.)
 */
export async function requireSession(opts: RequireSessionOptions = {}): Promise<FullSession> {
  const session = await auth();
  if (!session?.user?.id) throw new SessionError("UNAUTHENTICATED");
  if (opts.write) {
    if (session.impersonatedBy) throw new SessionError("IMPERSONATION_READ_ONLY");
    if (session.pendingDeletion) throw new SessionError("PENDING_DELETION");
  }
  return session;
}

/** Convenience: the authenticated user's id, with the same rules as `requireSession`. */
export async function requireUserId(opts: RequireSessionOptions = {}): Promise<string> {
  const session = await requireSession(opts);
  return session.user.id;
}

/** True when `err` is a `SessionError` (for action-result mapping). */
export function isSessionError(err: unknown): err is SessionError {
  return err instanceof SessionError;
}
