import { db } from "~/server/db";

// P34F-02 (Option A — create team before checkout): provision the user's team
// group BEFORE Teams checkout so billing can anchor to the org from the start.
//
// The group is created in a *pending* state (teamsEnabled = false); the Stripe
// webhook (upsertGroupSubscription) flips teamsEnabled = true once payment
// succeeds. This is intentionally NOT gated by the user's personal entitlement —
// paying for the org's subscription via checkout is what activates the team.
//
// Idempotent: a user owns at most one team group, so re-entering checkout reuses
// the existing (possibly still-pending) group rather than creating duplicates.
export async function ensurePendingTeamGroup(
  userId: string,
  name = "My Team",
): Promise<string> {
  const existing = await db.group.findFirst({
    where: { ownerId: userId, type: "TEAM" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const group = await db.group.create({
    data: {
      ownerId: userId,
      type: "TEAM",
      name,
      // Seat ceiling is corrected from the Stripe quantity by
      // upsertGroupSubscription on the first paid webhook.
      maxMembers: 25,
      members: {
        create: {
          userId,
          role: "OWNER",
          inviteStatus: "ACCEPTED",
          canEdit: true,
          // Owner is an implicit billing manager anyway (canManageGroupBilling),
          // but set the flag too so it reads correctly in the members matrix.
          canManageBilling: true,
          joinedAt: new Date(),
        },
      },
      // Seed the team with one book (Teams can add more later).
      addressBooks: { create: { name: "Team contacts", isDefault: false } },
    },
    select: { id: true },
  });
  return group.id;
}
