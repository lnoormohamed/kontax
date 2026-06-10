import { db } from "~/server/db";
import { getContactFamilyContext, getUserFamilyMembership } from "~/server/family-access";
import {
  getContactTeamContext,
  getUserTeamMembership,
  resolveBookPermission,
} from "~/server/team-access";

// Unified edit-access resolution for shared contacts (Phase 13 family + Phase 14
// teams). Per-book team permissions live in JSON and can't be expressed in a
// Prisma `where`, so mutation paths call this to enforce them precisely and to
// get the right activity attribution.

export type EditAccess = {
  /** the contact lives in a shared book (family or team) */
  shared: boolean;
  /** the user may mutate it */
  allowed: boolean;
  attribution: { actor: "FAMILY_MEMBER" | "TEAM_MEMBER"; actorDetail: string } | null;
};

const displayName = async (userId: string): Promise<string> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  return user?.name?.trim() ?? user?.email ?? "A member";
};

export const resolveContactEditAccess = async (
  userId: string,
  contactId: string,
): Promise<EditAccess> => {
  // Team book (per-book permission)
  const team = await getContactTeamContext(contactId);
  if (team) {
    const membership = await getUserTeamMembership(userId);
    const inTeam = membership?.groupId === team.groupId;
    const perm = membership && inTeam ? resolveBookPermission(membership, team.bookId) : "NONE";
    const allowed = inTeam && perm === "EDIT" && !team.archived;
    return {
      shared: true,
      allowed,
      attribution: {
        actor: "TEAM_MEMBER",
        actorDetail: `${await displayName(userId)} · ${team.teamName} · ${team.bookName}`,
      },
    };
  }

  // Family book (member canEdit)
  const family = await getContactFamilyContext(contactId);
  if (family) {
    const fm = await getUserFamilyMembership(userId);
    const allowed = Boolean(fm?.canEdit) && fm?.groupId === family.groupId;
    return {
      shared: true,
      allowed,
      attribution: {
        actor: "FAMILY_MEMBER",
        actorDetail: `${await displayName(userId)} via Family Book`,
      },
    };
  }

  // Private contact — ownership is enforced by the caller's userId scoping.
  return { shared: false, allowed: true, attribution: null };
};
