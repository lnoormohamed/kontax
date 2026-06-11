"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { signOut } from "~/server/auth";
import { db } from "~/server/db";
import { generateVerificationToken } from "~/server/email-verification";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

// ─── Password Reset (P18-05) ──────────────────────────────────────────────────

/**
 * Request a password reset link. Always returns success — never reveals
 * whether an account exists for the given email (prevents enumeration).
 */
export async function requestPasswordReset(
  email: string,
  ip?: string,
): Promise<{ success: true }> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(email);
  if (!parsed.success) return { success: true };

  const normalised = parsed.data;

  // Rate limit by email and IP (silently — don't reveal the limit was hit)
  const [emailRl, ipRl] = await Promise.all([
    checkRateLimit(rateLimiters.passwordResetByEmail, `email:${normalised}`),
    ip ? checkRateLimit(rateLimiters.passwordResetByIp, `ip:${ip}`) : { allowed: true },
  ]);
  if (!emailRl.allowed || !ipRl.allowed) {
    console.warn(`[Kontax] Password reset rate-limited for ${normalised} / ${ip ?? "unknown"}`);
    return { success: true };
  }

  const user = await db.user.findUnique({ where: { email: normalised }, select: { id: true } });
  if (!user) {
    console.warn(`[Kontax] Password reset: no account for ${normalised}`);
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
    data: { userId: user.id, tokenHash: hash, expiresAt, requestedFromIp: ip ?? null },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${plaintext}`;

  // Phase 20 wires SES — console in dev
  console.log(`\n[Kontax] Password reset link for ${normalised}:\n${resetUrl}\n`);

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

  const hash = crypto.createHash("sha256").update(input.plaintextToken).digest("hex");

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
