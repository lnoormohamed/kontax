"use server";

import { revalidatePath } from "next/cache";

import { inviteFamilyMember } from "~/app/actions/family";
import { inviteTeamMember } from "~/app/actions/teams";
import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";

// P26-14: batch action for the Family/Teams getting-started wizard. The wizard
// collects everything across its steps, then calls this once: create the group +
// default shared book (if not already present), send the invites, apply the edit
// permission, and record completion so the flow runs once per upgrade.

export type UpgradePlan = "FAMILY" | "TEAMS";
export type WhoCanEdit = "everyone" | "restricted";

export type UpgradeOnboardingResult =
  | { ok: true; invited: number; failed: string[] }
  | { ok: false; error: "NOT_SIGNED_IN" | "PLAN_NOT_READY" };

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.impersonatedBy) return null;
  return session.user.id;
}

export async function completeUpgradeOnboarding(input: {
  plan: UpgradePlan;
  bookName: string;
  whoCanEdit: WhoCanEdit;
  emails: string[];
}): Promise<UpgradeOnboardingResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "NOT_SIGNED_IN" };

  const billing = await getUserBillingContext(userId);
  const entitled =
    input.plan === "FAMILY"
      ? billing.entitlements.familyGroupEnabled
      : billing.entitlements.teamsEnabled;
  // Guard against the webhook race — the plan may not be active yet.
  if (!entitled) return { ok: false, error: "PLAN_NOT_READY" };

  const groupType = input.plan === "FAMILY" ? "FAMILY" : "TEAM";
  const fallbackName = input.plan === "FAMILY" ? "Family Contacts" : "Team Contacts";
  const bookName = input.bookName.trim() || fallbackName;
  const maxMembers = billing.entitlements.memberSlotsLimit ?? (input.plan === "FAMILY" ? 6 : 25);

  // 1. Find or create the group + its default shared book.
  let group = await db.group.findFirst({
    where: { ownerId: userId, type: groupType },
    select: { id: true },
  });
  if (!group) {
    const created = await db.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: {
          ownerId: userId,
          type: groupType,
          name: bookName,
          maxMembers,
          members: {
            create: { userId, role: "OWNER", inviteStatus: "ACCEPTED", canEdit: true, joinedAt: new Date() },
          },
          addressBooks: { create: { name: bookName, isDefault: true } },
        },
        include: { addressBooks: true },
      });
      await tx.group.update({
        where: { id: g.id },
        data: { defaultAddressBookId: g.addressBooks[0]?.id },
      });
      return g;
    });
    group = { id: created.id };
  }

  // 2. Send invites (reuse the existing per-member actions for token/seat/dedupe
  //    handling + email). One bad address shouldn't abort the rest.
  const failed: string[] = [];
  let invited = 0;
  const emails = [...new Set(input.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  for (const email of emails) {
    const fd = new FormData();
    fd.set("email", email);
    try {
      if (input.plan === "FAMILY") await inviteFamilyMember(fd);
      else await inviteTeamMember(fd);
      invited += 1;
    } catch {
      failed.push(email);
    }
  }

  // 3. Apply the edit permission. Invites default to canEdit; "restricted" means
  //    only the owner can edit, so clear it for everyone else.
  if (input.whoCanEdit === "restricted") {
    await db.groupMember.updateMany({
      where: { groupId: group.id, role: { not: "OWNER" } },
      data: { canEdit: false },
    });
  }

  // 4. Record completion so the wizard doesn't re-trigger.
  const now = new Date();
  await db.userOnboardingState.upsert({
    where: { userId },
    create: { userId, upgradeOnboardingPlan: input.plan, upgradeOnboardingCompletedAt: now },
    update: { upgradeOnboardingPlan: input.plan, upgradeOnboardingCompletedAt: now },
  });

  revalidatePath("/contacts");
  revalidatePath(input.plan === "FAMILY" ? "/settings/family" : "/settings/teams");
  return { ok: true, invited, failed };
}
