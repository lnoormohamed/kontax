"use server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { RESERVED_USERNAMES, containsProfanity } from "~/server/username/reserved";

// 3–30 chars, letters/numbers/hyphens/underscores, must start and end with letter or number.
function isValidFormat(username: string): boolean {
  if (username.length < 3 || username.length > 30) return false;
  return /^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(username);
}

export async function checkUsernameAvailability(
  username: string,
): Promise<"available" | "taken" | "reserved" | "invalid"> {
  const normalised = username.toLowerCase().trim();

  if (!isValidFormat(normalised)) return "invalid";
  if (RESERVED_USERNAMES.has(normalised) || containsProfanity(normalised)) return "reserved";

  const existing = await db.user.findUnique({
    where: { username: normalised },
    select: { id: true },
  });

  return existing ? "taken" : "available";
}

export async function claimUsername(username: string): Promise<
  { success: true } | { error: "TAKEN" | "RESERVED" | "INVALID" | "COOLDOWN" | "UNAUTHORIZED" }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  const normalised = username.toLowerCase().trim();

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { username: true, usernameClaimedAt: true },
  });

  // 30-day cooldown between changes
  if (user.username && user.usernameClaimedAt) {
    const daysSince = (Date.now() - user.usernameClaimedAt.getTime()) / 86_400_000;
    if (daysSince < 30) return { error: "COOLDOWN" };
  }

  const availability = await checkUsernameAvailability(normalised);
  if (availability === "taken") return { error: "TAKEN" };
  if (availability === "reserved") return { error: "RESERVED" };
  if (availability === "invalid") return { error: "INVALID" };

  await db.user.update({
    where: { id: session.user.id },
    data: { username: normalised, usernameClaimedAt: new Date() },
  });

  return { success: true };
}
