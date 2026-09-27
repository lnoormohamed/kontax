"use server";

import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { db } from "~/server/db";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";
import { RESERVED_USERNAMES, containsProfanity } from "~/server/username/reserved";

// 3–30 chars, letters/numbers/hyphens/underscores, must start and end with letter or number.
function isValidFormat(username: string): boolean {
  if (username.length < 3 || username.length > 30) return false;
  return /^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(username);
}

const lookupAvailability = async (
  normalised: string,
): Promise<"available" | "taken" | "reserved" | "invalid"> => {
  if (!isValidFormat(normalised)) return "invalid";
  if (RESERVED_USERNAMES.has(normalised) || containsProfanity(normalised)) return "reserved";

  const existing = await db.user.findUnique({
    where: { username: normalised },
    select: { id: true },
  });

  return existing ? "taken" : "available";
};

/**
 * P49A-13: this was callable by anyone — a server action needs no session
 * unless it checks for one — so it was an unauthenticated, unlimited oracle
 * for which usernames exist. It now needs a signed-in session and is
 * rate-limited per user (the settings field debounces, so real typing stays
 * well under the limit). Over the limit it answers "rate_limited" rather than
 * guessing.
 */
export async function checkUsernameAvailability(
  username: string,
): Promise<"available" | "taken" | "reserved" | "invalid" | "rate_limited"> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if (isSessionError(err)) return "invalid";
    throw err;
  }
  if (typeof username !== "string" || username.length > 64) return "invalid";

  const rl = await checkRateLimit(rateLimiters.usernameCheck, `user:${userId}`);
  if (!rl.allowed) return "rate_limited";

  return lookupAvailability(username.toLowerCase().trim());
}

export async function claimUsername(username: string): Promise<
  { success: true } | { error: "TAKEN" | "RESERVED" | "INVALID" | "COOLDOWN" | "UNAUTHORIZED" }
> {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) return { error: "UNAUTHORIZED" };
    throw err;
  }

  const normalised = username.toLowerCase().trim();

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { username: true, usernameClaimedAt: true },
  });

  // 30-day cooldown between changes
  if (user.username && user.usernameClaimedAt) {
    const daysSince = (Date.now() - user.usernameClaimedAt.getTime()) / 86_400_000;
    if (daysSince < 30) return { error: "COOLDOWN" };
  }

  // The claim itself is not rate-limited by the probe bucket — it has its own
  // 30-day cooldown — and the unique index on `username` is the final arbiter.
  const availability = await lookupAvailability(normalised);
  if (availability === "taken") return { error: "TAKEN" };
  if (availability === "reserved") return { error: "RESERVED" };
  if (availability === "invalid") return { error: "INVALID" };

  await db.user.update({
    where: { id: userId },
    data: { username: normalised, usernameClaimedAt: new Date() },
  });

  return { success: true };
}
