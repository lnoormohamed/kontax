"use server";

import { requireUserId } from "~/server/auth/require-session";
import { db } from "~/server/db";
import type { PublicCardFieldConfig } from "~/server/public-card/types";

export async function updateCardVisibility(
  patch: Partial<PublicCardFieldConfig>,
): Promise<void> {
  const userId = await requireUserId({ write: true });

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { publicCardFields: true },
  });

  const current = (user.publicCardFields ?? {}) as PublicCardFieldConfig;
  await db.user.update({
    where: { id: userId },
    data: { publicCardFields: { ...current, ...patch } },
  });
}
