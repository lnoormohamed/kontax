import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BottomNav } from "~/app/_components/bottom-nav";
import { ConnectionBanner, OfflineChip } from "~/app/_components/connection-banner";
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
import { SYNC_ACCOUNT_HISTORICAL_STATUSES } from "~/lib/sync-account-status";
import { summarizeProjection } from "~/lib/projection-preview";
import {
  getConsecutiveFailureStreak,
  getSyncAccountOperationalHealth,
} from "~/server/sync-health";
import {
  coerceCardDavCapabilityProfileOverrideId,
  describeProviderFieldFamilies,
  getSyncProviderCapabilityProfileLabel,
  getProviderCapabilityNotice,
  resolveSyncProviderCapabilityProfile,
} from "~/server/sync-provider-capabilities";
import {
  formatProviderIdentitySecondaryText,
  resolveSyncProviderIdentity,
} from "~/server/sync-provider-identity";
import {
  SyncPageClient,
  type SyncAccountData,
  type SyncJobRow,
  type SyncConflictData,
} from "./_components/sync-page-client";
import { MobileSyncScreen } from "./_components/mobile-sync-screen";

// P27-07: friendly messages for OAuth callback `?error=` codes (Google/Microsoft).
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google connection cancelled — access wasn't granted.",
  google_invalid: "Google connection failed — the response was invalid. Please try again.",
  google_state: "Google connection expired — please try connecting again.",
  google_token: "Couldn't complete the Google connection. Please try again.",
  google_duplicate: "That Google account looks already connected.",
  google_cap: "You've reached the sync-account limit for your plan.",
  google_unconfigured: "Google sync isn't configured on this server.",
  microsoft_denied: "Outlook connection cancelled — access wasn't granted.",
  microsoft_invalid: "Outlook connection failed — the response was invalid. Please try again.",
  microsoft_state: "Outlook connection expired — please try connecting again.",
  microsoft_token: "Couldn't complete the Outlook connection. Please try again.",
  microsoft_duplicate: "That Outlook account looks already connected.",
  microsoft_cap: "You've reached the sync-account limit for your plan.",
  microsoft_unconfigured: "Outlook sync isn't configured on this server.",
};

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

const getSyncHelpHref = (account: {
  provider: "CARDDAV" | "GOOGLE" | "MICROSOFT";
  providerBrandKey: string | null;
}) => {
  if (account.provider === "GOOGLE") return "/help#provider-google";
  if (account.provider === "MICROSOFT") return "/help#provider-microsoft";
  switch (account.providerBrandKey) {
    case "icloud":
      return "/help#provider-icloud";
    case "fastmail":
      return "/help#provider-fastmail";
    case "nextcloud":
      return "/help#provider-carddav";
    default:
      return "/help#provider-carddav";
  }
};

const isSuccessfulJob = (status: string) =>
  status === "SUCCEEDED" || status === "PARTIAL";

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
  if (!session?.user?.id) {
    const h = await headers();
    const next = h.get("x-pathname") ?? "/sync";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
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
    // P27-07: OAuth connect outcomes (callbacks redirect here).
    if (getParam("connected") === "google")
      return "Google Contacts connected — importing your contacts now.";
    if (getParam("connected") === "microsoft")
      return "Outlook connected — importing your contacts now.";
    if (getParam("queued") === "1") return "Sync queued.";
    if (getParam("paused") === "1") return "Sync paused.";
    if (getParam("credentialsSaved") === "1") return "Credentials updated.";
    if (getParam("credentialsRevoked") === "1") return "Credentials revoked.";
    if (getParam("conflictResolved") === "1") return "Conflict resolved.";
    if (getParam("connectFailed") === "1")
      return getParam("connectError") ?? "Connection failed — check your URL and credentials.";
    if (getParam("preflightFailed") === "1")
      return "Preflight failed — check the account error state and try again.";
    const err = getParam("error");
    if (err) return OAUTH_ERROR_MESSAGES[err] ?? "Connection failed. Please try again.";
    return null;
  })();

  const [planSummary, familyMembership, teamMembership, incomingShares, syncErrorCount, labels, projectionBooks, rawAccounts, rawPastAccounts] =
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
      // P36: the user's labels power the auto-label-on-import and export-filter pickers.
      db.label.findMany({
        where: { userId },
        orderBy: { position: "asc" },
        select: { id: true, name: true, color: true },
      }),
      // P41-DB01: the user's personal books power the projection-scope picker and
      // the book-first rail grouping. Default (home) book first, then by name.
      // Archived books are included so a connection still pointing at one resolves
      // to the "misconfigured" state (with its name); they're filtered out of the
      // selectable picker below.
      db.addressBook.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true, isDefault: true, archivedAt: true },
      }),
      db.syncAccount.findMany({
        // Historical rows are preserved for reconnect/support flows but stay off
        // the active rail.
        where: { userId, status: { notIn: [...SYNC_ACCOUNT_HISTORICAL_STATUSES] } },
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
              pushedCreatedCount: true,
              pushedUpdatedCount: true,
              pushedDeletedCount: true,
              duplicatesDetectedCount: true,
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
          // P23-02 / P36: per-connection advanced settings for the edit drawer.
          settings: {
            select: {
              syncDirection: true,
              conflictPolicy: true,
              capabilityProfileOverride: true,
              syncFrequencyMinutes: true,
              bookAllowlist: true,
              importLabelId: true,
              maxDeletionsThreshold: true,
              notifyOnFailure: true,
              syncWindowStart: true,
              syncWindowEnd: true,
              syncWindowTimezone: true,
              excludedFields: true,
              exportLabelFilter: true,
              maxAttemptsBeforePause: true,
              // P41-DB01 projection config.
              projectionBookIds: true,
              fieldPrecedence: true,
              autolinkCaveatDismissedAt: true,
              conflictOverride: true,
            },
          },
          replacesSyncAccount: {
            select: { id: true, label: true, status: true },
          },
          replacedBySyncAccount: {
            select: { id: true, label: true, status: true },
          },
        },
      }),
      db.syncAccount.findMany({
        where: { userId, status: "RETIRED" },
        orderBy: [{ retiredAt: "desc" }, { updatedAt: "desc" }],
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
              pushedCreatedCount: true,
              pushedUpdatedCount: true,
              pushedDeletedCount: true,
              duplicatesDetectedCount: true,
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
          settings: {
            select: {
              syncDirection: true,
              conflictPolicy: true,
              capabilityProfileOverride: true,
              syncFrequencyMinutes: true,
              bookAllowlist: true,
              importLabelId: true,
              maxDeletionsThreshold: true,
              notifyOnFailure: true,
              syncWindowStart: true,
              syncWindowEnd: true,
              syncWindowTimezone: true,
              excludedFields: true,
              exportLabelFilter: true,
              maxAttemptsBeforePause: true,
              // P41-DB01 projection config.
              projectionBookIds: true,
              fieldPrecedence: true,
              autolinkCaveatDismissedAt: true,
              conflictOverride: true,
            },
          },
          replacesSyncAccount: {
            select: { id: true, label: true, status: true },
          },
          replacedBySyncAccount: {
            select: { id: true, label: true, status: true },
          },
        },
      }),
    ]);

  // P41-DB01: resolve projection book ids → display data. `books` is the user's
  // non-archived personal books; the account may still reference a book id that
  // was deleted (the "misconfigured" row state).
  const bookById = new Map(projectionBooks.map((b) => [b.id, b]));
  // Selectable books for the projection picker exclude archived ones.
  const selectableBooks = projectionBooks.filter((b) => b.archivedAt == null);
  const hasBookModel = selectableBooks.length > 0;

  const serialiseSyncAccount = (acct: (typeof rawAccounts)[number]): SyncAccountData => {
    const capabilityProfile = resolveSyncProviderCapabilityProfile({
      provider: acct.provider,
      baseUrl: acct.baseUrl,
      addressBookUrl: acct.addressBookUrl,
      label: acct.label,
      capabilityProfileOverride: acct.settings?.capabilityProfileOverride ?? null,
    });
    const providerIdentity = resolveSyncProviderIdentity({
      provider: acct.provider,
      baseUrl: acct.baseUrl,
      addressBookUrl: acct.addressBookUrl,
      label: acct.label,
    });
    const capabilityNotice = getProviderCapabilityNotice(capabilityProfile);
    const fieldSupport = describeProviderFieldFamilies(capabilityProfile);
    const recentJobs = acct.syncJobs.map((j) => ({
      status: j.status,
      errorCode: j.errorCode,
    }));
    const completedJobs = acct.syncJobs
      .filter((job) => isSuccessfulJob(job.status))
      .sort(
        (left, right) =>
          (right.completedAt ?? right.startedAt ?? right.createdAt).getTime() -
          (left.completedAt ?? left.startedAt ?? left.createdAt).getTime(),
      );
    const lastSuccessfulJob = completedJobs[0] ?? null;
    const lastInboundActivityJob =
      completedJobs.find(
        (job) => job.createdCount + job.updatedCount + job.deletedCount > 0,
      ) ?? null;
    const lastOutboundActivityJob =
      completedJobs.find(
        (job) =>
          job.pushedCreatedCount + job.pushedUpdatedCount + job.pushedDeletedCount > 0,
      ) ?? null;
    const health = getSyncAccountOperationalHealth({
      status: acct.status,
      lastErrorCode: acct.lastErrorCode,
      recentJobs,
    });

    const diagnosticsWarnings: string[] = [];
    if (acct.status === "NEEDS_REAUTH") {
      diagnosticsWarnings.push(
        "This connection needs you to sign in again before sync can continue.",
      );
    } else if (
      acct.status === "PAUSED" &&
      acct.lastErrorCode === "SYNC_CONFLICT_QUEUE_FULL"
    ) {
      diagnosticsWarnings.push(
        "Kontax paused this connection because the manual conflict queue is full.",
      );
    } else if (
      acct.status === "PAUSED" &&
      acct.lastErrorCode === "DELETION_THRESHOLD_EXCEEDED"
    ) {
      diagnosticsWarnings.push(
        "Kontax paused this connection before committing deletions that exceeded your safety limit. Review and resume from the connection detail.",
      );
    } else if (health === "paused_for_safety") {
      diagnosticsWarnings.push(
        "Kontax paused this connection after repeated failures so it does not keep retrying unattended.",
      );
    } else if (acct.status === "ERROR" && acct.lastErrorMessage) {
      diagnosticsWarnings.push(acct.lastErrorMessage);
    } else if (acct.status === "PAUSED") {
      diagnosticsWarnings.push(
        "This connection is paused. Resume it when you're ready for sync to continue.",
      );
    }

    if (capabilityProfile.fields.significantDates === "none") {
      diagnosticsWarnings.push(
        "Additional dates such as anniversaries and lunar birthdays stay in Kontax and in providers that support them.",
      );
    }

    const jobs: SyncJobRow[] = acct.syncJobs.map((j) => ({
      id: j.id,
      when: (j.completedAt ?? j.startedAt ?? j.createdAt).toISOString(),
      direction: j.syncDirection,
      added: j.createdCount,
      modified: j.updatedCount,
      deleted: j.deletedCount,
      pushedAdded: j.pushedCreatedCount,
      pushedModified: j.pushedUpdatedCount,
      pushedDeleted: j.pushedDeletedCount,
      status:
        j.status === "SUCCEEDED" || j.status === "PARTIAL"
          ? "ok"
          : j.status === "QUEUED" || j.status === "RUNNING"
            ? "pending"
            : j.status === "SKIPPED"
              ? "skipped"
              : j.status === "HALTED"
                ? "halted"
                : "fail",
      error: j.errorSummary ?? null,
    }));

    const conflicts: SyncConflictData[] = acct.syncConflicts.map((cf) => ({
      id: cf.id,
      contactName: cf.contact?.fullName ?? "Unknown contact",
      field: cf.conflictType.toLowerCase().replace(/_/g, " "),
      date: cf.detectedAt.toISOString(),
      comparisonRows: buildConflictRows(cf.localSnapshot, cf.remoteSnapshot),
    }));

    // ── P41-DB01: resolve this connection's projection view ──────────────────
    // The projected set is the explicit projectionBookIds if configured, else it
    // falls back to the single destination book. Empty on both = V1-only.
    const rawProjectionIds = acct.settings?.projectionBookIds ?? [];
    const destinationId = acct.destinationBookId ?? null;
    const destinationBook = destinationId ? bookById.get(destinationId) ?? null : null;
    // Misconfigured = the destination book exists but was archived out from under
    // the connection (the FK is SetNull on delete, so an id that still resolves to
    // an archived book is the real "book was removed" case).
    const destinationBookMissing =
      destinationId != null && (destinationBook == null || destinationBook.archivedAt != null);

    const projectedIds = rawProjectionIds.length > 0
      ? rawProjectionIds
      : destinationId
        ? [destinationId]
        : [];
    const projectedBooks = projectedIds
      .map((id) => bookById.get(id))
      .filter((b): b is NonNullable<typeof b> => b != null && b.archivedAt == null);
    const projectionBookNames = projectedBooks.map((b) => b.name);
    const projectionBookSlugs = projectedBooks.map((b) => b.slug);
    const fieldPrecedence = (acct.settings?.fieldPrecedence ?? null) as
      | "work"
      | "personal"
      | null;

    const projectionRowState: SyncAccountData["projectionRowState"] = destinationBookMissing
      ? "misconfigured"
      : projectedBooks.length === 0
        ? "v1-only"
        : projectedBooks.length > 1
          ? "multi-book"
          : "single-book";

    const projectionSummary = summarizeProjection({
      bookNames: projectionBookNames,
      precedence: fieldPrecedence,
      v1Only: projectionRowState === "v1-only",
      exportOnly: (acct.settings?.syncDirection ?? acct.syncDirection) === "EXPORT_ONLY",
    });

    // P27-07: OAuth providers (Google/Microsoft) show a connected email + token
    // status instead of a server URL + credentials form.
    const isOAuth = acct.provider === "GOOGLE" || acct.provider === "MICROSOFT";
    return {
      id: acct.id,
      label: acct.label,
      baseUrl: acct.baseUrl,
      connectionId: acct.connectionId,
      provider: acct.provider,
      providerDisplayName: providerIdentity.providerDisplayName,
      providerHost: providerIdentity.providerHost,
      providerVerificationState: providerIdentity.providerVerificationState,
      providerBrandKey: providerIdentity.providerBrandKey,
      providerDetectionSource: providerIdentity.detectionSource,
      providerSecondaryText: formatProviderIdentitySecondaryText(providerIdentity),
      diagnosticsHelpHref: getSyncHelpHref({
        provider: acct.provider,
        providerBrandKey: providerIdentity.providerBrandKey,
      }),
      // OAuth: the connected provider account email (stored at connect time).
      connectedEmail: isOAuth ? acct.remoteAccountId : null,
      scope: isOAuth ? "Contacts (read & write)" : null,
      tokenStatus: isOAuth
        ? acct.status === "NEEDS_REAUTH"
          ? "expired"
          : "valid"
        : null,
      lastRefreshedRelative: isOAuth
        ? formatRelative(acct.credentialLastValidatedAt ?? acct.credentialUpdatedAt)
        : null,
      lastErrorCode: acct.lastErrorCode ?? null,
      // P23-02: settings.syncDirection is the canonical home; fall back to the
      // SyncAccount column when no settings row exists yet.
      direction: acct.settings?.syncDirection ?? acct.syncDirection,
      conflictPolicy: acct.settings?.conflictPolicy ?? "SERVER_WINS",
      capabilityProfileOverride: coerceCardDavCapabilityProfileOverrideId(
        acct.settings?.capabilityProfileOverride ?? null,
      ),
      capabilityProfileLabel: getSyncProviderCapabilityProfileLabel(
        capabilityProfile,
      ),
      syncFrequencyMinutes: acct.settings?.syncFrequencyMinutes ?? null,
      bookAllowlist: acct.settings?.bookAllowlist ?? [],
      // P41-DB01 projection config (resolved).
      destinationBookId: destinationId,
      destinationBookName: destinationBook && destinationBook.archivedAt == null ? destinationBook.name : null,
      destinationBookMissingName: destinationBookMissing ? destinationBook?.name ?? "this book" : null,
      projectionBookIds: projectedIds,
      projectionBookNames,
      projectionBookSlugs,
      projectionSharedBook: projectedBooks.some((b) => "shared" in b && (b as { shared?: boolean }).shared === true),
      fieldPrecedence,
      autolinkCaveatDismissed: acct.settings?.autolinkCaveatDismissedAt != null,
      conflictOverride: (acct.settings?.conflictOverride ?? null) as SyncAccountData["conflictOverride"],
      projectionRowState,
      projectionSummary,
      // P36 advanced settings (fall back to column defaults when no row exists).
      importLabelId: acct.settings?.importLabelId ?? null,
      maxDeletionsThreshold: acct.settings?.maxDeletionsThreshold ?? null,
      notifyOnFailure: acct.settings?.notifyOnFailure ?? true,
      syncWindowStart: acct.settings?.syncWindowStart ?? null,
      syncWindowEnd: acct.settings?.syncWindowEnd ?? null,
      syncWindowTimezone: acct.settings?.syncWindowTimezone ?? null,
      excludedFields: acct.settings?.excludedFields ?? [],
      exportLabelFilter: acct.settings?.exportLabelFilter ?? [],
      maxAttemptsBeforePause: acct.settings?.maxAttemptsBeforePause ?? null,
      // P36-DB02: setup is pending until completeSyncSetup stamps setupCompletedAt.
      needsSetup: acct.setupCompletedAt == null,
      createdAt: acct.createdAt.toISOString(),
      disconnectedAt: acct.disconnectedAt?.toISOString() ?? null,
      retiredAt: acct.retiredAt?.toISOString() ?? null,
      replacesSyncAccountId: acct.replacesSyncAccountId,
      replacesSyncAccountLabel: acct.replacesSyncAccount?.label ?? null,
      replacedBySyncAccountId: acct.replacedBySyncAccountId,
      replacedBySyncAccountLabel: acct.replacedBySyncAccount?.label ?? null,
      status: acct.status,
      health,
      lastSyncedAtRelative: formatRelative(acct.lastSyncedAt),
      lastErrorMessage: acct.lastErrorMessage ?? null,
      capabilityNoteTitle: capabilityNotice?.title ?? null,
      capabilityNoteBody: capabilityNotice?.body ?? null,
      capabilityUnsupportedFieldFamilies:
        capabilityNotice?.unsupportedFieldFamilies ?? [],
      diagnosticsFieldSupport: fieldSupport,
      diagnosticsWarnings,
      lastSuccessfulJobRelative: formatRelative(
        lastSuccessfulJob
          ? lastSuccessfulJob.completedAt ??
              lastSuccessfulJob.startedAt ??
              lastSuccessfulJob.createdAt
          : null,
      ),
      lastInboundActivityRelative: formatRelative(
        lastInboundActivityJob
          ? lastInboundActivityJob.completedAt ??
              lastInboundActivityJob.startedAt ??
              lastInboundActivityJob.createdAt
          : null,
      ),
      lastOutboundActivityRelative: formatRelative(
        lastOutboundActivityJob
          ? lastOutboundActivityJob.completedAt ??
              lastOutboundActivityJob.startedAt ??
              lastOutboundActivityJob.createdAt
          : null,
      ),
      consecutiveFailures: getConsecutiveFailureStreak(recentJobs),
      // P23-05: surface the conflict-queue-full auto-pause to the detail panel.
      conflictQueueFull:
        acct.status === "PAUSED" && acct.lastErrorCode === "SYNC_CONFLICT_QUEUE_FULL",
      // P39-02: deletion-safety hold summary for the paused-for-review surface.
      // The review card fetches the full breakdown via getDeletionHoldReview.
      deletionHoldTotal:
        acct.status === "PAUSED" && acct.lastErrorCode === "DELETION_THRESHOLD_EXCEEDED"
          ? ((acct.deletionHold as { total?: number } | null)?.total ?? null)
          : null,
      deletionHoldThreshold:
        acct.status === "PAUSED" && acct.lastErrorCode === "DELETION_THRESHOLD_EXCEEDED"
          ? ((acct.deletionHold as { threshold?: number } | null)?.threshold ?? null)
          : null,
      // P27-08: duplicates found by the most recently *completed* import (0 hides
      // the banner). Pick by latest completedAt, not list order (a job can finish
      // out of creation order).
      duplicatesDetected:
        acct.syncJobs
          .filter((j) => j.completedAt)
          .sort((a, b) => (b.completedAt!.getTime() ?? 0) - (a.completedAt!.getTime() ?? 0))[0]
          ?.duplicatesDetectedCount ?? 0,
      jobs,
      conflicts,
    };
  };

  // Serialise to plain data for client component
  const accounts: SyncAccountData[] = rawAccounts.map(serialiseSyncAccount);
  const pastAccounts: SyncAccountData[] = rawPastAccounts.map(serialiseSyncAccount);

  // P41-DB01: selectable books for the projection-scope picker + rail grouping.
  const bookOptions = selectableBooks.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    isDefault: b.isDefault,
  }));

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
          <Link className="flex shrink-0 items-center gap-2.5 lg:w-[230px]" href="/contacts?tab=overview">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#17352e] text-[17px] font-bold text-[#dff0e7]">
              K
            </span>
            <span className="text-[19px] font-bold tracking-[-0.01em] text-[#1d2823]">Kontax</span>
          </Link>

          <SearchInput filter="all" initialQuery="" sort="name" tab="people" view="compact" />

          <div className="flex shrink-0 items-center gap-2.5">
            {/* P42-DB01 §3b: offline persists as a chip while account-state owns the slot */}
            <OfflineChip readOnly={!planSummary.lifecyclePolicy.canWrite} />
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

      {/* P42-DB01: single banner slot — replaces the mobile sync screen's
          hard-coded read-only/offline either/or with the fixed priority rule. */}
      <ConnectionBanner
        readOnly={!planSummary.lifecyclePolicy.canWrite}
        readOnlyVariant={planSummary.lifecyclePolicy.label === "Grace" ? "grace" : "locked"}
      />

      {/* ── three-rail body ── */}
      <div className="flex min-h-0 flex-1">
        {/* Rail 1: Settings sidebar — hidden on mobile and tablet */}
        <div className="hidden lg:flex">
          <SettingsSidebar
            account={{ name: userLabel, email: session.user.email ?? "", plan: planSummary.planLabel }}
            shared={shared}
          />
        </div>

        {/* Mobile summary — clean connection cards (md:hidden), suppressed once
            a connection/add takes over via SyncPageClient. */}
        <MobileSyncScreen
          accounts={accounts}
          books={bookOptions}
          hasBookModel={hasBookModel}
          hidden={mobileClientActive}
          cardDavEnabled={planSummary.entitlements.cardDavSyncEnabled}
          syncAccountsLimit={planSummary.entitlements.syncAccountsLimit}
          canWrite={planSummary.lifecyclePolicy.canWrite}
          planLabel={planSummary.planLabel}
          upgradeableAtCap={planSummary.plan === "FREE"}
        />

        {/* Rails 2+3: account list + detail (client-managed). Desktop always
            shows it; mobile only when a connection is selected or adding. */}
        <div className={`min-w-0 flex-1 ${mobileClientActive ? "flex flex-col lg:flex-row" : "hidden md:flex md:flex-col lg:flex-row"}`}>
          {/* Key on the deep-link target so a mobile nav (summary → connection →
              back → Add) remounts the client with fresh view state. Next's client
              Router Cache doesn't key /sync by searchParams, so without this the
              stale view (e.g. the last connection's detail) is shown until a hard
              refresh. Desktop selection is internal state (URL stays /sync), so
              the key is stable there and the rail keeps working without remounts. */}
          <SyncPageClient
            key={addParam ? "add" : initialAccountId ? `account-${initialAccountId}` : "summary"}
            accounts={accounts}
            pastAccounts={pastAccounts}
            labels={labels}
            books={bookOptions}
            hasBookModel={hasBookModel}
            initialAccountId={initialAccountId}
            initialAdd={addParam}
            flash={flashMsg}
            syncAccountsLimit={planSummary.entitlements.syncAccountsLimit}
            upgradeableAtCap={planSummary.plan === "FREE"}
          />
        </div>
      </div>

      <BottomNav syncErrorCount={syncErrorCount} />
    </div>
  );
}
