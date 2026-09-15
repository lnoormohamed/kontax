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
 *
 * P48-02 — the pending-deletion contract, decided and documented:
 *
 *   A user-initiated deletion leaves `lifecycleState: "ACTIVE"` and sets
 *   `User.scheduledDeleteAt`. (LOCKED stays reserved for admin suspension,
 *   whose sign-in is refused outright in `authorize`.) The user can therefore
 *   sign in normally — password plus TOTP — and the JWT carries
 *   `pendingDeletion: true` for as long as `scheduledDeleteAt` is set.
 *
 *   Such a session is READ-ONLY PLUS CANCEL:
 *     - reads are allowed, so the 30-day grace period is actually useful — the
 *       user can review and export their data before it is destroyed;
 *     - every write goes through `requireSession({ write: true })` and is
 *       refused with PENDING_DELETION;
 *     - the single exception is `cancelAccountDeletion`, which reads `auth()`
 *       directly on purpose (see the comment on that action);
 *     - sign-out is always available.
 *
 *   The flag follows the database: the JWT callback recomputes it from
 *   `scheduledDeleteAt` on every validation (cached and uncached), and
 *   cancelling invalidates the session-validation cache, so the gate lifts on
 *   the next request rather than at the next sign-in.
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

/** Human-readable text for a `SessionError`, for actions that throw rather than return an `ActionResult`. */
export function sessionErrorMessage(err: SessionError): string {
  switch (err.code) {
    case "UNAUTHENTICATED":
      return "You need to be signed in.";
    case "IMPERSONATION_READ_ONLY":
      return "This is a read-only impersonation session — changes are blocked.";
    case "PENDING_DELETION":
      return "Your account is scheduled for deletion. Cancel the deletion to make changes.";
  }
}

/**
 * P48-06: map a `SessionError` to the `ActionResult` failure shape used across
 * `src/app/actions/*`. `UNAUTHENTICATED` becomes the existing `SESSION_EXPIRED`
 * reason; the two write-refusal codes become `ERROR` with a message, since
 * `ActionResult`'s `reason` union has no dedicated slot for them.
 */
export function sessionErrorResult(
  err: SessionError,
): { ok: false; reason: "SESSION_EXPIRED" | "ERROR"; message?: string } {
  if (err.code === "UNAUTHENTICATED") return { ok: false, reason: "SESSION_EXPIRED" };
  return { ok: false, reason: "ERROR", message: sessionErrorMessage(err) };
}
