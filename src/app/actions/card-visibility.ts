"use server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import type { PublicCardFieldConfig } from "~/server/public-card/types";

export async function updateCardVisibility(
  patch: Partial<PublicCardFieldConfig>,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { publicCardFields: true },
  });

  const current = (user.publicCardFields ?? {}) as PublicCardFieldConfig;
  await db.user.update({
    where: { id: session.user.id },
    data: { publicCardFields: { ...current, ...patch } },
  });
}
