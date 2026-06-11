"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { sendVerificationEmail } from "~/server/email-verification";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

// ─── Profile Edit (P18-01) ───────────────────────────────────────────────────

export async function updateProfile(input: {
  name: string;
  avatarUrl?: string | null;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  const name = input.name.trim();
  if (!name) return { error: "NAME_REQUIRED" };
  if (name.length > 120) return { error: "NAME_TOO_LONG" };

  // Validate avatarUrl: must be HTTPS or null
  if (input.avatarUrl) {
    try {
      const url = new URL(input.avatarUrl);
      if (url.protocol !== "https:") return { error: "AVATAR_URL_NOT_HTTPS" };
    } catch {
      return { error: "AVATAR_URL_INVALID" };
    }
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { name, avatarUrl: input.avatarUrl ?? null },
  });

  await db.activityEvent.create({
    data: {
      userId: session.user.id,
      eventType: "ACCOUNT_UPDATED",
      actor: "USER",
      payload: { field: "profile" },
    },
  });

  return { success: true };
}

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

// ─── Account Deletion (P18-09) ───────────────────────────────────────────────

export async function scheduleAccountDeletion(input: {
  confirmEmail: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return { error: "UNAUTHORIZED" };

  if (input.confirmEmail.trim().toLowerCase() !== session.user.email.toLowerCase()) {
    return { error: "EMAIL_MISMATCH" };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });

  // Check for owned groups
  const ownedGroup = await db.group.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (ownedGroup) return { error: "OWNS_ACTIVE_GROUP" };

  // TODO(P19): Cancel Stripe subscription here when Phase 19 ships
  console.warn(`[Kontax] Account deletion: Stripe cancellation stub for user ${session.user.id}`);

  // Convert accepted live shares to static copies
  await db.contactShare.updateMany({
    where: {
      ownerUserId: session.user.id,
      shareType: "LIVE_SYNC",
      status: "ACTIVE",
      recipientContactId: { not: null },
    },
    data: { shareType: "STATIC_COPY" },
  });
  // Revoke pending live shares not yet accepted
  await db.contactShare.updateMany({
    where: {
      ownerUserId: session.user.id,
      shareType: "LIVE_SYNC",
      status: "ACTIVE",
      recipientContactId: null,
    },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  const scheduledDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Lock account + set deletion date + invalidate all sessions
  await db.user.update({
    where: { id: session.user.id },
    data: {
      lifecycleState: "LOCKED",
      scheduledDeleteAt,
      sessionVersion: { increment: 1 },
    },
  });

  // Delete MinIO avatar (best effort)
  const avatarUrl = user?.avatarUrl;
  if (avatarUrl && process.env.MINIO_ENDPOINT && avatarUrl.includes(process.env.MINIO_ENDPOINT)) {
    import("@aws-sdk/client-s3").then(({ S3Client, DeleteObjectCommand }) => {
      const url = new URL(avatarUrl);
      const key = url.pathname.slice(1).split("/").slice(1).join("/"); // strip bucket from path
      const s3 = new S3Client({
        endpoint: process.env.MINIO_ENDPOINT,
        region: "us-east-1",
        credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY ?? "", secretAccessKey: process.env.MINIO_SECRET_KEY ?? "" },
        forcePathStyle: true,
      });
      return s3.send(new DeleteObjectCommand({ Bucket: process.env.MINIO_BUCKET ?? "kontax-uploads", Key: key }));
    }).catch((err: unknown) => console.warn("[Kontax] Avatar cleanup failed:", err));
  }

  await db.activityEvent.create({
    data: {
      userId: session.user.id,
      eventType: "ACCOUNT_UPDATED",
      actor: "USER",
      payload: { field: "accountDeletionScheduled", scheduledDeleteAt: scheduledDeleteAt.toISOString() },
    },
  });

  return { success: true };
}

export async function cancelAccountDeletion(): Promise<{ success: true }> {
  const session = await auth();
  if (!session?.user?.id) return { success: true };

  await db.user.update({
    where: { id: session.user.id },
    data: { lifecycleState: "ACTIVE", scheduledDeleteAt: null },
  });

  await db.activityEvent.create({
    data: {
      userId: session.user.id,
      eventType: "ACCOUNT_UPDATED",
      actor: "USER",
      payload: { field: "accountDeletionCancelled" },
    },
  });

  return { success: true };
}

// ─── Account info for delete confirmation dialog ─────────────────────────────

export async function getDeleteAccountInfo(): Promise<{
  email: string;
  contactCount: number;
}> {
  const session = await auth();
  if (!session?.user?.id) return { email: "", contactCount: 0 };

  const contactCount = await db.contact.count({
    where: { userId: session.user.id, archivedAt: null, syncTombstoneAt: null },
  });
  return { email: session.user.email ?? "", contactCount };
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
