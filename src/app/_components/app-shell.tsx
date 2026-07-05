import Link from "next/link";

import { AppBannerStack } from "~/app/_components/app-banner-stack";
import { BottomNav } from "~/app/_components/bottom-nav";
import { OfflineChip } from "~/app/_components/connection-banner";
import { MobileHeader } from "~/app/_components/mobile-header";
import { NotificationBellSlot } from "~/app/_components/notification-bell-slot";
import { SearchDropdown } from "~/app/_components/search-dropdown";
import { UserMenu } from "~/app/_components/user-menu";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { getLifecycleAccessPolicy, getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";

type AppShellAccount = { name: string; email: string; plan: string };
type AppShellCounts = { people: number; favorites: number; archived: number; duplicates: number };

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

/**
 * Persistent app chrome (top header + left sidebar) for secondary pages such as
 * Create Contact and (P17-02) the contact detail. The home page keeps its own
 * fully-wired shell in contact-dashboard; this shares the same look so navigating
 * to /contacts/new never drops the user out of the app.
 */
export async function AppShell({
  account,
  counts,
  mobileTitle,
  mobileBackHref = "/contacts",
  mobileBackLabel = "Contacts",
  children,
}: {
  account: AppShellAccount;
  counts?: AppShellCounts;
  mobileTitle?: string;
  mobileBackHref?: string;
  mobileBackLabel?: string;
  children: React.ReactNode;
}) {
  // Pending incoming shares → badge on "Shared with me" (P12-05 indicator).
  const session = await auth();
  const userId = session?.user?.id;

  // P42-DB01: account lifecycle feeds the banner slot's rank-1 state — a
  // read-only account (CANCELED / LOCKED) outranks connectivity in the slot.
  const billing = userId ? await getUserBillingContext(userId) : null;
  const readOnly = billing ? !getLifecycleAccessPolicy(billing.lifecycleState).canWrite : false;

  const [incomingShares, syncConnected, unreadCount, syncErrorCount, labelRegistry] = userId
    ? await Promise.all([
        db.contactShare.count({
          where: {
            recipientUserId: userId,
            shareType: { in: ["STATIC_COPY", "LIVE_SYNC"] },
            status: "ACTIVE",
            recipientContactId: null,
          },
        }),
        db.syncAccount
          .count({ where: { userId, status: "ACTIVE" } })
          .then((n) => n > 0),
        db.notification.count({ where: { userId, readAt: null, dismissedAt: null } }),
        db.syncAccount.count({ where: { userId, status: { in: ["ERROR", "NEEDS_REAUTH"] } } }),
        db.label.findMany({
          where: { userId },
          select: { name: true, color: true },
          orderBy: { position: "asc" },
        }),
      ])
    : [0, false, 0, 0, []];
  const navItem = (href: string, icon: string, label: string, count?: number, badge?: boolean) => (
    <Link
      className="flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium text-[#5c655e] transition hover:bg-[#f2f4f0]"
      href={href}
    >
      <WorkspaceIcon name={icon} size={18} />
      <span className="flex-1">{label}</span>
      {count != null ? (
        badge && count > 0 ? (
          <span className="rounded-full bg-[#bf8526] px-1.5 text-[11px] font-semibold text-white">{count}</span>
        ) : (
          <span className="text-[12px] text-[#8b938c]">{count}</span>
        )
      ) : null}
    </Link>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-[#1d2823]">
      {/* mobile detail header — labelled back + title (P46-DB06 A1) */}
      {mobileTitle && (
        <MobileHeader
          variant="detail"
          title={mobileTitle}
          backHref={mobileBackHref}
          backLabel={mobileBackLabel}
          action={<OfflineChip readOnly={readOnly} />}
        />
      )}

      {/* desktop top header */}
      <header className="hidden shrink-0 border-b border-[#d8ddd6] bg-white md:block">
        <div className="flex h-[60px] w-full items-center gap-4 px-4 lg:px-[18px]">
          <Link className="flex shrink-0 items-center gap-2.5 lg:w-[230px]" href="/contacts?tab=overview">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#17352e] text-[17px] font-bold text-[#dff0e7]">
              K
            </span>
            <span className="text-[19px] font-bold tracking-[-0.01em] text-[#1d2823]">Kontax</span>
          </Link>

          <SearchDropdown labelRegistry={labelRegistry} />

          <div className="flex shrink-0 items-center gap-2.5">
            {/* P42-DB01 §3b: offline persists as a chip while account-state owns the slot */}
            <OfflineChip readOnly={readOnly} />
            <Link
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#4158f4] px-4 text-sm font-semibold text-white transition hover:bg-[#3248db]"
              href="/contacts/new"
            >
              <WorkspaceIcon name="plus" size={18} strokeWidth={2} />
              <span className="hidden sm:inline">Create contact</span>
            </Link>
            {/* P22-DB05: unified notification bell (replaces the legacy /shares bell). */}
            {session?.user?.id ? <NotificationBellSlot userId={session.user.id} /> : null}
            <UserMenu email={account.email} initials={getInitials(account.name)} name={account.name} />
          </div>
        </div>
      </header>

      {/* P46-DB06 A3: the shared ordered banner stack (no local copies) */}
      <AppBannerStack
        userId={session?.user?.id}
        email={account.email}
        emailVerified={!!session?.user?.emailVerified}
        readOnly={readOnly}
      />

      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className="hidden w-[248px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#d8ddd6] bg-white px-3 py-3.5 md:flex">
          <Link
            className="mb-2 flex items-center gap-3 rounded-xl border border-[#e9ece7] bg-[#f6f7f4] p-2.5 transition hover:bg-[#f2f4f0]"
            href="/settings"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17352e] text-xs font-semibold text-[#dff0e7]">
              {getInitials(account.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-[#1d2823]">{account.name}</span>
              <span className="block truncate text-[11px] text-[#8b938c]">{account.email}</span>
            </span>
            <span className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#17352e]">
              {account.plan}
            </span>
          </Link>

          {navItem("/contacts?tab=overview", "home", "Overview")}
          {navItem("/contacts?tab=people&filter=all", "people", "People", counts?.people)}
          {navItem("/contacts?tab=people&filter=favorites", "star", "Favorites", counts?.favorites)}
          {navItem("/contacts?tab=archived&filter=all", "archive", "Archived", counts?.archived)}
          {navItem("/contacts?tab=duplicates&filter=all", "people", "Duplicates", counts?.duplicates, true)}
          {navItem("/contacts?tab=activity", "clock", "Activity")}
          {navItem("/shares", "download", "Shared with me", incomingShares || undefined, true)}

          <div className="mt-auto border-t border-[#e9ece7] pt-2">
            {(
              [
                ["/import-export", "upload", "Import"],
                ["/import-export", "download", "Export"],
                ["/sync", "sync", "Sync"],
              ] as const
            ).map(([href, icon, label]) => (
              <Link
                className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium text-[#8b938c] transition hover:bg-[#f2f4f0] hover:text-[#5c655e]"
                href={href}
                key={label}
              >
                <WorkspaceIcon name={icon} size={15} />
                <span className="flex-1">{label}</span>
                {icon === "sync" && syncConnected ? (
                  <span className="size-[7px] rounded-full bg-[#1f8a5b]" />
                ) : null}
              </Link>
            ))}
          </div>
        </aside>

        {/* content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[#f4f6f2] pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </div>

      <BottomNav unreadCount={unreadCount} syncErrorCount={syncErrorCount} />
    </div>
  );
}
