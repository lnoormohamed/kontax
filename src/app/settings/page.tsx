import Link from "next/link";
import { redirect } from "next/navigation";

import {
  LifecycleBadge,
  SectionLabel,
  SettingsCard,
  SettingsPageHead,
} from "~/app/_components/settings-ui";
import { BillingSection } from "~/app/settings/_components/billing-section";
import { BillingSuccessBanner } from "~/app/settings/_components/billing-success-banner";
import { MobileSettingsNav } from "~/app/settings/_components/mobile-settings-nav";
import { PortalReturnedBanner } from "~/app/settings/_components/portal-returned-banner";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { getBillingSurface } from "~/server/billing-surface";
import { getUserFamilyMembership } from "~/server/family-access";
import { getUserTeamMembership } from "~/server/team-access";
import { db } from "~/server/db";

const PLAN_SUMMARY: Record<string, string> = {
  Free: "500 contacts · 1 sync account · 1 device · per-contact history (last 3) · no activity feed",
  Pro: "Unlimited contacts · 5 sync accounts · 5 devices · activity log (365 days) · live & static sharing",
  Family: "Everything in Pro for up to 6 members · 1 shared family book · 90-day history",
  Teams: "Everything in Pro for up to 25 members · multiple shared books · unlimited audit log",
};
const PLAN_ORDER = ["Free", "Pro", "Family", "Teams"] as const;

export default async function SettingsPlanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const sp = searchParams ? await searchParams : undefined;
  const showBillingSuccess = sp?.billing === "success";
  const showPortalReturned = sp?.portal === "returned";

  const planSummary = await getUserPlanSummary(userId);
  const [billingSurface, syncConnections, liveContacts, groupMembership, overrideInfo, familyMembership, teamMembership] = await Promise.all([
    getBillingSurface(userId),
    db.syncAccount.count({ where: { userId, status: "ACTIVE" } }),
    db.contactShare.count({
      where: { recipientUserId: userId, shareType: "LIVE_SYNC", status: "ACTIVE" },
    }),
    db.groupMember.findFirst({
      where: { userId, inviteStatus: "ACCEPTED" },
      select: {
        role: true,
        group: {
          select: {
            name: true,
            type: true,
            memberSlotsLimit: true,
            _count: { select: { members: true, addressBooks: true } },
          },
        },
      },
    }),
    db.user.findUnique({ where: { id: userId }, select: { planOverriddenAt: true } }),
    getUserFamilyMembership(userId),
    getUserTeamMembership(userId),
  ]);

  const isGroupPlan = planSummary.plan === "FAMILY" || planSummary.plan === "TEAMS";
  const currentIdx = PLAN_ORDER.indexOf(planSummary.planLabel as (typeof PLAN_ORDER)[number]);

  // Cancellation impact (downgrade modal §3). Members exclude the owner.
  const cancelDetails = {
    syncConnections,
    liveContacts,
    totalContacts: planSummary.contactsUsed,
    contactLimit: 500,
    familyMembers:
      billingSurface.members && groupMembership?.group.type === "FAMILY"
        ? Math.max(0, billingSurface.members.used - 1)
        : null,
  };

  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  return (
    <>
      {/* Mobile settings nav — full-screen nav list, hidden on desktop */}
      <MobileSettingsNav
        email={session.user.email ?? ""}
        hasFamily={!!(familyMembership ?? planSummary.plan === "FAMILY")}
        hasTeam={!!(teamMembership ?? planSummary.plan === "TEAMS")}
        name={userLabel}
        plan={planSummary.planLabel}
        syncActive={syncConnections}
      />

      {/* Billing content — full width on desktop, hidden on mobile */}
      <div className="hidden md:block">
      {showBillingSuccess ? (
        <BillingSuccessBanner planLabel={planSummary.planLabel} />
      ) : null}
      {showPortalReturned ? <PortalReturnedBanner /> : null}
      <SettingsPageHead
        title="Plan & billing"
        sub="Your subscription, what you’re using, and how to manage payment."
        right={<LifecycleBadge label={planSummary.lifecyclePolicy.label} />}
      />

      <div className="grid gap-[18px]">
        {overrideInfo?.planOverriddenAt ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-[#c7d0fb] bg-[#f0f2fb] px-4 py-3 text-[13px] font-medium text-[#1d4ed8]">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 21V4" />
              <path d="M5 4h11l-2.2 3.5L16 11H5" />
            </svg>
            <span>
              Your plan is set by an admin override. Billing changes are managed by the Kontax team.
            </span>
          </div>
        ) : null}
        <BillingSection cancelDetails={cancelDetails} surface={billingSurface} />

        {/* group membership shortcut */}
        {isGroupPlan ? (
          <SettingsCard className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8b938c]">
                {planSummary.plan === "FAMILY" ? "Family group" : "Team"}
              </p>
              <p className="mt-1.5 text-[14px] text-[#3a4540]">
                {groupMembership?.group ? (
                  <>
                    {groupMembership.role === "OWNER" ? "Owner of " : "Member of "}
                    <span className="font-semibold text-[#1d2823]">{groupMembership.group.name}</span>
                    {groupMembership.group.memberSlotsLimit
                      ? ` · ${groupMembership.group._count.members}/${groupMembership.group.memberSlotsLimit} members`
                      : ` · ${groupMembership.group._count.members} members`}
                    {planSummary.plan === "TEAMS" && groupMembership.group._count.addressBooks > 0
                      ? ` · ${groupMembership.group._count.addressBooks} book${groupMembership.group._count.addressBooks === 1 ? "" : "s"}`
                      : null}
                  </>
                ) : (
                  <>Your {planSummary.plan === "FAMILY" ? "family" : "team"} group isn&apos;t set up yet.</>
                )}
              </p>
            </div>
            <Link
              className="shrink-0 rounded-xl bg-[#4158f4] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3248db]"
              href={planSummary.plan === "FAMILY" ? "/settings/family" : "/settings/teams"}
            >
              {planSummary.plan === "FAMILY"
                ? groupMembership?.group
                  ? "Manage family book"
                  : "Set up family book"
                : groupMembership?.group
                  ? "Manage team"
                  : "Set up team"}
            </Link>
          </SettingsCard>
        ) : null}

        {/* plan comparison */}
        <div>
          <SectionLabel>Compare plans</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PLAN_ORDER.map((name, idx) => {
              const current = name === planSummary.planLabel;
              return (
                <div
                  key={name}
                  className={`flex flex-col rounded-2xl border bg-white p-5 ${
                    current ? "border-[#17352e]" : "border-[#d8ddd6]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[16px] font-semibold text-[#1d2823]">{name}</span>
                    {current ? (
                      <span className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#17352e]">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2.5 flex-1 text-[12.5px] leading-5 text-[#5c655e]">{PLAN_SUMMARY[name]}</p>
                  {current ? (
                    <span className="mt-3.5 inline-flex h-10 w-full items-center justify-center rounded-xl border border-[#d8ddd6] text-[13.5px] font-semibold text-[#8b938c]">
                      Your plan
                    </span>
                  ) : (
                    <Link
                      className="mt-3.5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#17352e] text-[13.5px] font-semibold text-white transition hover:bg-[#20443b]"
                      href="/pricing"
                    >
                      {idx > currentIdx ? "Upgrade" : "Switch"}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="px-0.5 text-[14px] leading-6 text-[#5c655e]">{planSummary.lifecyclePolicy.description}</p>
        <p className="px-0.5 text-[12px] text-[#8b938c]">
          Activity log retained for 30 days on Free · 1 year on Pro · 90 days on Family · unlimited on Teams.
        </p>
      </div>
      </div>{/* end hidden md:block billing wrapper */}
    </>
  );
}
