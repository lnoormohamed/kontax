"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  createTotpSecret,
  decryptPayload,
  decryptTotp,
  encryptPayload,
  encryptTotp,
  generateTotpUri,
  verifyTotpToken,
} from "~/server/totp-crypto";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

// ── Enrolment ─────────────────────────────────────────────────────────────────

export async function startTotpEnrolment(): Promise<
  { qrCodeDataUri: string; plaintextSecret: string; pendingToken: string } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, emailVerified: true, email: true },
  });
  if (!user) return { error: "UNAUTHORIZED" };
  if (user.totpEnabled) return { error: "TOTP_ALREADY_ENABLED" };
  if (!user.emailVerified) return { error: "EMAIL_NOT_VERIFIED" };

  const secret = createTotpSecret();
  const totpUri = generateTotpUri(secret, user.email);
  const qrCodeDataUri = await QRCode.toDataURL(totpUri, { width: 196, margin: 1 });

  // Encrypt { secret, expiresAt } — client submits this as pendingToken
  const pendingToken = encryptPayload({
    secret,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  return { qrCodeDataUri, plaintextSecret: secret, pendingToken };
}

export async function confirmTotpEnrolment(input: {
  totpCode: string;
  pendingToken: string;
}): Promise<{ success: true; recoveryCodes: string[] } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  // Decrypt and validate the pending token
  let payload: { secret: string; expiresAt: number };
  try {
    payload = decryptPayload<{ secret: string; expiresAt: number }>(input.pendingToken);
  } catch {
    return { error: "INVALID_PENDING_TOKEN" };
  }
  if (Date.now() > payload.expiresAt) return { error: "PENDING_TOKEN_EXPIRED" };

  // Verify the submitted TOTP code
  if (!verifyTotpToken(payload.secret, input.totpCode)) {
    return { error: "INVALID_TOTP_CODE" };
  }

  // Generate 8 single-use recovery codes
  const recoveryCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(5).toString("base64url").toUpperCase().slice(0, 10),
  );
  const codeHashes = recoveryCodes.map((c) =>
    crypto.createHash("sha256").update(c).digest("hex"),
  );

  const encryptedSecret = encryptTotp(payload.secret);
  const userId = session.user.id;

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { totpEnabled: true, totpSecret: encryptedSecret, totpVerifiedAt: new Date() },
    }),
    db.totpRecoveryCode.deleteMany({ where: { userId } }),
    db.totpRecoveryCode.createMany({
      data: codeHashes.map((codeHash) => ({ userId, codeHash })),
    }),
  ]);

  await db.activityEvent.create({
    data: { userId, eventType: "ACCOUNT_UPDATED", actor: "USER", payload: { field: "totpEnabled" } },
  });

  return { success: true, recoveryCodes };
}

export async function regenerateRecoveryCodes(): Promise<
  { success: true; recoveryCodes: string[] } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true },
  });
  if (!user?.totpEnabled) return { error: "TOTP_NOT_ENABLED" };

  const recoveryCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(5).toString("base64url").toUpperCase().slice(0, 10),
  );
  const codeHashes = recoveryCodes.map((c) =>
    crypto.createHash("sha256").update(c).digest("hex"),
  );

  await db.$transaction([
    db.totpRecoveryCode.deleteMany({ where: { userId: session.user.id } }),
    db.totpRecoveryCode.createMany({
      data: codeHashes.map((codeHash) => ({ userId: session.user.id, codeHash })),
    }),
  ]);

  return { success: true, recoveryCodes };
}

// ── Login challenge ────────────────────────────────────────────────────────────

export async function submitTotpChallenge(
  code: string,
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };
  if (!session.pendingTotp) return { error: "NOT_PENDING_TOTP" };

  const rl = await checkRateLimit(rateLimiters.totpChallenge, `user:${session.user.id}`);
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) return { error: "TOTP_NOT_ENABLED" };

  const secret = decryptTotp(user.totpSecret);
  if (!verifyTotpToken(secret, code)) return { error: "INVALID_TOTP_CODE" };

  // Mark the UserSession as TOTP-verified so JWT callback clears pendingTotp
  if (session.jti) {
    await db.userSession.updateMany({
      where: { jti: session.jti, userId: session.user.id },
      data: { totpChallengeVerified: new Date() },
    });
  }

  return { success: true };
}

export async function redeemTotpRecoveryCode(
  code: string,
): Promise<{ success: true; remaining: number } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };
  if (!session.pendingTotp) return { error: "NOT_PENDING_TOTP" };

  const rl = await checkRateLimit(rateLimiters.totpRecovery, `user:${session.user.id}`);
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const codeHash = crypto.createHash("sha256").update(code.toUpperCase().trim()).digest("hex");

  const recoveryCode = await db.totpRecoveryCode.findFirst({
    where: { userId: session.user.id, codeHash, usedAt: null },
  });
  if (!recoveryCode) return { error: "INVALID_RECOVERY_CODE" };

  const [, remaining] = await Promise.all([
    db.totpRecoveryCode.update({ where: { id: recoveryCode.id }, data: { usedAt: new Date() } }),
    db.totpRecoveryCode.count({ where: { userId: session.user.id, usedAt: null } }).then((n) => n - 1),
  ]);

  // Mark UserSession as TOTP-verified
  if (session.jti) {
    await db.userSession.updateMany({
      where: { jti: session.jti, userId: session.user.id },
      data: { totpChallengeVerified: new Date() },
    });
  }

  return { success: true, remaining };
}

// ── Disable ────────────────────────────────────────────────────────────────────

export async function disableTotpAuth(input: {
  password: string;
  totpCode: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, totpEnabled: true, totpSecret: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) return { error: "TOTP_NOT_ENABLED" };

  const passwordOk = await bcrypt.compare(input.password, user.password);
  if (!passwordOk) return { error: "INCORRECT_PASSWORD" };

  const secret = decryptTotp(user.totpSecret);
  if (!verifyTotpToken(secret, input.totpCode)) return { error: "INVALID_TOTP_CODE" };

  await db.$transaction([
    db.user.update({
      where: { id: session.user.id },
      data: { totpEnabled: false, totpSecret: null, totpVerifiedAt: null },
    }),
    db.totpRecoveryCode.deleteMany({ where: { userId: session.user.id } }),
  ]);

  await db.activityEvent.create({
    data: {
      userId: session.user.id,
      eventType: "ACCOUNT_UPDATED",
      actor: "USER",
      payload: { field: "totpDisabled" },
    },
  });

  return { success: true };
}

// ── Status query (for settings page) ──────────────────────────────────────────

export async function getTotpStatus(): Promise<{
  enabled: boolean;
  verifiedAt: Date | null;
  remainingCodes: number;
}> {
  const session = await auth();
  if (!session?.user?.id) return { enabled: false, verifiedAt: null, remainingCodes: 0 };

  const [user, remaining] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { totpEnabled: true, totpVerifiedAt: true },
    }),
    db.totpRecoveryCode.count({
      where: { userId: session.user.id, usedAt: null },
    }),
  ]);

  return {
    enabled: user?.totpEnabled ?? false,
    verifiedAt: user?.totpVerifiedAt ?? null,
    remainingCodes: remaining,
  };
}
