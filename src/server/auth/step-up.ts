import "server-only";

import bcrypt from "bcryptjs";

import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

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

  const rl = await checkRateLimit(rateLimiters.stepUpVerify, `user:${userId}`);
  if (!rl.allowed) return "RATE_LIMIT_EXCEEDED";

  const matches = await bcrypt.compare(supplied, passwordHash);
  return matches ? "OK" : "WRONG_PASSWORD";
}
