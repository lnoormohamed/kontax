import crypto from "crypto";

import EmailChangeNotice from "~/emails/email-change-notice";
import { db } from "~/server/db";
import { sendEmail } from "~/server/email";
import { renderEmail } from "~/server/render-email";
import { invalidateSessionValidation } from "~/server/session-validation-cache";

/**
 * P48-03 — "this wasn't me" for email changes.
 *
 * `requestEmailChange` used to `console.log` a reminder to notify the old
 * address, so a hijacked session could move an account to an attacker's address
 * without the owner ever hearing about it. Now the old address gets a real
 * email carrying a one-time, 24-hour link.
 *
 * Token handling mirrors the other token flows in this codebase: 256 bits of
 * randomness, only the SHA-256 hash stored (`User.emailChangeRevertTokenHash`),
 * a hard expiry (`emailChangeRevertExpiresAt`) and single use.
 *
 * The link is deliberately usable in BOTH states:
 *   - change still pending  → cancel it, leave the address alone;
 *   - change already active → restore `emailPreviousAddress`.
 * Either way `sessionVersion` is bumped and the validation cache dropped, so
 * whoever made the change is signed out everywhere on their next request. The
 * account owner then resets their password to finish taking it back.
 */

export const EMAIL_CHANGE_REVERT_HOURS = 24;

const hashToken = (plaintext: string) =>
  crypto.createHash("sha256").update(plaintext).digest("hex");

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/** Clears every column of the revert flow. Used on revert, cancel and re-request. */
export const REVERT_FIELDS_CLEARED = {
  emailChangeRevertTokenHash: null,
  emailChangeRevertExpiresAt: null,
  emailPreviousAddress: null,
} as const;

export async function sendEmailChangeNotice(params: {
  /** The account's current (old) address — the recipient of this notice. */
  to: string;
  newEmail: string;
  requestedAt: Date;
  revertToken: string;
}): Promise<void> {
  const revertUrl = `${appUrl()}/revert-email?token=${params.revertToken}`;

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[Kontax] Email-change revert link for ${params.to}:\n${revertUrl}\n`);
  }

  try {
    const { html, text } = await renderEmail(
      EmailChangeNotice({
        currentEmail: params.to,
        newEmail: params.newEmail,
        requestedAt: params.requestedAt.toUTCString(),
        revertUrl,
        expiresHours: EMAIL_CHANGE_REVERT_HOURS,
      }),
    );
    await sendEmail({
      to: params.to,
      subject: "Security alert: your Kontax email address is being changed",
      html,
      text,
      // A security notice must reach the owner even if the address has bounced
      // before — this is exactly the message they cannot afford to miss.
      bypassSuppression: true,
    });
  } catch (err) {
    console.error("[Kontax] Failed to send email-change notice:", err);
  }
}

export type RevertEmailChangeResult =
  | { ok: true; restoredEmail: string; wasActivated: boolean }
  | { ok: false; reason: "TOKEN_INVALID" | "TOKEN_EXPIRED" | "EMAIL_TAKEN" };

/** Consume a revert token: cancel the pending change, or restore the old address. */
export async function revertEmailChange(
  plaintextToken: string,
): Promise<RevertEmailChangeResult> {
  if (!plaintextToken) return { ok: false, reason: "TOKEN_INVALID" };

  const user = await db.user.findFirst({
    where: { emailChangeRevertTokenHash: hashToken(plaintextToken) },
    select: {
      id: true,
      email: true,
      emailPendingChange: true,
      emailPreviousAddress: true,
      emailChangeRevertExpiresAt: true,
    },
  });

  if (!user) return { ok: false, reason: "TOKEN_INVALID" };
  if (!user.emailChangeRevertExpiresAt || user.emailChangeRevertExpiresAt < new Date()) {
    return { ok: false, reason: "TOKEN_EXPIRED" };
  }

  // Already activated when the account's address no longer matches the one the
  // notice was sent to; otherwise the change is still only pending.
  const wasActivated =
    !!user.emailPreviousAddress && user.emailPreviousAddress !== user.email;
  const restoredEmail = wasActivated ? user.emailPreviousAddress! : user.email;

  if (wasActivated) {
    // Someone may have claimed the old address in the meantime — refuse rather
    // than blow up on the unique constraint.
    const conflict = await db.user.findFirst({
      where: { email: restoredEmail, NOT: { id: user.id } },
      select: { id: true },
    });
    if (conflict) return { ok: false, reason: "EMAIL_TAKEN" };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        ...(wasActivated ? { email: restoredEmail, emailVerified: new Date() } : {}),
        emailPendingChange: null,
        emailPendingChangeRequestedAt: null,
        ...REVERT_FIELDS_CLEARED,
        // Sign every session out — including whoever made the change.
        sessionVersion: { increment: 1 },
      },
    });
    // Burn any outstanding confirmation link for the new address.
    await tx.emailVerificationToken.updateMany({
      where: { userId: user.id, type: "EMAIL_CHANGE", usedAt: null },
      data: { usedAt: new Date() },
    });
  });

  // The sessionVersion bump must beat the 45s validation cache (P38-09).
  await invalidateSessionValidation(user.id);

  await db.activityEvent.create({
    data: {
      userId: user.id,
      eventType: "ACCOUNT_UPDATED",
      actor: "USER",
      payload: { field: "emailChangeReverted", restoredEmail, wasActivated },
    },
  });

  return { ok: true, restoredEmail, wasActivated };
}
