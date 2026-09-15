"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";

import PasswordReset from "~/emails/password-reset";
import { getClientIp } from "~/lib/client-ip";
import { signOut } from "~/server/auth";
import { db } from "~/server/db";
import { sendEmail } from "~/server/email";
import { generateVerificationToken } from "~/server/email-verification";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";
import { renderEmail } from "~/server/render-email";
import { invalidateSessionValidation } from "~/server/session-validation-cache";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

// ─── Password Reset (P18-05) ──────────────────────────────────────────────────

/**
 * Request a password reset link. Always returns success — never reveals
 * whether an account exists for the given email (prevents enumeration).
 */
export async function requestPasswordReset(email: string): Promise<{ success: true }> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(email);
  if (!parsed.success) return { success: true };

  const normalised = parsed.data;

  // P48-03: the IP is derived from the request, never taken as an argument.
  // It used to be a parameter that the UI simply never passed, so the per-IP
  // limiter never fired and `requestedFromIp` was whatever a caller claimed.
  const ip = getClientIp(await headers());

  // Rate limit by email and IP (silently — don't reveal the limit was hit)
  const [emailRl, ipRl] = await Promise.all([
    checkRateLimit(rateLimiters.passwordResetByEmail, `email:${normalised}`),
    ip
      ? checkRateLimit(rateLimiters.passwordResetByIp, `ip:${ip}`)
      : { allowed: true },
  ]);
  // P48-17: these used to log the raw email address unconditionally — PII in
  // logs, and (for the "no account" case in particular) an operator-visible
  // account-enumeration oracle even though the HTTP response itself never
  // reveals it. Redact in every environment; this is a rate/volume signal for
  // an operator, not something that needs the exact address.
  const redactedEmail = normalised.replace(/^(.).*(@.*)$/, "$1***$2");

  if (!emailRl.allowed || !ipRl.allowed) {
    console.warn(
      `[Kontax] Password reset rate-limited for ${redactedEmail} / ${ip ?? "unknown"}`,
    );
    return { success: true };
  }

  const user = await db.user.findUnique({
    where: { email: normalised },
    select: { id: true },
  });
  if (!user) {
    console.warn(`[Kontax] Password reset: no account for ${redactedEmail}`);
    return { success: true };
  }

  // Invalidate any previous unused tokens
  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { plaintext, hash } = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt,
      requestedFromIp: ip ?? null,
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${plaintext}`;

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `\n[Kontax] Password reset link for ${normalised}:\n${resetUrl}\n`,
    );
  }

  // Render synchronously, then fire-and-forget the send so a slow SES response
  // never blocks the HTTP response (and never reveals account existence).
  const { html, text } = await renderEmail(PasswordReset({ resetUrl }));
  void sendEmail({
    to: normalised,
    subject: "Reset your Kontax password",
    html,
    text,
  });

  return { success: true };
}

/**
 * Consume a password reset token and set a new password.
 */
export async function resetPassword(input: {
  plaintextToken: string;
  newPassword: string;
}): Promise<{ success: true } | { error: string }> {
  if (input.newPassword.length < 8) return { error: "PASSWORD_TOO_SHORT" };

  const hash = crypto
    .createHash("sha256")
    .update(input.plaintextToken)
    .digest("hex");

  const token = await db.passwordResetToken.findUnique({
    where: { tokenHash: hash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!token || token.usedAt) return { error: "TOKEN_INVALID" };
  if (token.expiresAt < new Date()) return { error: "TOKEN_EXPIRED" };

  const newHash = await bcrypt.hash(input.newPassword, 12);

  await db.$transaction([
    db.user.update({
      where: { id: token.userId },
      data: { password: newHash, sessionVersion: { increment: 1 } },
    }),
    db.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);
  // P48-03: the sessionVersion bump must beat the 45s validation cache, exactly
  // as every other bumping path already does. Without this an attacker's live
  // session survived the victim's password reset for up to a full TTL — the one
  // window the reset exists to close.
  await invalidateSessionValidation(token.userId);

  await db.activityEvent.create({
    data: {
      userId: token.userId,
      eventType: "ACCOUNT_UPDATED",
      actor: "SYSTEM",
      payload: { field: "passwordResetCompleted" },
    },
  });

  return { success: true };
}
