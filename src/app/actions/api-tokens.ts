"use server";

import { revalidatePath } from "next/cache";

import type { ApiTokenScope } from "~/server/api-tokens";
import { generateApiToken } from "~/server/api-tokens";
import { getUserBillingContext } from "~/server/billing";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

async function getRequiredUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("UNAUTHENTICATED");
  return userId;
}

export async function createApiToken(input: {
  name: string;
  scope: ApiTokenScope;
}): Promise<{ token: string; id: string }> {
  const userId = await getRequiredUserId();

  const context = await getUserBillingContext(userId);
  if (!context.entitlements.apiAccessEnabled) throw new Error("UPGRADE_REQUIRED");

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("NAME_REQUIRED");
  if (trimmedName.length > 64) throw new Error("NAME_TOO_LONG");

  const { plaintext, hash, prefix } = generateApiToken();

  const record = await db.apiToken.create({
    data: {
      userId,
      name: trimmedName,
      tokenHash: hash,
      tokenPrefix: prefix,
      scope: input.scope,
    },
    select: { id: true },
  });

  revalidatePath("/settings/developer");
  return { token: plaintext, id: record.id };
}

export async function revokeApiToken(id: string): Promise<void> {
  const userId = await getRequiredUserId();

  await db.apiToken.update({
    where: { id, userId },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/settings/developer");
}
