import Link from "next/link";
import { redirect } from "next/navigation";

import { BottomNav } from "~/app/_components/bottom-nav";
import { MobilePlainHeader } from "~/app/_components/mobile-plain-header";
import { NotificationBellSlot } from "~/app/_components/notification-bell-slot";
import { SettingsSidebar } from "~/app/_components/settings-sidebar";
import { SearchInput } from "~/app/_components/search-input";
import { UserMenu } from "~/app/_components/user-menu";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";
import { getUserFamilyMembership } from "~/server/family-access";
import { getUserTeamMembership } from "~/server/team-access";
import {
  getConsecutiveFailureStreak,
  getSyncAccountOperationalHealth,
} from "~/server/sync-health";
import {
  SyncPageClient,
  type SyncAccountData,
  type SyncJobRow,
  type SyncConflictData,
} from "./_components/sync-page-client";
import { MobileSyncScreen } from "./_components/mobile-sync-screen";

// ── helpers ───────────────────────────────────────────────────────────────────
const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const formatRelative = (date: Date | null): string | null => {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatJobTimestamp = (date: Date): string => {
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
};

// Extract a human-readable snapshot summary for conflict comparison rows.
// The snapshots are stored as JSON blobs in the DB.
const getSnapshotText = (snapshot: unknown, key: string): string => {
  if (typeof snapshot !== "object" || snapshot === null) return "—";
  const val = (snapshot as Record<string, unknown>)[key];
  if (typeof val === "string" && val.trim()) return val.trim();
  if (Array.isArray(val) && val.length > 0) {
    return val
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .join(" | ") || "—";
  }
  return "—";
};

const buildConflictRows = (
  local: unknown,
  remote: unknown,
): Array<{ label: string; local: string; remote: string }> => {
  const fields: Array<[string, string]> = [
    ["Full name", "fullName"],
    ["Emails", "emailAddresses"],
    ["Phones", "phoneNumbers"],
    ["Company", "company"],
    ["Job title", "jobTitle"],
    ["Website", "website"],
    ["Birthday", "birthday"],
    ["Notes", "notes"],
  ];
  return fields
    .map(([label, key]) => ({
      label,
      local: getSnapshotText(local, key),
      remote: getSnapshotText(remote, key),
    }))
    .filter((r) => r.local !== "—" || r.remote !== "—");
};

// ── page ──────────────────────────────────────────────────────────────────────
type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SyncPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const resolvedParams = searchParams ? await searchParams : {};
  const getParam = (key: string) => {
    const v = resolvedParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const initialAccountId = getParam("account") ?? null;
  const addParam = getParam("add") === "1";
  // On mobile the clean MobileSyncScreen owns the summary; the full SyncPageClient
  // (detail / add form) only takes over the screen when a connection is selected
  // or we're adding. On desktop both rails always show.
  const mobileClientActive = Boolean(initialAccountId) || addParam;

  // Build flash message from redirect params
  const flashMsg = (() => {
    if (getParam("connected") === "1")
      return "CardDAV account connected successfully — first sync queued.";
    if (getParam("queued") === "1") return "Sync queued.";
    if (getParam("paused") === "1") return "Sync paused.";
    if (getParam("credentialsSaved") === "1") return "Credentials updated.";
    if (getParam("credentialsRevoked") === "1") return "Credentials revoked.";
    if (getParam("conflictResolved") === "1") return "Conflict resolved.";
    if (getParam("connectFailed") === "1")
      return getParam("connectError") ?? "Connection failed — check your URL and credentials.";
    if (getParam("preflightFailed") === "1")
      return "Preflight failed — check the account error state and try again.";
    return null;
  })();

  const [planSummary, familyMembership, teamMembership, incomingShares, syncErrorCount, rawAccounts] =
    await Promise.all([
      getUserPlanSummary(userId),
      getUserFamilyMembership(userId),
      getUserTeamMembership(userId),
      db.contactShare.count({
        where: {
          recipientUserId: userId,
          shareType: { in: ["STATIC_COPY", "LIVE_SYNC"] },
          status: "ACTIVE",
          recipientContactId: null,
        },
      }),
      db.syncAccount.count({ where: { userId, status: { in: ["ERROR", "NEEDS_REAUTH"] } } }),
      db.syncAccount.findMany({
        where: { userId },
        orderBy: [{ updatedAt: "desc" }],
        include: {
          syncJobs: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              status: true,
              syncDirection: true,
              errorCode: true,
              errorSummary: true,
              createdCount: true,
              updatedCount: true,
              deletedCount: true,
              createdAt: true,
              completedAt: true,
              startedAt: true,
            },
          },
          syncConflicts: {
            where: { status: "OPEN" },
            orderBy: { detectedAt: "desc" },
            take: 10,
            include: {
              contact: { select: { id: true, fullName: true } },
            },
          },
          // P23-02: per-connection advanced settings for the edit drawer.
          settings: {
            select: {
              syncDirection: true,
              conflictPolicy: true,
              syncFrequencyMinutes: true,
              bookAllowlist: true,
            },
          },
        },
      }),
    ]);

  // Serialise to plain data for client component
  const accounts: SyncAccountData[] = rawAccounts.map((acct) => {
    const recentJobs = acct.syncJobs.map((j) => ({
      status: j.status,
      errorCode: j.errorCode,
    }));

    const health = getSyncAccountOperationalHealth({
      status: acct.status,
      lastErrorCode: acct.lastErrorCode,
      recentJobs,
    });

    const jobs: SyncJobRow[] = acct.syncJobs.map((j) => ({
      id: j.id,
      when: formatJobTimestamp(j.completedAt ?? j.startedAt ?? j.createdAt),
      direction: j.syncDirection,
      added: j.createdCount,
      modified: j.updatedCount,
      deleted: j.deletedCount,
      status: j.status === "SUCCEEDED" || j.status === "PARTIAL" ? "ok" : "fail",
      error: j.errorSummary ?? null,
    }));

    const conflicts: SyncConflictData[] = acct.syncConflicts.map((cf) => ({
      id: cf.id,
      contactName: cf.contact?.fullName ?? "Unknown contact",
      field: cf.conflictType.toLowerCase().replace(/_/g, " "),
      date: formatJobTimestamp(cf.detectedAt),
      comparisonRows: buildConflictRows(cf.localSnapshot, cf.remoteSnapshot),
    }));

    return {
      id: acct.id,
      label: acct.label,
      baseUrl: acct.baseUrl,
      // P23-02: settings.syncDirection is the canonical home; fall back to the
      // SyncAccount column when no settings row exists yet.
      direction: acct.settings?.syncDirection ?? acct.syncDirection,
      conflictPolicy: acct.settings?.conflictPolicy ?? "SERVER_WINS",
      syncFrequencyMinutes: acct.settings?.syncFrequencyMinutes ?? null,
      bookAllowlist: acct.settings?.bookAllowlist ?? [],
      status: acct.status,
      health,
      lastSyncedAtRelative: formatRelative(acct.lastSyncedAt),
      lastErrorMessage: acct.lastErrorMessage ?? null,
      consecutiveFailures: getConsecutiveFailureStreak(recentJobs),
      // P23-05: surface the conflict-queue-full auto-pause to the detail panel.
      conflictQueueFull:
        acct.status === "PAUSED" && acct.lastErrorCode === "SYNC_CONFLICT_QUEUE_FULL",
      jobs,
      conflicts,
    };
  });

  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  const shared: Array<{ id: "family" | "teams"; label: string; icon: string }> = [];
  if (familyMembership || planSummary.plan === "FAMILY") {
    shared.push({ id: "family", label: "Family management", icon: "users" });
  }
  if (teamMembership || planSummary.plan === "TEAMS") {
    shared.push({ id: "teams", label: "Team management", icon: "team" });
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#f6f7f4]" style={{ fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif" }}>
      {/* ── Desktop header — hidden on mobile ── */}
      <header className="hidden shrink-0 border-b border-[#d8ddd6] bg-white md:block" style={{ zIndex: 20 }}>
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
            <Link
              aria-label={incomingShares > 0 ? `${incomingShares} pending shares` : "Notifications"}
              className="relative hidden h-10 w-10 items-center justify-center rounded-full border border-[#d8ddd6] bg-white text-[#5c655e] transition hover:bg-[#f2f4f0] sm:inline-flex"
              href="/shares"
            >
              <WorkspaceIcon name="bell" size={18} />
              {incomingShares > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#bf8526] px-1 text-[10px] font-bold text-white">
                  {incomingShares}
                </span>
              ) : null}
            </Link>
            <UserMenu
              email={session.user.email ?? ""}
              initials={getInitials(userLabel)}
              name={userLabel}
            />
          </div>
        </div>
      </header>

      {/* ── Mobile header — "Sync" title, shown only on mobile (P24B-01) ── */}
      <MobilePlainHeader title="Sync" bell={<NotificationBellSlot userId={userId} />} />

      {/* ── three-rail body ── */}
      <div className="flex min-h-0 flex-1">
        {/* Rail 1: Settings sidebar — hidden on mobile */}
        <div className="hidden md:flex">
          <SettingsSidebar
            account={{ name: userLabel, email: session.user.email ?? "", plan: planSummary.planLabel }}
            shared={shared}
          />
        </div>

        {/* Mobile summary — clean connection cards (md:hidden), suppressed once
            a connection/add takes over via SyncPageClient. */}
        <MobileSyncScreen accounts={accounts} hidden={mobileClientActive} />

        {/* Rails 2+3: account list + detail (client-managed). Desktop always
            shows it; mobile only when a connection is selected or adding. */}
        <div className={`min-w-0 flex-1 ${mobileClientActive ? "flex" : "hidden md:flex"}`}>
          <SyncPageClient
            accounts={accounts}
            initialAccountId={initialAccountId}
            initialAdd={addParam}
            flash={flashMsg}
          />
        </div>
      </div>

      <BottomNav syncErrorCount={syncErrorCount} />
    </div>
  );
}
