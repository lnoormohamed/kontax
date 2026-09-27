"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { generateApiToken } from "~/server/api-tokens";
import { getUserBillingContext } from "~/server/billing";
import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { verifyStepUpPassword } from "~/server/auth/step-up";
import { db } from "~/server/db";

const createApiTokenSchema = z.object({
  name: z.string().trim().min(1, "NAME_REQUIRED").max(64, "NAME_TOO_LONG"),
  scope: z.enum(["READ_ONLY", "READ_WRITE"]),
  currentPassword: z.string().max(500).optional(),
});

export type CreateApiTokenError =
  | "UNAUTHORIZED"
  | "UPGRADE_REQUIRED"
  | "NAME_REQUIRED"
  | "NAME_TOO_LONG"
  | "NAME_TAKEN"
  | "INVALID_INPUT"
  | "STEP_UP_REQUIRED"
  | "WRONG_PASSWORD"
  | "RATE_LIMIT_EXCEEDED"
  | "PASSWORD_NOT_SET";

/**
 * P49A-13 (A-28): an API token is durable access that outlives the browser
 * session that minted it, so creating one takes a server-verified step-up —
 * the same `verifyStepUpPassword` check as app passwords and data export. A
 * hijacked session can no longer mint itself a token that survives sign-out.
 * An account with no password is refused (PASSWORD_NOT_SET) — the helper
 * fails closed unless a caller opts in to passwordless step-up.
 *
 * Returns a result instead of throwing: Next.js redacts thrown server-action
 * messages in production, so the old `throw new Error("NAME_REQUIRED")` codes
 * never reached the form there.
 */
export async function createApiToken(input: {
  name: string;
  scope: "READ_ONLY" | "READ_WRITE";
  currentPassword?: string;
}): Promise<{ ok: true; token: string; id: string } | { ok: false; error: CreateApiTokenError }> {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) return { ok: false, error: "UNAUTHORIZED" };
    throw err;
  }

  const parsed = createApiTokenSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return {
      ok: false,
      error: message === "NAME_REQUIRED" || message === "NAME_TOO_LONG" ? message : "INVALID_INPUT",
    };
  }

  const context = await getUserBillingContext(userId);
  if (!context.entitlements.apiAccessEnabled) return { ok: false, error: "UPGRADE_REQUIRED" };

  const owner = await db.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!owner) return { ok: false, error: "UNAUTHORIZED" };
  const stepUp = await verifyStepUpPassword(userId, owner.password, parsed.data.currentPassword);
  if (stepUp !== "OK") return { ok: false, error: stepUp };

  const { plaintext, hash, prefix } = generateApiToken();

  try {
    const record = await db.apiToken.create({
      data: {
        userId,
        name: parsed.data.name,
        tokenHash: hash,
        tokenPrefix: prefix,
        scope: parsed.data.scope,
      },
      select: { id: true },
    });

    revalidatePath("/settings/developer");
    return { ok: true, token: plaintext, id: record.id };
  } catch (err) {
    // @@unique([userId, name]) — a revoked token keeps its name too.
    if (err instanceof Error && "code" in err && (err as { code?: unknown }).code === "P2002") {
      return { ok: false, error: "NAME_TAKEN" };
    }
    throw err;
  }
}

export async function revokeApiToken(id: string): Promise<void> {
  const userId = await requireUserId({ write: true });

  await db.apiToken.update({
    where: { id, userId },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/settings/developer");
}
