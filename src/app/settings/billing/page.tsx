import Link from "next/link";

import { redirectToLogin } from "~/server/auth/require-page-auth";

import {
  LifecycleBadge,
  SectionLabel,
  SettingsPageHead,
} from "~/app/_components/settings-ui";
import { BillingSection } from "~/app/settings/_components/billing-section";
import { BillingSuccessBanner } from "~/app/settings/_components/billing-success-banner";
import { PortalReturnedBanner } from "~/app/settings/_components/portal-returned-banner";
import { SettingsCard } from "~/app/_components/settings-ui";
import { updateTeamSeats } from "~/app/actions/teams";
import { loadOwnedTeam } from "~/app/settings/sharing/teams/_lib";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { getBillingSurface } from "~/server/billing-surface";
import { syncStripeBillingState } from "~/server/stripe-handlers";
import { db } from "~/server/db";

// P46-13 / DB07 T2 — Plan & billing is a real page. This is the old root
// `#plan-billing` anchor section, extracted; the anchor is dead. Stripe
// checkout/portal return here (`?billing=success`, `?portal=returned`); the
// root index forwards any legacy in-flight returns. The account-session card
// moved to Security (its sign-in home); the mobile index keeps a shortcut.

const PLAN_SUMMARY: Record<string, string> = {
  Free: "500 contacts · 1 sync account · 1 device · per-contact history (last 3) · no activity feed",
  Pro: "Unlimited contacts · 5 sync accounts · 5 devices · activity log (365 days) · live & static sharing",
  Family: "Everything in Pro for up to 6 members · 1 shared family book · 90-day history",
  Teams: "Everything in Pro for up to 25 members · multiple shared books · unlimited audit log",
};
const PLAN_ORDER = ["Free", "Pro", "Family", "Teams"] as const;

export default async function SettingsBillingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return redirectToLogin("/settings/billing");
  const userId = session.user.id;
  const sp = searchParams ? await searchParams : undefined;
  const showBillingSuccess = sp?.billing === "success";
  const showPortalReturned = sp?.portal === "returned";

  if (showBillingSuccess || showPortalReturned) {
    try {
      await syncStripeBillingState(userId);
    } catch {
      // Best-effort refresh only. The page still renders from local state if
      // Stripe is temporarily unavailable.
    }
  }

  const planSummary = await getUserPlanSummary(userId);
  // P46-18 / DB07: Plan & billing owns seat count & purchase — the seat form
  // lives here; the Teams page shows read-only usage and links back.
  const teamCtx = planSummary.plan === "TEAMS" ? await loadOwnedTeam(userId) : null;
  const [billingSurface, syncConnections, liveContacts, groupMembership, overrideInfo] = await Promise.all([
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
    db.user.findUnique({ where: { id: userId }, select: { planOverriddenAt: true, password: true } }),
  ]);

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

  return (
    <div className="mt-2 md:mt-0">
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
        <BillingSection cancelDetails={cancelDetails} surface={billingSurface} hasPassword={!!overrideInfo?.password} />

        {/* P46-16: the group-membership shortcut moved to the Sharing & groups
            index — it's a navigation card, not a billing control. */}

        {/* P46-18: team seat management (owner-only; hidden when locked —
            no active Teams plan to adjust). Same updateTeamSeats Stripe
            action as before, relocated from the Teams page. */}
        {teamCtx && !teamCtx.isLocked && !teamCtx.pendingSetup ? (() => {
          const activeCount = teamCtx.ownedTeam.members.filter(
            (m) => m.inviteStatus !== "DECLINED",
          ).length;
          return (
            <SettingsCard className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold text-[#1d2823]">Team seats</div>
                <p className="mt-1 max-w-[440px] text-[13.5px] text-[#5c655e]">
                  {teamCtx.ownedTeam.name} · {activeCount} of {teamCtx.ownedTeam.maxMembers} seats
                  in use. Changes are prorated and take effect immediately.
                </p>
              </div>
              <form action={updateTeamSeats} className="flex items-center gap-2">
                <input
                  className="w-20 rounded-xl border border-[#d8ddd6] bg-white px-3 py-2 text-center text-[14px] outline-none transition focus:border-[#4158f4] focus:shadow-[0_0_0_3px_#edf0fe]"
                  defaultValue={teamCtx.ownedTeam.maxMembers}
                  min={Math.max(3, activeCount)}
                  max={500}
                  name="seats"
                  type="number"
                />
                <button
                  className="rounded-xl border border-[#d8ddd6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
                  type="submit"
                >
                  Update seats
                </button>
              </form>
            </SettingsCard>
          );
        })() : null}

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
    </div>
  );
}
