import { db } from "~/server/db";

/**
 * P49A-13: is this family/team invite addressed to the signed-in user?
 *
 * P48-17 bound *accepting* a team invite to the invited address; declining
 * (both kinds) and accepting a family invite were still open to any signed-in
 * user holding the token — a forwarded email or a leaked link was enough to
 * decline someone else's invite, or to join a family book in their place.
 *
 * An invite is the user's when it was created for their account (`userId`,
 * set when the address already had an account) or sent to their current email
 * address (case-insensitive). An invite with neither is nobody's.
 */
export async function isInviteForUser(
  member: { userId: string | null; invitedEmail: string | null },
  userId: string,
): Promise<boolean> {
  if (member.userId && member.userId === userId) return true;
  if (!member.invitedEmail) return false;
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email?.toLowerCase() === member.invitedEmail.toLowerCase();
}

export const INVITE_FOR_SOMEONE_ELSE =
  "This invite was sent to a different email address. Sign in as that address to respond to it.";
