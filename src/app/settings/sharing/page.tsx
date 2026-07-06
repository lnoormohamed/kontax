import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";

export const metadata: Metadata = { title: "Sharing & groups — Kontax" };

// P46-16 / DB07 §5c — the Sharing & groups index; children live at
// /settings/sharing/* (301s from the old URLs). The gated-row rule applies:
// Family/Teams always link to their own pages, which render their own upsell
// when no group exists. The group-membership shortcut card lives here (moved
// in from the old billing root — it's a navigation card, not a billing
// control).
const ROWS = [
  { icon: "arrowDownLeft", label: "Shared with me", sub: "Contacts other people shared to you", href: "/settings/sharing/shared" },
  { icon: "users", label: "Family", sub: "Shared family book & members", href: "/settings/sharing/family" },
  { icon: "team", label: "Teams", sub: "Team books, members & permissions", href: "/settings/sharing/teams" },
] as const;

export default async function SettingsSharingIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [planSummary, groupMembership] = await Promise.all([
    getUserPlanSummary(session.user.id),
    db.groupMember.findFirst({
      where: { userId: session.user.id, inviteStatus: "ACCEPTED" },
      select: {
        role: true,
        group: {
          select: { name: true, type: true, memberSlotsLimit: true, _count: { select: { members: true } } },
        },
      },
    }),
  ]);
  const isGroupPlan = planSummary.plan === "FAMILY" || planSummary.plan === "TEAMS";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="hidden text-2xl font-semibold text-[#1d2823] lg:block">Sharing &amp; groups</h1>
      <p className="mt-1 hidden text-sm text-[#5c655e] lg:block">
        The people surfaces — what&apos;s shared with you, and the groups you share with.
      </p>

      {/* Group-membership shortcut (moved in from the old billing root) */}
      {isGroupPlan ? (
        <div className="mb-4 mt-0 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[#d8ddd6] bg-white p-4 lg:mt-5">
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
                </>
              ) : (
                <>Your {planSummary.plan === "FAMILY" ? "family" : "team"} group isn&apos;t set up yet.</>
              )}
            </p>
          </div>
          <Link
            className="shrink-0 rounded-xl bg-[#4158f4] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3248db]"
            href={planSummary.plan === "FAMILY" ? "/settings/sharing/family" : "/settings/sharing/teams"}
          >
            {groupMembership?.group ? "Manage" : "Set up"}
          </Link>
        </div>
      ) : null}
      <div className="mt-0 overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white lg:mt-5">
        {ROWS.map((row, i) => (
          <Link
            key={row.label}
            href={row.href}
            className="flex items-center gap-3 px-4 py-3.5 no-underline"
            style={{ borderBottom: i < ROWS.length - 1 ? "1px solid #f2f4f0" : "none" }}
          >
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[#f2f4f0]">
              <WorkspaceIcon name={row.icon} size={17} className="text-[#5c655e]" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-[#1d2823]">{row.label}</span>
              <span className="block truncate text-[12.5px] text-[#8b938c]">{row.sub}</span>
            </span>
            <WorkspaceIcon name="chevronRight" size={17} className="shrink-0 text-[#d8ddd6]" strokeWidth={1.7} />
          </Link>
        ))}
      </div>
    </div>
  );
}
