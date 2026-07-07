import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";
import { getTeamGraceState } from "~/server/team-access";

// P46-18 / DB07 T5 remainder — one owned-team loader shared by the Teams
// parent page and its Books / Permissions child pages, so the split doesn't
// triplicate the (large) query or drift on the grace/locked derivation.
export async function loadOwnedTeam(userId: string) {
  const [billing, ownedTeam] = await Promise.all([
    getUserBillingContext(userId),
    db.group.findFirst({
      where: { ownerId: userId, type: "TEAM" },
      include: {
        members: {
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          include: { user: { select: { name: true, email: true } } },
        },
        addressBooks: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            archivedAt: true,
            _count: { select: { contacts: true } },
          },
        },
      },
    }),
  ]);

  if (!ownedTeam) return null;

  // P34F-02 §08: team-active off the Group's own entitlement, falling back to
  // the owner's personal entitlement for teams not yet on org billing.
  const teamsActive = ownedTeam.teamsEnabled || billing.entitlements.teamsEnabled;
  // A group created at checkout that hasn't been paid yet.
  const pendingSetup = !teamsActive && ownedTeam.teamsGraceEndsAt === null;
  const teamState = getTeamGraceState(ownedTeam.teamsGraceEndsAt, teamsActive);

  return {
    billing,
    ownedTeam,
    teamsActive,
    pendingSetup,
    isLocked: teamState === "locked",
    isGrace: teamState === "grace",
  };
}

export type OwnedTeamContext = NonNullable<Awaited<ReturnType<typeof loadOwnedTeam>>>;
