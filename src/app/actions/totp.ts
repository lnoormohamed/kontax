"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";

import { authIncludingPendingTotp } from "~/server/auth";
import { isSessionError, requireSession } from "~/server/auth/require-session";
import { verifyStepUpPassword } from "~/server/auth/step-up";
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
import {
  findMatchingRecoveryCode,
  isLegacyRecoveryCodeHash,
  newRecoveryCodeSet,
} from "~/server/totp-recovery-codes";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

// P49A-13: recovery codes are 16 base32 characters, stored as salted scrypt;
// see src/server/totp-recovery-codes.ts (older 10-hex codes still redeem).

/**
 * P49A-13: what a pending-enrolment token carries. `userId` binds it to the
 * account whose password was just verified — `startTotpEnrolment` only mints
 * one after the step-up — so confirming needs no second password prompt, and a
 * token minted before this change (no `userId`) is refused: the user restarts.
 */
type PendingEnrolment = { secret: string; expiresAt: number; userId?: string };

type StepUpFailure = "STEP_UP_REQUIRED" | "WRONG_PASSWORD" | "RATE_LIMIT_EXCEEDED";

// ── Enrolment ─────────────────────────────────────────────────────────────────

/**
 * P49A-13 (A-28): turning 2FA on replaces the account's second factor and mints
 * recovery codes — from a hijacked session that would let an attacker lock the
 * owner out — so it takes a server-verified password step-up. OAuth-only
 * accounts have no password to prove (the `verifyStepUpPassword` convention).
 */
export async function startTotpEnrolment(input: { currentPassword?: string } = {}): Promise<
  { qrCodeDataUri: string; plaintextSecret: string; pendingToken: string } | { error: string }
> {
  let session: Awaited<ReturnType<typeof requireSession>>;
  try {
    session = await requireSession({ write: true });
  } catch (err) {
    if (isSessionError(err)) return { error: err.code === "UNAUTHENTICATED" ? "UNAUTHORIZED" : err.code };
    throw err;
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, emailVerified: true, email: true, password: true },
  });
  if (!user) return { error: "UNAUTHORIZED" };
  if (user.totpEnabled) return { error: "TOTP_ALREADY_ENABLED" };
  if (!user.emailVerified) return { error: "EMAIL_NOT_VERIFIED" };

  const stepUp = await verifyStepUpPassword(session.user.id, user.password, input.currentPassword);
  if (stepUp !== "OK") return { error: stepUp satisfies StepUpFailure };

  const secret = createTotpSecret();
  const totpUri = generateTotpUri(secret, user.email);
  const qrCodeDataUri = await QRCode.toDataURL(totpUri, { width: 196, margin: 1 });

  // Encrypt { secret, expiresAt, userId } — client submits this as pendingToken
  const pendingToken = encryptPayload({
    secret,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    userId: session.user.id,
  } satisfies PendingEnrolment);

  return { qrCodeDataUri, plaintextSecret: secret, pendingToken };
}

export async function confirmTotpEnrolment(input: {
  totpCode: string;
  pendingToken: string;
}): Promise<{ success: true; recoveryCodes: string[] } | { error: string }> {
  let session: Awaited<ReturnType<typeof requireSession>>;
  try {
    session = await requireSession({ write: true });
  } catch (err) {
    if (isSessionError(err)) return { error: err.code === "UNAUTHENTICATED" ? "UNAUTHORIZED" : err.code };
    throw err;
  }

  // P48-03: enrolment verifies a TOTP code, so it is a guessable-code endpoint
  // like the login challenge and gets the same bucket.
  const rl = await checkRateLimit(rateLimiters.totpChallenge, `enrol:${session.user.id}`);
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  // Decrypt and validate the pending token
  let payload: PendingEnrolment;
  try {
    payload = decryptPayload<PendingEnrolment>(input.pendingToken);
  } catch {
    return { error: "INVALID_PENDING_TOKEN" };
  }
  // P49A-13: only a token minted — after the step-up — for this same account.
  if (payload.userId !== session.user.id) return { error: "INVALID_PENDING_TOKEN" };
  if (Date.now() > payload.expiresAt) return { error: "PENDING_TOKEN_EXPIRED" };

  // Verify the submitted TOTP code
  if (!verifyTotpToken(payload.secret, input.totpCode)) {
    return { error: "INVALID_TOTP_CODE" };
  }

  const { codes: recoveryCodes, hashes: codeHashes } = await newRecoveryCodeSet();

  const encryptedSecret = encryptTotp(payload.secret);
  const userId = session.user.id;

  // P49A-19: enable only if 2FA is still off. A pending token stays valid for
  // ten minutes, so a double submit, a second tab, or a replayed request could
  // otherwise confirm again after 2FA is on and silently replace the secret and
  // the recovery codes the user has just been shown and saved.
  const enabled = await db.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { id: userId, totpEnabled: false },
      data: { totpEnabled: true, totpSecret: encryptedSecret, totpVerifiedAt: new Date(), lastTotpCounter: null },
    });
    if (claimed.count === 0) return false;
    await tx.totpRecoveryCode.deleteMany({ where: { userId } });
    await tx.totpRecoveryCode.createMany({
      data: codeHashes.map((codeHash) => ({ userId, codeHash })),
    });
    return true;
  });
  if (!enabled) return { error: "TOTP_ALREADY_ENABLED" };

  await db.activityEvent.create({
    data: { userId, eventType: "ACCOUNT_UPDATED", actor: "USER", payload: { field: "totpEnabled" } },
  });

  return { success: true, recoveryCodes };
}

/**
 * P49A-13 (A-28): new recovery codes invalidate the old set and are a way back
 * into the account, so regenerating takes the password (step-up) *and* a
 * second factor: a current authenticator code, or one of the user's unused
 * recovery codes (for someone who lost their phone — see below). Guesses are
 * rate-limited like the login challenge, and a TOTP code claims its 30-second
 * step, so it can't be replayed.
 */
export async function regenerateRecoveryCodes(input: {
  currentPassword?: string;
  totpCode?: string;
} = {}): Promise<{ success: true; recoveryCodes: string[] } | { error: string }> {
  let session: Awaited<ReturnType<typeof requireSession>>;
  try {
    session = await requireSession({ write: true });
  } catch (err) {
    if (isSessionError(err)) return { error: err.code === "UNAUTHENTICATED" ? "UNAUTHORIZED" : err.code };
    throw err;
  }

  const userId = session.user.id;

  const rl = await checkRateLimit(rateLimiters.totpChallenge, `regen:${userId}`);
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true, totpSecret: true, password: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) return { error: "TOTP_NOT_ENABLED" };

  const stepUp = await verifyStepUpPassword(userId, user.password, input.currentPassword);
  if (stepUp !== "OK") return { error: stepUp satisfies StepUpFailure };

  const secondFactor = typeof input.totpCode === "string" ? input.totpCode.trim() : "";
  if (!secondFactor) return { error: "TOTP_CODE_REQUIRED" };

  if (/^\d{6}$/.test(secondFactor)) {
    if (!verifyTotpToken(decryptTotp(user.totpSecret), secondFactor)) return { error: "INVALID_TOTP_CODE" };

    // Replay guard, as in submitTotpChallenge.
    const counter = Math.floor(Date.now() / 30_000);
    const claimedStep = await db.user.updateMany({
      where: { id: userId, OR: [{ lastTotpCounter: null }, { lastTotpCounter: { lt: counter } }] },
      data: { lastTotpCounter: counter },
    });
    if (claimedStep.count === 0) return { error: "TOTP_CODE_ALREADY_USED" };
  } else {
    // An unused recovery code also proves the second factor. Someone who lost
    // their phone signs in with a recovery code and must then be able to get a
    // fresh set — the help centre tells them to — without an authenticator
    // code they no longer have. The code is used up with the rest of the set,
    // which the transaction below replaces.
    const unused = await db.totpRecoveryCode.findMany({
      where: { userId, usedAt: null },
      select: { id: true, codeHash: true },
    });
    if (!(await findMatchingRecoveryCode(secondFactor, unused))) return { error: "INVALID_TOTP_CODE" };
  }

  // P49A-19: the codes returned below are the ones whose hashes are stored —
  // both come from the same `newRecoveryCodeSet()` call. The old set is deleted
  // in the same transaction that stores the new one, so a failure anywhere
  // rolls back and the old codes keep working. The settings UI must show the
  // returned codes (it used to throw them away — the P49A-19 bug).
  const { codes: recoveryCodes, hashes: codeHashes } = await newRecoveryCodeSet();

  try {
    await db.$transaction(async (tx) => {
      await tx.totpRecoveryCode.deleteMany({ where: { userId } });
      const created = await tx.totpRecoveryCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      });
      if (created.count !== codeHashes.length) {
        throw new Error(`stored ${created.count} of ${codeHashes.length} recovery codes`);
      }
    });
  } catch (err) {
    console.error("[regenerateRecoveryCodes] failed; existing codes left unchanged", { userId }, err);
    return { error: "REGENERATE_FAILED" };
  }

  await db.activityEvent.create({
    data: { userId, eventType: "ACCOUNT_UPDATED", actor: "USER", payload: { field: "totpRecoveryCodesRegenerated" } },
  });

  return { success: true, recoveryCodes };
}

// ── Login challenge ────────────────────────────────────────────────────────────

export async function submitTotpChallenge(
  code: string,
): Promise<{ success: true } | { error: string }> {
  const session = await authIncludingPendingTotp();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };
  if (session.impersonatedBy) return { error: "IMPERSONATION_READ_ONLY" };
  if (!session.pendingTotp) return { error: "NOT_PENDING_TOTP" };

  const rl = await checkRateLimit(rateLimiters.totpChallenge, `user:${session.user.id}`);
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true, lastTotpCounter: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) return { error: "TOTP_NOT_ENABLED" };

  const secret = decryptTotp(user.totpSecret);
  if (!verifyTotpToken(secret, code)) return { error: "INVALID_TOTP_CODE" };

  // P48-03: replay guard. A TOTP code is valid for its whole 30s step, so a
  // code captured in transit (shoulder-surfed, phished, read off a proxy) can
  // be used again inside the same window. Record the step and refuse anything
  // at or below it — the legitimate user just waits for the next code.
  const counter = Math.floor(Date.now() / 30_000);
  const claimed = await db.user.updateMany({
    where: {
      id: session.user.id,
      OR: [{ lastTotpCounter: null }, { lastTotpCounter: { lt: counter } }],
    },
    data: { lastTotpCounter: counter },
  });
  if (claimed.count === 0) return { error: "TOTP_CODE_ALREADY_USED" };

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
  const session = await authIncludingPendingTotp();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };
  if (session.impersonatedBy) return { error: "IMPERSONATION_READ_ONLY" };
  if (!session.pendingTotp) return { error: "NOT_PENDING_TOTP" };

  const rl = await checkRateLimit(rateLimiters.totpRecovery, `user:${session.user.id}`);
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

  // P49A-13: codes are salted now, so the lookup can't be by hash — load the
  // (at most eight) unused codes and compare in constant time.
  const unused = await db.totpRecoveryCode.findMany({
    where: { userId: session.user.id, usedAt: null },
    select: { id: true, codeHash: true },
  });
  const matchId = await findMatchingRecoveryCode(typeof code === "string" ? code : "", unused);
  if (!matchId) return { error: "INVALID_RECOVERY_CODE" };

  // P49A-19: single use, atomically. The claim only succeeds while `usedAt` is
  // still null, so two concurrent redemptions of the same code cannot both pass
  // (the old `update({ where: { id } })` let both through).
  const claimed = await db.totpRecoveryCode.updateMany({
    where: { id: matchId, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return { error: "INVALID_RECOVERY_CODE" };

  const remaining = await db.totpRecoveryCode.count({
    where: { userId: session.user.id, usedAt: null },
  });

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
  let session: Awaited<ReturnType<typeof requireSession>>;
  try {
    session = await requireSession({ write: true });
  } catch (err) {
    if (isSessionError(err)) return { error: err.code === "UNAUTHENTICATED" ? "UNAUTHORIZED" : err.code };
    throw err;
  }

  // P48-03: turning 2FA OFF takes both a password and a TOTP code, so it was
  // the one unmetered endpoint where either could be brute-forced.
  const rl = await checkRateLimit(rateLimiters.totpChallenge, `disable:${session.user.id}`);
  if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };

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
      data: { totpEnabled: false, totpSecret: null, totpVerifiedAt: null, lastTotpCounter: null },
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
  /** P49A-13: some unused codes are the older, weaker 10-character kind. */
  hasLegacyCodes: boolean;
}> {
  const session = await requireSession().catch(() => null);
  if (!session?.user?.id) return { enabled: false, verifiedAt: null, remainingCodes: 0, hasLegacyCodes: false };

  const [user, unused] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { totpEnabled: true, totpVerifiedAt: true },
    }),
    db.totpRecoveryCode.findMany({
      where: { userId: session.user.id, usedAt: null },
      select: { codeHash: true },
    }),
  ]);

  return {
    enabled: user?.totpEnabled ?? false,
    verifiedAt: user?.totpVerifiedAt ?? null,
    remainingCodes: unused.length,
    hasLegacyCodes: unused.some((row) => isLegacyRecoveryCodeHash(row.codeHash)),
  };
}
