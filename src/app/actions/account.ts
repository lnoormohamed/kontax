"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { sendVerificationEmail } from "~/server/email-verification";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

// ─── Password Change (P18-02) ────────────────────────────────────────────────

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  const rl = await checkRateLimit(rateLimiters.passwordChange, `user:${session.user.id}`);
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, sessionVersion: true },
  });
  if (!user) return { error: "UNAUTHORIZED" };

  const currentMatches = await bcrypt.compare(input.currentPassword, user.password);
  if (!currentMatches) return { error: "CURRENT_PASSWORD_INCORRECT" };

  if (input.newPassword.length < 8) return { error: "PASSWORD_TOO_SHORT" };
  if (input.newPassword === input.currentPassword) return { error: "PASSWORD_SAME_AS_CURRENT" };

  const newHash = await bcrypt.hash(input.newPassword, 12);

  await db.user.update({
    where: { id: session.user.id },
    data: { password: newHash, sessionVersion: { increment: 1 } },
  });

  await db.activityEvent.create({
    data: {
      userId: session.user.id,
      eventType: "ACCOUNT_UPDATED",
      actor: "USER",
      payload: { field: "password" },
    },
  });

  return { success: true };
}

// ─── Email Change (P18-03) ───────────────────────────────────────────────────

export async function requestEmailChange(
  newEmail: string,
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  const parsed = z.string().trim().toLowerCase().email().max(254).safeParse(newEmail);
  if (!parsed.success) return { error: "INVALID_EMAIL" };
  const email = parsed.data;

  const rl = await checkRateLimit(rateLimiters.emailResend, `email-change:${session.user.id}`);
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!user) return { error: "UNAUTHORIZED" };
  if (email === user.email) return { error: "EMAIL_SAME_AS_CURRENT" };

  const conflict = await db.user.findFirst({ where: { email, NOT: { id: session.user.id } } });
  if (conflict) return { error: "EMAIL_ALREADY_IN_USE" };

  await db.user.update({
    where: { id: session.user.id },
    data: { emailPendingChange: email, emailPendingChangeRequestedAt: new Date() },
  });

  // Send verification to the new address
  await sendVerificationEmail(session.user.id, "EMAIL_CHANGE", email);

  // Notify the old address (fire-and-forget — never fails the action)
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  console.log(
    `[Kontax] Notify old email ${user.email}: email change to ${email} requested. Reset: ${appUrl}/forgot-password`,
  );

  await db.activityEvent.create({
    data: {
      userId: session.user.id,
      eventType: "ACCOUNT_UPDATED",
      actor: "USER",
      payload: { field: "emailChangeRequested", newEmail: email },
    },
  });

  return { success: true };
}

export async function cancelEmailChange(): Promise<{ success: true }> {
  const session = await auth();
  if (!session?.user?.id) return { success: true };

  await db.user.update({
    where: { id: session.user.id },
    data: { emailPendingChange: null, emailPendingChangeRequestedAt: null },
  });

  await db.emailVerificationToken.updateMany({
    where: { userId: session.user.id, type: "EMAIL_CHANGE", usedAt: null },
    data: { usedAt: new Date() },
  });

  return { success: true };
}

// ─── Email Verification Resend (P18-04) ──────────────────────────────────────

export async function resendVerificationEmail(): Promise<
  { success: true } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  const rl = await checkRateLimit(rateLimiters.emailResend, `user:${session.user.id}`);
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  if (user?.emailVerified) return { error: "ALREADY_VERIFIED" };

  await sendVerificationEmail(session.user.id, "SIGNUP");
  return { success: true };
}
