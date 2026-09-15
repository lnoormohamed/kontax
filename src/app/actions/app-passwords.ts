"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  formatAppPasswordToken,
  generateAppPasswordToken,
  hashAppPassword,
  listUserAppPasswords,
  revokeUserAppPassword,
} from "~/server/app-passwords";
import { requireUserId } from "~/server/auth/require-session";
import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";

const createAppPasswordSchema = z.object({
  label: z.string().trim().min(1, "Label is required.").max(64, "Label must be 64 characters or fewer."),
});

const revokeAppPasswordSchema = z.object({
  appPasswordId: z.string().trim().min(1, "App password id is required."),
});

export const createAppPassword = async (_previousState: unknown, formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const parsed = createAppPasswordSchema.safeParse({
    label: formData.get("label"),
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid app password label.",
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
  constructor(
    public current: number,
    public limit: number | null,
  ) {
    super("App password limit reached.");
  }
}

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
