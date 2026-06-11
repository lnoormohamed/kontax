import crypto from "crypto";

import type { EmailVerificationTokenType } from "../../generated/prisma";
import VerifyEmail from "~/emails/verify-email";
import { db } from "~/server/db";
import { sendEmail } from "~/server/email";
import { renderEmail } from "~/server/render-email";

const EXPIRY_HOURS: Record<EmailVerificationTokenType, number> = {
  SIGNUP: 72,
  EMAIL_CHANGE: 24,
};

export function generateVerificationToken(): {
  plaintext: string;
  hash: string;
} {
  const plaintext = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

export async function sendVerificationEmail(
  userId: string,
  type: EmailVerificationTokenType,
  targetEmail?: string,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const email = targetEmail ?? user.email;

  // Invalidate any previous unused tokens of the same type for this user
  await db.emailVerificationToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { plaintext, hash } = generateVerificationToken();
  const expiresAt = new Date(
    Date.now() + (EXPIRY_HOURS[type] ?? 72) * 60 * 60 * 1000,
  );

  await db.emailVerificationToken.create({
    data: { userId, type, tokenHash: hash, targetEmail: email, expiresAt },
  });

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${plaintext}`;

  // Surface the link in local dev so the flow can be exercised without SES.
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `\n[Kontax] Email verification link (${type}):\n${verifyUrl}\n`,
    );
  }

  const isChange = type === "EMAIL_CHANGE";
  const subject = isChange
    ? "Confirm your new Kontax email address"
    : "Confirm your Kontax email address";

  const { html, text } = await renderEmail(
    VerifyEmail({
      variant: isChange ? "email-change" : "signup",
      verifyUrl,
      expiresHours: EXPIRY_HOURS[type] ?? 72,
    }),
  );

  await sendEmail({ to: email, subject, html, text });
}

/**
 * Called by verifyEmailToken when an EMAIL_CHANGE token is consumed.
 * Atomically swaps User.email, clears pending state, and increments sessionVersion
 * so all existing sessions are invalidated (user must re-login with new email).
 */
export async function activateEmailChange(
  userId: string,
  newEmail: string,
): Promise<void> {
  // Race-condition guard: re-check uniqueness before final write
  const conflict = await db.user.findFirst({
    where: { email: newEmail, NOT: { id: userId } },
  });
  if (conflict) throw new Error("EMAIL_ALREADY_IN_USE");

  await db.user.update({
    where: { id: userId },
    data: {
      email: newEmail,
      emailVerified: new Date(),
      emailPendingChange: null,
      emailPendingChangeRequestedAt: null,
      sessionVersion: { increment: 1 },
    },
  });

  await db.activityEvent.create({
    data: {
      userId,
      eventType: "ACCOUNT_UPDATED",
      actor: "USER",
      payload: { field: "email", newEmail },
    },
  });
}

export async function verifyEmailToken(
  plaintextToken: string,
): Promise<
  { success: true; type: EmailVerificationTokenType } | { error: string }
> {
  const hash = crypto.createHash("sha256").update(plaintextToken).digest("hex");

  const token = await db.emailVerificationToken.findUnique({
    where: { tokenHash: hash },
  });

  if (!token || token.usedAt) return { error: "TOKEN_INVALID" };
  if (token.expiresAt < new Date()) return { error: "TOKEN_EXPIRED" };

  await db.$transaction(async (tx) => {
    if (token.type === "SIGNUP") {
      await tx.user.updateMany({
        where: { id: token.userId, emailVerified: null },
        data: { emailVerified: new Date() },
      });
    }
    await tx.emailVerificationToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
  });

  if (token.type === "EMAIL_CHANGE") {
    await activateEmailChange(token.userId, token.targetEmail);
  } else {
    await db.activityEvent.create({
      data: {
        userId: token.userId,
        eventType: "ACCOUNT_UPDATED",
        actor: "USER",
        payload: { field: "emailVerified" },
      },
    });
  }

  return { success: true, type: token.type };
}
