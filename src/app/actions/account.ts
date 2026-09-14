"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { sendAccountDeletionScheduledEmail } from "~/server/billing-emails";
import { auth } from "~/server/auth";
import { verifyStepUpPassword } from "~/server/auth/step-up";
import {
  EMAIL_CHANGE_REVERT_HOURS,
  REVERT_FIELDS_CLEARED,
  sendEmailChangeNotice,
} from "~/server/email-change-revert";
import { invalidateSessionValidation } from "~/server/session-validation-cache";
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
  if (session.impersonatedBy) return { error: "IMPERSONATION_READ_ONLY" };

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
  if (session.impersonatedBy) return { error: "IMPERSONATION_READ_ONLY" };

  const rl = await checkRateLimit(
    rateLimiters.passwordChange,
    `user:${session.user.id}`,
  );
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, sessionVersion: true },
  });
  if (!user) return { error: "UNAUTHORIZED" };

  const currentMatches = await bcrypt.compare(
    input.currentPassword,
    user.password,
  );
  if (!currentMatches) return { error: "CURRENT_PASSWORD_INCORRECT" };

  if (input.newPassword.length < 8) return { error: "PASSWORD_TOO_SHORT" };
  if (input.newPassword === input.currentPassword)
    return { error: "PASSWORD_SAME_AS_CURRENT" };

  const newHash = await bcrypt.hash(input.newPassword, 12);

  await db.user.update({
    where: { id: session.user.id },
    data: { password: newHash, sessionVersion: { increment: 1 } },
  });
  // P38-09: the sessionVersion bump must beat the 45s validation cache
  await invalidateSessionValidation(session.user.id);

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

export async function requestEmailChange(input: {
  newEmail: string;
  currentPassword: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };
  if (session.impersonatedBy) return { error: "IMPERSONATION_READ_ONLY" };

  const parsed = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254)
    .safeParse(input.newEmail);
  if (!parsed.success) return { error: "INVALID_EMAIL" };
  const email = parsed.data;

  const rl = await checkRateLimit(
    rateLimiters.emailResend,
    `email-change:${session.user.id}`,
  );
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, password: true },
  });
  if (!user) return { error: "UNAUTHORIZED" };

  // Step-up: require current password before allowing an email change.
  if (!user.password) return { error: "NO_PASSWORD_SET" };
  const passwordOk = await bcrypt.compare(input.currentPassword, user.password);
  if (!passwordOk) return { error: "WRONG_PASSWORD" };

  if (email === user.email) return { error: "EMAIL_SAME_AS_CURRENT" };

  const conflict = await db.user.findFirst({
    where: { email, NOT: { id: session.user.id } },
  });
  if (conflict) return { error: "EMAIL_ALREADY_IN_USE" };

  // P48-03: mint the single-use "this wasn't me" token now, so the notice below
  // carries a real escape hatch. Only the SHA-256 hash is stored.
  const revertToken = crypto.randomBytes(32).toString("hex");
  const revertTokenHash = crypto.createHash("sha256").update(revertToken).digest("hex");
  const requestedAt = new Date();

  await db.user.update({
    where: { id: session.user.id },
    data: {
      emailPendingChange: email,
      emailPendingChangeRequestedAt: requestedAt,
      emailChangeRevertTokenHash: revertTokenHash,
      emailChangeRevertExpiresAt: new Date(
        requestedAt.getTime() + EMAIL_CHANGE_REVERT_HOURS * 60 * 60 * 1000,
      ),
      // Remembered so the link can restore the address even if the change has
      // already been confirmed by the time the real owner reads this email.
      emailPreviousAddress: user.email,
    },
  });

  // Send verification to the new address
  await sendVerificationEmail(session.user.id, "EMAIL_CHANGE", email);

  // P48-03: tell the OLD address. This used to be a console.log, so a hijacked
  // session could walk the account to an attacker's address in silence.
  // Fire-and-forget — a slow or failing send must not fail the request, and the
  // user can still cancel from Settings.
  void sendEmailChangeNotice({
    to: user.email,
    newEmail: email,
    requestedAt,
    revertToken,
  });

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

// Resend the verification email for an already-pending email change.
// Password not required — authorization happened when the change was first requested.
export async function resendPendingEmailChange(): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  const rl = await checkRateLimit(
    rateLimiters.emailResend,
    `email-change-resend:${session.user.id}`,
  );
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { emailPendingChange: true },
  });
  if (!user?.emailPendingChange) return { error: "NO_PENDING_CHANGE" };

  await sendVerificationEmail(session.user.id, "EMAIL_CHANGE", user.emailPendingChange);
  return { success: true };
}

export async function cancelEmailChange(): Promise<{ success: true }> {
  const session = await auth();
  if (!session?.user?.id) return { success: true };

  await db.user.update({
    where: { id: session.user.id },
    data: {
      emailPendingChange: null,
      emailPendingChangeRequestedAt: null,
      // P48-03: the revert link exists only for a live change — retire it here
      // too, so a cancelled-and-re-requested change never has two valid tokens.
      ...REVERT_FIELDS_CLEARED,
    },
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
  /**
   * P48-02: real, server-verified step-up. `confirmEmail` only proves the
   * caller can read the session, which a hijacked cookie can do too.
   */
  currentPassword: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email)
    return { error: "UNAUTHORIZED" };
  if (session.impersonatedBy) return { error: "IMPERSONATION_READ_ONLY" };
  // Already pending: nothing to schedule, and the grace period is read-only.
  if (session.pendingDeletion) return { error: "ALREADY_PENDING_DELETION" };

  if (
    input.confirmEmail.trim().toLowerCase() !== session.user.email.toLowerCase()
  ) {
    return { error: "EMAIL_MISMATCH" };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true, password: true },
  });
  if (!user) return { error: "UNAUTHORIZED" };

  // P48-02: step-up is enforced here, not in the modal. Rate-limited on the
  // same bucket as the standalone step-up so it can't be used as a password
  // oracle.
  const stepUp = await verifyStepUpPassword(session.user.id, user.password, input.currentPassword);
  if (stepUp !== "OK") return { error: stepUp };

  // Check for owned groups
  const ownedGroup = await db.group.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (ownedGroup) return { error: "OWNS_ACTIVE_GROUP" };

  // TODO(P19): Cancel Stripe subscription here when Phase 19 ships
  console.warn(
    `[Kontax] Account deletion: Stripe cancellation stub for user ${session.user.id}`,
  );

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

  // P48-02: the account stays ACTIVE — `scheduledDeleteAt` alone marks the
  // user-initiated grace period. LOCKED is reserved for admin suspension, and
  // `authorize` refuses LOCKED sign-ins, which is exactly what stopped users
  // from ever reaching the "cancel deletion" screen the UI promised them.
  // The sessionVersion bump still terminates every existing session; signing
  // back in mints a `pendingDeletion` token that can read and cancel only.
  await db.user.update({
    where: { id: session.user.id },
    data: {
      lifecycleState: "ACTIVE",
      scheduledDeleteAt,
      sessionVersion: { increment: 1 },
    },
  });
  // P38-09: the sessionVersion bump must beat the 45s validation cache
  await invalidateSessionValidation(session.user.id);

  // Delete MinIO avatar (best effort)
  const avatarUrl = user?.avatarUrl;
  if (
    avatarUrl &&
    process.env.MINIO_ENDPOINT &&
    avatarUrl.includes(process.env.MINIO_ENDPOINT)
  ) {
    import("@aws-sdk/client-s3")
      .then(({ S3Client, DeleteObjectCommand }) => {
        const url = new URL(avatarUrl);
        const key = url.pathname.slice(1).split("/").slice(1).join("/"); // strip bucket from path
        const s3 = new S3Client({
          endpoint: process.env.MINIO_ENDPOINT,
          region: "us-east-1",
          credentials: {
            accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
            secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
          },
          forcePathStyle: true,
        });
        return s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.MINIO_BUCKET ?? "kontax-uploads",
            Key: key,
          }),
        );
      })
      .catch((err: unknown) =>
        console.warn("[Kontax] Avatar cleanup failed:", err),
      );
  }

  await db.activityEvent.create({
    data: {
      userId: session.user.id,
      eventType: "ACCOUNT_UPDATED",
      actor: "USER",
      payload: {
        field: "accountDeletionScheduled",
        scheduledDeleteAt: scheduledDeleteAt.toISOString(),
      },
    },
  });

  // Confirm the 30-day deletion countdown by email (P20-08). Fire-and-forget —
  // a slow send must not block the deletion request.
  void sendAccountDeletionScheduledEmail({
    userId: session.user.id,
    scheduledDeleteAt,
  });

  return { success: true };
}

/**
 * P48-02: the ONE write a pending-deletion session is allowed to make.
 *
 * It deliberately calls `auth()` directly rather than
 * `requireSession({ write: true })` — that helper throws PENDING_DELETION,
 * which is the whole point everywhere else. Reads stay allowed during the grace
 * period so the user can export their data before it goes.
 */
export async function cancelAccountDeletion(): Promise<{ success: true }> {
  const session = await auth();
  if (!session?.user?.id) return { success: true };
  if (session.impersonatedBy) return { success: true };

  await db.user.update({
    where: { id: session.user.id },
    data: { lifecycleState: "ACTIVE", scheduledDeleteAt: null },
  });
  // The cached snapshot carries `scheduledDeleteAt`; drop it so the very next
  // request rebuilds the token without `pendingDeletion` instead of waiting out
  // the 45s TTL.
  await invalidateSessionValidation(session.user.id);

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

// ─── Step-up password verification (P31-02) ──────────────────────────────────

// Called by the ConfirmPasswordModal before executing any sensitive action.
// OAuth-only users (no password hash) are automatically verified — their active
// session is the step-up signal.
export async function verifyPasswordForStepUp(
  password: string,
): Promise<{ ok: true } | { ok: false; error: "INCORRECT_PASSWORD" | "RATE_LIMITED" | "NOT_AUTHENTICATED" }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "NOT_AUTHENTICATED" };

  const rl = await checkRateLimit(rateLimiters.stepUpVerify, `user:${session.user.id}`);
  if (!rl.allowed) return { ok: false, error: "RATE_LIMITED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  // OAuth-only account: no password set — treat active session as verified.
  if (!user?.password) return { ok: true };

  const matches = await bcrypt.compare(password, user.password);
  return matches ? { ok: true } : { ok: false, error: "INCORRECT_PASSWORD" };
}

// ─── Account info for delete confirmation dialog ─────────────────────────────

export async function getDeleteAccountInfo(): Promise<{
  email: string;
  contactCount: number;
  hasPassword: boolean;
}> {
  const session = await auth();
  if (!session?.user?.id) return { email: "", contactCount: 0, hasPassword: false };

  const [contactCount, user] = await Promise.all([
    db.contact.count({
      where: { userId: session.user.id, archivedAt: null, syncTombstoneAt: null },
    }),
    db.user.findUnique({ where: { id: session.user.id }, select: { password: true } }),
  ]);
  return { email: session.user.email ?? "", contactCount, hasPassword: !!user?.password };
}

// ─── Email Verification Resend (P18-04) ──────────────────────────────────────

export async function resendVerificationEmail(): Promise<
  { success: true } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };
  if (session.impersonatedBy) return { error: "IMPERSONATION_READ_ONLY" };

  const rl = await checkRateLimit(
    rateLimiters.emailResend,
    `user:${session.user.id}`,
  );
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  if (user?.emailVerified) return { error: "ALREADY_VERIFIED" };

  await sendVerificationEmail(session.user.id, "SIGNUP");
  return { success: true };
}
