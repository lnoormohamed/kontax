"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  invalidateDavCredentialCacheForUser,
  formatAppPasswordToken,
  generateAppPasswordToken,
  hashAppPassword,
  listUserAppPasswords,
  revokeUserAppPassword,
} from "~/server/app-passwords";
import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { verifyStepUpPassword } from "~/server/auth/step-up";
import { getUserBillingContext } from "~/server/billing";
import { revokeAllAppPasswords } from "~/server/credential-revocation";
import { db } from "~/server/db";

const createAppPasswordSchema = z.object({
  label: z.string().trim().min(1, "Label is required.").max(64, "Label must be 64 characters or fewer."),
  // P48 review: minting a CardDAV credential is a sensitive action — the
  // password is verified here, not in a client-side modal.
  currentPassword: z.string().max(500).optional(),
});

const revokeAppPasswordSchema = z.object({
  appPasswordId: z.string().trim().min(1, "App password id is required."),
});

export const createAppPassword = async (_previousState: unknown, formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const parsed = createAppPasswordSchema.safeParse({
    label: formData.get("label"),
    currentPassword: formData.get("currentPassword") ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid app password label.",
    };
  }

  const owner = await db.user.findUnique({ where: { id: userId }, select: { password: true } });
  const stepUp = await verifyStepUpPassword(userId, owner?.password, parsed.data.currentPassword);
  if (stepUp !== "OK") {
    return {
      ok: false as const,
      error:
        stepUp === "STEP_UP_REQUIRED"
          ? "STEP_UP_REQUIRED"
          : stepUp === "RATE_LIMIT_EXCEEDED"
            ? "Too many attempts. Try again in an hour."
            : "Incorrect password.",
    };
  }

  // P48-17: canCreateAppPassword() + createUserAppPassword() (server/app-passwords.ts)
  // used to run as two separate round-trips — a classic check-then-act race
  // that let two concurrent requests both read "under the cap" and both
  // insert. Fixed here (rather than in that shared module, which also backs
  // the CardDAV auth hot path) by locking the user row first — a concurrent
  // create for the same user then blocks until this transaction commits —
  // and redoing the count check + insert inside the same transaction, using
  // `tx` throughout so the count read sees the lock-holder's own prior writes.
  const billing = await getUserBillingContext(userId);
  const limit = billing.entitlements.appPasswordsLimit;

  try {
    const created = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

      const activeCountResult = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*)::bigint AS count FROM "AppPassword" WHERE "userId" = $1 AND "revokedAt" IS NULL',
        userId,
      );
      const current = Number(activeCountResult[0]?.count ?? 0n);
      if (limit != null && current >= limit) {
        throw new AppPasswordLimitError(current, limit);
      }

      const token = generateAppPasswordToken();
      const hashedPassword = await hashAppPassword(token);
      const trimmedLabel = parsed.data.label.trim();

      const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        'INSERT INTO "AppPassword" ("id", "userId", "label", "hashedPassword", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING "id"',
        crypto.randomUUID(),
        userId,
        trimmedLabel,
        hashedPassword,
      );

      return { id: rows[0]!.id, token, formattedToken: formatAppPasswordToken(token) };
    });

    revalidatePath("/settings");

    return {
      ok: true as const,
      appPasswordId: created.id,
      token: created.token,
      formattedToken: created.formattedToken,
    };
  } catch (error) {
    if (error instanceof AppPasswordLimitError) {
      return {
        ok: false as const,
        error:
          error.limit == null
            ? "You cannot create another app password right now."
            : `App password limit reached (${error.current}/${error.limit}).`,
      };
    }
    throw error;
  }
};

class AppPasswordLimitError extends Error {
  // Plain fields, not parameter properties: node's strip-types test runner
  // can't load those, and the tests import this module.
  readonly current: number;
  readonly limit: number | null;
  constructor(current: number, limit: number | null) {
    super("App password limit reached.");
    this.current = current;
    this.limit = limit;
  }
}

/**
 * P49A-13 (Fable review): "Sign out all devices" — revoke every live CardDAV
 * app password at once, offered after a password change (which, unlike a
 * reset, keeps devices working). No step-up: it only takes access away, and
 * the person who needs it most is the owner of a possibly hijacked account.
 */
export const signOutAllDevices = async (): Promise<{ ok: true; revoked: number } | { ok: false; error: string }> => {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) return { ok: false, error: "UNAUTHORIZED" };
    throw err;
  }
  const revoked = await revokeAllAppPasswords(db, userId);
  // Also on 0: a cached verification must not outlive a row revoked elsewhere.
  await invalidateDavCredentialCacheForUser(userId);
  if (revoked > 0) {
    await db.activityEvent.create({
      data: { userId, eventType: "ACCOUNT_UPDATED", actor: "USER", payload: { field: "appPasswordsRevokedAll", revoked } },
    });
  }
  revalidatePath("/settings");
  return { ok: true, revoked };
};

export const getAppPasswords = async () => {
  const userId = await requireUserId();
  return listUserAppPasswords(userId);
};

export const revokeAppPassword = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const parsed = revokeAppPasswordSchema.safeParse({
    appPasswordId: formData.get("appPasswordId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid app password id.");
  }

  const revoked = await revokeUserAppPassword(userId, parsed.data.appPasswordId);

  if (!revoked) {
    throw new Error("App password not found.");
  }

  revalidatePath("/settings");
};
