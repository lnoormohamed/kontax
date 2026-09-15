"use server";

import { z } from "zod";

import { requireUserId } from "~/server/auth/require-session";
import { db } from "~/server/db";
import type { PublicCardFieldConfig } from "~/server/public-card/types";

// P48-17: this used to spread an unvalidated `patch` straight into the stored
// JSON column — any caller could inject arbitrary keys (mass assignment) into
// `publicCardFields`, not just the known boolean toggles the public-card
// renderer understands. Whitelist by key AND by type.
const cardVisibilitySchema = z
  .object({
    hidden: z.boolean(),
    showEmail: z.boolean(),
    showPhone: z.boolean(),
    showCompany: z.boolean(),
    showJobTitle: z.boolean(),
    showWebsite: z.boolean(),
    showLinkedIn: z.boolean(),
    showTwitter: z.boolean(),
  })
  .partial();

export async function updateCardVisibility(
  patch: Partial<PublicCardFieldConfig>,
): Promise<void> {
  const userId = await requireUserId({ write: true });

  const parsed = cardVisibilitySchema.safeParse(patch);
  if (!parsed.success) {
    throw new Error("Invalid card visibility settings.");
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { publicCardFields: true },
  });

  const current = (user.publicCardFields ?? {}) as PublicCardFieldConfig;
  await db.user.update({
    where: { id: userId },
    data: { publicCardFields: { ...current, ...parsed.data } },
  });
}
