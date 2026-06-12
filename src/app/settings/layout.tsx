import Link from "next/link";
import { redirect } from "next/navigation";

import { BottomNav } from "~/app/_components/bottom-nav";
import { NotificationBellSlot } from "~/app/_components/notification-bell-slot";
import { SearchInput } from "~/app/_components/search-input";
import { MobileSettingsHeader } from "~/app/settings/_components/mobile-settings-header";
import { SettingsSidebar } from "~/app/_components/settings-sidebar";
import { UserMenu } from "~/app/_components/user-menu";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getUserPlanSummary } from "~/server/billing";
import { getUserFamilyMembership } from "~/server/family-access";
import { getUserTeamMembership } from "~/server/team-access";

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const [planSummary, familyMembership, teamMembership] = await Promise.all([
    getUserPlanSummary(userId),
    getUserFamilyMembership(userId),
    getUserTeamMembership(userId),
  ]);

  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  const [unreadCount, syncErrorCount] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null, dismissedAt: null } }),
    db.syncAccount.count({ where: { userId, status: { in: ["ERROR", "NEEDS_REAUTH"] } } }),
  ]);

  // Show Family/Team entries when the user belongs to one (owner or member) or
  // is on the matching plan (so a plan owner who hasn't created the group yet
  // can still reach the setup flow). Otherwise a single muted upsell row.
  const shared: Array<{ id: "family" | "teams"; label: string; icon: string }> = [];
  if (familyMembership || planSummary.plan === "FAMILY") {
    shared.push({ id: "family", label: "Family management", icon: "users" });
  }
  if (teamMembership || planSummary.plan === "TEAMS") {
    shared.push({ id: "teams", label: "Team management", icon: "team" });
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-[#1d2823]">
      {/* Desktop header — hidden on mobile */}
      <header className="hidden shrink-0 border-b border-[#d8ddd6] bg-white md:block">
        <div className="flex h-[60px] w-full items-center gap-4 px-4 lg:px-[18px]">
          <Link className="flex shrink-0 items-center gap-2.5 lg:w-[230px]" href="/contacts">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#17352e] text-[17px] font-bold text-[#dff0e7]">
              K
            </span>
            <span className="text-[19px] font-bold tracking-[-0.01em] text-[#1d2823]">Kontax</span>
          </Link>

          <SearchInput filter="all" initialQuery="" sort="name" tab="people" view="compact" />

          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#4158f4] px-4 text-sm font-semibold text-white transition hover:bg-[#3248db]"
              href="/contacts/new"
            >
              <WorkspaceIcon name="plus" size={18} strokeWidth={2} />
              <span className="hidden sm:inline">Create contact</span>
            </Link>
            <NotificationBellSlot userId={userId} />
            <UserMenu email={session.user.email ?? ""} initials={getInitials(userLabel)} name={userLabel} />
          </div>
        </div>
      </header>

      {/* Mobile header — "Settings" at the root, a back header on sub-pages (P24B-02) */}
      <MobileSettingsHeader bell={<NotificationBellSlot userId={userId} />} />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar: hidden on mobile, visible on desktop */}
        <div className="hidden md:flex">
          <SettingsSidebar
            account={{ name: userLabel, email: session.user.email ?? "", plan: planSummary.planLabel }}
            shared={shared}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[#f6f7f4]">
          <div className="mx-auto w-full max-w-[1060px] px-0 py-0 pb-[calc(56px+env(safe-area-inset-bottom))] md:px-6 md:py-7 md:pb-7 lg:px-9 lg:py-8">
            {children}
          </div>
        </div>
      </div>

      <BottomNav unreadCount={unreadCount} syncErrorCount={syncErrorCount} />
    </div>
  );
}
