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
  | "RATE_LIMIT_EXCEEDED";

/**
 * @param userId       rate-limit subject
 * @param passwordHash the user's bcrypt hash, or null/empty for an OAuth-only
 *                     account — those have no password to prove, so an active
 *                     session is itself the step-up signal (matching the prior
 *                     `verifyPasswordForStepUp` behaviour).
 * @param supplied     the plaintext password the caller sent
 */
export async function verifyStepUpPassword(
  userId: string,
  passwordHash: string | null | undefined,
  supplied: string | null | undefined,
): Promise<StepUpResult> {
  if (!passwordHash) return "OK";

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
