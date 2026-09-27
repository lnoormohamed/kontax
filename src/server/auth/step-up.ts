import "server-only";

import bcrypt from "bcryptjs";

import { checkRateLimit, rateLimiters, refundRateLimit } from "~/server/rate-limit";

/**
 * P48-02 — server-side step-up verification.
 *
 * `ConfirmPasswordModal` used to call `verifyPasswordForStepUp` and, on a
 * `true`, invoke the sensitive action with no proof attached. The boolean was
 * bound to nothing: anyone who could call the action could skip the modal
 * entirely. The password is now passed *into* each sensitive action and checked
 * here, against the same `stepUpVerify` bucket, so the check cannot be bypassed
 * and cannot be used as an unlimited password oracle.
 */
export type StepUpResult =
  | "OK"
  /** No password supplied — the caller should prompt for one and retry. */
  | "STEP_UP_REQUIRED"
  | "WRONG_PASSWORD"
  | "RATE_LIMIT_EXCEEDED"
  /**
   * P49A-13 (Fable review): the account has no password hash, and the caller
   * did not opt in to passwordless step-up. Refused.
   */
  | "PASSWORD_NOT_SET";

export type StepUpOptions = {
  /**
   * What an account with no password hash gets. Default "deny".
   *
   * P49A-13 (Fable review): this used to be an implicit "OK" — an active
   * session was the step-up signal for an OAuth-only account. No such account
   * can exist today (`User.password` is required and every sign-up sets a
   * bcrypt hash), so the branch was unreachable — but it was a latent
   * fail-open: a future passwordless sign-in provider would have silently
   * turned every step-up in the app into "session only". A caller that
   * genuinely wants the session to stand in must now say so with
   * `{ passwordless: "allow-session" }` and should pair it with another factor.
   */
  passwordless?: "deny" | "allow-session";
};

/**
 * @param userId       rate-limit subject
 * @param passwordHash the user's bcrypt hash (null/empty: no password set —
 *                     refused unless `options.passwordless` allows it)
 * @param supplied     the plaintext password the caller sent
 */
export async function verifyStepUpPassword(
  userId: string,
  passwordHash: string | null | undefined,
  supplied: string | null | undefined,
  options: StepUpOptions = {},
): Promise<StepUpResult> {
  if (typeof passwordHash !== "string" || passwordHash.length === 0) {
    return options.passwordless === "allow-session" ? "OK" : "PASSWORD_NOT_SET";
  }

  if (typeof supplied !== "string" || supplied.length === 0) {
    return "STEP_UP_REQUIRED";
  }

  const key = `user:${userId}`;
  const rl = await checkRateLimit(rateLimiters.stepUpVerify, key);
  if (!rl.allowed) return "RATE_LIMIT_EXCEEDED";

  const matches = await bcrypt.compare(supplied, passwordHash);
  if (!matches) return "WRONG_PASSWORD";

  // P49A-13: more actions now take a step-up (API tokens, 2FA, sync
  // credentials), and a CardDAV setup can take a few tries. Only wrong
  // passwords should count toward the 5/hour bucket, so a correct one gives its
  // point back. The point is still consumed *before* the compare, so a burst of
  // concurrent guesses stays bounded by the bucket.
  await refundRateLimit(rateLimiters.stepUpVerify, key);
  return "OK";
}
