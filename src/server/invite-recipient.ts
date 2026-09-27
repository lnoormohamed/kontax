import { db } from "~/server/db";

/**
 * P49A-13: is this family/team invite addressed to the signed-in user?
 *
 * P48-17 bound *accepting* a team invite to the invited address; declining
 * (both kinds) and accepting a family invite were still open to any signed-in
 * user holding the token — a forwarded email or a leaked link was enough to
 * decline someone else's invite, or to join a family book in their place.
 *
 * An invite is the user's when it was created for their account (`userId` —
 * set when the address already had an account, or when the invitee verified
 * their address, see `email-verification.ts`) or sent to their current email
 * address (case-insensitive).
 *
 * Fable review: either way the account's email must be VERIFIED. Anyone can
 * register with someone else's address; an unverified account holding the
 * invited address (or bound to the invite because it existed when the invite
 * was sent) proves nothing. A new invitee registers, verifies — which also
 * binds pending invites to the account — and can then accept.
 */
export type InviteRecipientCheck = "ok" | "unverified" | "someone-else";

export async function checkInviteRecipient(
  member: { userId: string | null; invitedEmail: string | null },
  userId: string,
): Promise<InviteRecipientCheck> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  if (!user) return "someone-else";

  const boundToUser = member.userId != null && member.userId === userId;
  const sentToEmail = member.invitedEmail?.toLowerCase() === user.email.toLowerCase();
  if (!boundToUser && !sentToEmail) return "someone-else";
  return user.emailVerified ? "ok" : "unverified";
}

export const INVITE_FOR_SOMEONE_ELSE =
  "This invite was sent to a different email address. Sign in as that address to respond to it.";

export const INVITE_NEEDS_VERIFIED_EMAIL =
  "Verify your email address first — use the link we emailed you, then open this invite again.";

/** Throw the user-facing reason unless the signed-in user may act on the invite. */
export async function assertInviteForUser(
  member: { userId: string | null; invitedEmail: string | null },
  userId: string,
): Promise<void> {
  const check = await checkInviteRecipient(member, userId);
  if (check === "someone-else") throw new Error(INVITE_FOR_SOMEONE_ELSE);
  if (check === "unverified") throw new Error(INVITE_NEEDS_VERIFIED_EMAIL);
}
