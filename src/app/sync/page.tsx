import Link from "next/link";
import { redirect } from "next/navigation";

import {
  activateSyncAccount,
  attachSyncCredentials,
  createSyncAccount,
  pauseSyncAccount,
  prepareSyncRelink,
  queueSyncJob,
  revokeSyncCredentials,
  resolveSyncConflict,
  retrySyncJob,
} from "~/app/actions/sync";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";
import { getSyncCredentialEncryptionStatus } from "~/server/sync-credentials";

type SyncPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const formatTimestamp = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(value)
    : "Not yet";

const getSearchValue = (
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) => {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
};

const getEncryptionModeLabel = (mode: "dedicated" | "auth-secret-fallback" | "missing") => {
  switch (mode) {
    case "dedicated":
      return "Dedicated sync key";
    case "auth-secret-fallback":
      return "AUTH_SECRET fallback";
    default:
      return "Not configured";
  }
};

const getCredentialStateLabel = (account: {
  credentialReference: string | null;
  credentialRevokedAt: Date | null;
}) => {
  if (!account.credentialReference) {
    return "Missing";
  }

  if (account.credentialRevokedAt) {
    return "Revoked";
  }

  return "Active";
};

const getConnectionValidationLabel = (account: {
  credentialReference: string | null;
  credentialUpdatedAt: Date | null;
  credentialLastValidatedAt: Date | null;
  credentialRevokedAt: Date | null;
  connectionValidatedAt: Date | null;
}) => {
  if (!account.credentialReference) {
    return "Pending credentials";
  }

  if (account.credentialRevokedAt) {
    return "Credentials revoked";
  }

  if (!account.credentialLastValidatedAt || !account.connectionValidatedAt) {
    return "Validation required";
  }

  if (
    account.credentialUpdatedAt &&
    account.credentialLastValidatedAt.getTime() < account.credentialUpdatedAt.getTime()
  ) {
    return "Revalidation required";
  }

  return "Validated";
};

const getJobFailureClass = (errorCode: string | null) => {
  if (!errorCode) {
    return "none";
  }

  if (errorCode.includes("CREDENTIAL")) {
    return "authentication";
  }

  if (errorCode.includes("RATE")) {
    return "rate-limit";
  }

  if (errorCode.includes("CONFLICT")) {
    return "conflict";
  }

  if (errorCode.includes("NETWORK") || errorCode.includes("TIMEOUT")) {
    return "connectivity";
  }

  return "protocol-or-data";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getSnapshotStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

const getSnapshotAddressArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .flatMap((item) => {
          if (!isRecord(item)) {
            return [];
          }

          const formatted = item.formatted;
          return typeof formatted === "string" && formatted.trim().length > 0 ? [formatted] : [];
        })
        .filter(Boolean)
    : [];

const normalizeSnapshotText = (value: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "—";
};

const getConflictSnapshotView = (snapshot: unknown) => {
  if (!isRecord(snapshot)) {
    return null;
  }

  const emailValues = getSnapshotStringArray(snapshot.emailAddresses);
  const phoneValues = getSnapshotStringArray(snapshot.phoneNumbers);
  const addressValues = getSnapshotAddressArray(snapshot.postalAddresses);
  const deleted = snapshot.deleted === true;

  return {
    fullName:
      typeof snapshot.fullName === "string" && snapshot.fullName.trim().length > 0
        ? snapshot.fullName
        : "—",
    emails:
      emailValues.length > 0
        ? emailValues.join(" | ")
        : typeof snapshot.email === "string" && snapshot.email.trim().length > 0
          ? snapshot.email
          : "—",
    phones:
      phoneValues.length > 0
        ? phoneValues.join(" | ")
        : typeof snapshot.phone === "string" && snapshot.phone.trim().length > 0
          ? snapshot.phone
          : "—",
    company:
      typeof snapshot.company === "string" && snapshot.company.trim().length > 0
        ? snapshot.company
        : "—",
    jobTitle:
      typeof snapshot.jobTitle === "string" && snapshot.jobTitle.trim().length > 0
        ? snapshot.jobTitle
        : "—",
    website:
      typeof snapshot.website === "string" && snapshot.website.trim().length > 0
        ? snapshot.website
        : "—",
    birthday:
      typeof snapshot.birthday === "string" && snapshot.birthday.trim().length > 0
        ? snapshot.birthday
        : "—",
    address:
      addressValues.length > 0
        ? addressValues.join(" | ")
        : typeof snapshot.address === "string" && snapshot.address.trim().length > 0
          ? snapshot.address
          : "—",
    notes:
      typeof snapshot.notes === "string" && snapshot.notes.trim().length > 0
        ? snapshot.notes
        : "—",
    deleted,
  };
};

const getConflictComparisonRows = (localSnapshot: unknown, remoteSnapshot: unknown) => {
  const local = getConflictSnapshotView(localSnapshot);
  const remote = getConflictSnapshotView(remoteSnapshot);

  if (!local && !remote) {
    return [];
  }

  const rows = [
    {
      label: "Full name",
      local: normalizeSnapshotText(local?.fullName ?? null),
      remote: normalizeSnapshotText(remote?.fullName ?? null),
    },
    {
      label: "Emails",
      local: normalizeSnapshotText(local?.emails ?? null),
      remote: normalizeSnapshotText(remote?.emails ?? null),
    },
    {
      label: "Phones",
      local: normalizeSnapshotText(local?.phones ?? null),
      remote: normalizeSnapshotText(remote?.phones ?? null),
    },
    {
      label: "Company",
      local: normalizeSnapshotText(local?.company ?? null),
      remote: normalizeSnapshotText(remote?.company ?? null),
    },
    {
      label: "Job title",
      local: normalizeSnapshotText(local?.jobTitle ?? null),
      remote: normalizeSnapshotText(remote?.jobTitle ?? null),
    },
    {
      label: "Website",
      local: normalizeSnapshotText(local?.website ?? null),
      remote: normalizeSnapshotText(remote?.website ?? null),
    },
    {
      label: "Birthday",
      local: normalizeSnapshotText(local?.birthday ?? null),
      remote: normalizeSnapshotText(remote?.birthday ?? null),
    },
    {
      label: "Address",
      local: normalizeSnapshotText(local?.address ?? null),
      remote: normalizeSnapshotText(remote?.address ?? null),
    },
    {
      label: "Notes",
      local: normalizeSnapshotText(local?.notes ?? null),
      remote: normalizeSnapshotText(remote?.notes ?? null),
    },
    {
      label: "Remote delete intent",
      local: local?.deleted ? "Local tombstone" : "Local still active",
      remote: remote?.deleted ? "Remote missing / deleted" : "Remote still active",
    },
  ];

  return rows.filter(
    (row) => row.local !== "—" || row.remote !== "—" || row.label === "Remote delete intent",
  );
};

const getSnapshotScalarValue = (snapshot: unknown, key: string) => {
  if (!isRecord(snapshot)) {
    return null;
  }

  const value = snapshot[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const mergeDisplayList = (values: string[]) => {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(normalized);
  }

  return merged;
};

const getManualMergePreview = (localSnapshot: unknown, remoteSnapshot: unknown) => {
  const localView = getConflictSnapshotView(localSnapshot);
  const remoteView = getConflictSnapshotView(remoteSnapshot);

  const fullName =
    getSnapshotScalarValue(localSnapshot, "fullName") ??
    getSnapshotScalarValue(remoteSnapshot, "fullName") ??
    "—";
  const emails = mergeDisplayList(
    [localView?.emails, remoteView?.emails]
      .flatMap((value) => (value && value !== "—" ? value.split("|") : []))
      .map((value) => value.trim()),
  );
  const phones = mergeDisplayList(
    [localView?.phones, remoteView?.phones]
      .flatMap((value) => (value && value !== "—" ? value.split("|") : []))
      .map((value) => value.trim()),
  );
  const address =
    localView?.address && localView.address !== "—"
      ? localView.address
      : remoteView?.address ?? "—";
  const company =
    getSnapshotScalarValue(localSnapshot, "company") ??
    getSnapshotScalarValue(remoteSnapshot, "company") ??
    "—";
  const jobTitle =
    getSnapshotScalarValue(localSnapshot, "jobTitle") ??
    getSnapshotScalarValue(remoteSnapshot, "jobTitle") ??
    "—";
  const website =
    getSnapshotScalarValue(localSnapshot, "website") ??
    getSnapshotScalarValue(remoteSnapshot, "website") ??
    "—";
  const birthday =
    getSnapshotScalarValue(localSnapshot, "birthday") ??
    getSnapshotScalarValue(remoteSnapshot, "birthday") ??
    "—";
  const notesLocal = getSnapshotScalarValue(localSnapshot, "notes");
  const notesRemote = getSnapshotScalarValue(remoteSnapshot, "notes");
  const notes =
    notesLocal && notesRemote && notesLocal !== notesRemote
      ? `${notesLocal} | Remote note: ${notesRemote}`
      : notesLocal ?? notesRemote ?? "—";

  return [
    { label: "Full name", value: fullName },
    { label: "Emails", value: emails.length > 0 ? emails.join(" | ") : "—" },
    { label: "Phones", value: phones.length > 0 ? phones.join(" | ") : "—" },
    { label: "Company", value: company },
    { label: "Job title", value: jobTitle },
    { label: "Website", value: website },
    { label: "Birthday", value: birthday },
    { label: "Address", value: address },
    { label: "Notes", value: notes },
  ];
};

const getResolutionGuidance = (strategy: string) => {
  switch (strategy) {
    case "KEEP_LOCAL":
      return "Push the current Kontax version back to CardDAV and treat local as the trusted winner.";
    case "KEEP_REMOTE":
      return "Replace the local record with the remote CardDAV version and preserve sync linkage.";
    case "DUPLICATE_LOCAL":
      return "Keep a duplicate of the current local record, then let the linked record take the remote version.";
    case "ARCHIVE_LOCAL":
      return "Archive the local record and treat the remote deletion or cleanup as intentional.";
    case "MANUAL_MERGE":
      return "Use this when neither side should win cleanly and a human-reviewed merge is still needed.";
    default:
      return null;
  }
};

const conflictPolicyItems = [
  {
    title: "Edit vs edit",
    body:
      "If Kontax and the remote address book both changed after the last healthy cursor, we record a sync conflict instead of silently overwriting one side.",
  },
  {
    title: "Archive and delete intent",
    body:
      "Archive actions stamp a tombstone locally so future CardDAV runs can propagate delete intent deliberately instead of treating removal like a missing row.",
  },
  {
    title: "Merge lineage",
    body:
      "The surviving contact keeps its stable sync UID while the merged-away contact is archived with lineage metadata for support and recovery visibility.",
  },
  {
    title: "Undo remains visible",
    body:
      "Merge undo restores pre-merge tombstone state and increments sync versions again, so recovery actions become first-class local changes rather than hidden rewrites.",
  },
] as const;

const resolutionStrategyItems = [
  "Keep local when Kontax holds the trusted final edit.",
  "Keep remote when the device-side change should win.",
  "Duplicate local when neither side should overwrite the other yet.",
  "Archive local when the remote deletion or cleanup is intentional.",
  "Manual merge when fields need a human-reviewed combination.",
] as const;

const compatibilityBands = [
  {
    label: "Expected to travel well",
    value: "Full name, primary email, primary phone, company, notes",
  },
  {
    label: "Likely client-dependent",
    value: "Secondary identifiers, website, birthday, archive state, merge lineage",
  },
  {
    label: "Kontax-local only",
    value: "Billing entitlements, merge decisions, import/export history, sync conflict records",
  },
] as const;

const iphoneNotes = [
  "Best target is the native Contacts app through iOS Settings and a CardDAV account.",
  "Core fields should round-trip most reliably; richer app-only metadata stays in Kontax.",
  "Sync timing is mostly OS-controlled, so first-wave messaging should avoid promising instant propagation.",
  "Support should expect account discovery, provider app-passwords, and limited in-app sync controls.",
] as const;

const androidNotes = [
  "Treat third-party CardDAV clients such as DAVx5-style setups as the reference path.",
  "Vendor Android builds vary, so Google Contacts alone is not a safe universal assumption.",
  "Battery optimization and background restrictions can delay or suppress sync runs.",
  "Support should assume extra setup friction around client install, permissions, and vendor-specific throttling.",
] as const;

const rolloutStages = [
  "Stage 1: founder-only testing against a narrow provider and client mix.",
  "Stage 2: invited power users with explicit recovery expectations and portability fallback ready.",
  "Stage 3: broader beta only after conflict handling, credential rotation, and recovery tooling stay stable under load.",
] as const;

const syncTopologyItems = [
  {
    title: "SyncAccount",
    body:
      "Owns the remote CardDAV connection, collection URLs, direction, lifecycle state, remote collection tag, cursors, and encrypted credential references.",
  },
  {
    title: "SyncContactLink",
    body:
      "Maps a canonical Kontax contact to a remote CardDAV record using remote href, remote UID, ETag, tombstones, and per-link error state.",
  },
  {
    title: "SyncJob",
    body:
      "Tracks queueing, retries, cursors, worker leases, result counts, and partial or failed execution so support can inspect real sync history.",
  },
  {
    title: "Local contact identity",
    body:
      "Each contact keeps a stable sync UID plus sync version and tombstone timestamps so device-facing identity does not depend on ad hoc edits.",
  },
] as const;

const syncScopeItems = [
  "Roadmap target: two-way CardDAV sync.",
  "Fallback path: import-only bootstrap for risky providers, weak client behavior, or recovery mode.",
  "Initial scope: one Kontax sync account to one remote address book.",
  "Default coverage: all active contacts in that account.",
  "Archived contacts stay local-only in the first sync model.",
  "Filtered or tag-scoped sync is intentionally deferred.",
] as const;

export default async function SyncPage({ searchParams }: SyncPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const created = getSearchValue(resolvedSearchParams, "created") === "1";
  const connected = getSearchValue(resolvedSearchParams, "connected") === "1";
  const activated = getSearchValue(resolvedSearchParams, "activated") === "1";
  const paused = getSearchValue(resolvedSearchParams, "paused") === "1";
  const queued = getSearchValue(resolvedSearchParams, "queued") === "1";
  const retryQueued = getSearchValue(resolvedSearchParams, "retryQueued") === "1";
  const preflightFailed = getSearchValue(resolvedSearchParams, "preflightFailed") === "1";
  const preflightCompleted = getSearchValue(resolvedSearchParams, "preflightCompleted") === "1";
  const conflictResolved = getSearchValue(resolvedSearchParams, "conflictResolved") === "1";
  const credentialsSaved = getSearchValue(resolvedSearchParams, "credentialsSaved") === "1";
  const credentialsRevoked = getSearchValue(resolvedSearchParams, "credentialsRevoked") === "1";
  const relinkPrepared = getSearchValue(resolvedSearchParams, "relinkPrepared") === "1";
  const runnerProcessed = getSearchValue(resolvedSearchParams, "runnerProcessed") === "1";
  const connectFailed = getSearchValue(resolvedSearchParams, "connectFailed") === "1";
  const connectError = getSearchValue(resolvedSearchParams, "connectError");
  const encryptionStatus = getSyncCredentialEncryptionStatus();

  const [planSummary, syncAccounts, recentJobs, recentConflicts, queuedJobsCount, openConflictsCount] =
    await Promise.all([
    getUserPlanSummary(session.user.id),
    db.syncAccount.findMany({
      where: { userId: session.user.id },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        _count: {
          select: {
            syncJobs: true,
            syncConflicts: true,
            syncLinks: true,
          },
        },
        syncJobs: {
          orderBy: [{ createdAt: "desc" }],
          take: 1,
        },
      },
    }),
    db.syncJob.findMany({
      where: {
        syncAccount: {
          userId: session.user.id,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
      include: {
        syncAccount: {
          select: {
            id: true,
            label: true,
          },
        },
      },
    }),
    db.syncConflict.findMany({
      where: {
        syncAccount: {
          userId: session.user.id,
        },
      },
      orderBy: [{ detectedAt: "desc" }],
      take: 5,
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
          },
        },
        syncAccount: {
          select: {
            id: true,
            label: true,
          },
        },
      },
    }),
    db.syncJob.count({
      where: {
        status: "QUEUED",
        syncAccount: {
          userId: session.user.id,
        },
      },
    }),
    db.syncConflict.count({
      where: {
        status: "OPEN",
        syncAccount: {
          userId: session.user.id,
        },
      },
    }),
  ]);

  const syncAccountsRemaining = Math.max(
    planSummary.entitlements.syncAccountsLimit - syncAccounts.length,
    0,
  );
  const canUseCardDavSync = planSummary.entitlements.cardDavSyncEnabled;
  const activityItems = [
    ...recentJobs.map((job) => ({
      id: `job-${job.id}`,
      occurredAt: job.completedAt ?? job.startedAt ?? job.createdAt,
      title: `${job.syncAccount.label} job ${job.status.toLowerCase()}`,
      body:
        job.errorSummary ??
        `Trigger ${job.trigger.toLowerCase()} · ${job.syncDirection.toLowerCase().replaceAll("_", " ")} · conflicts ${job.conflictCount}`,
      tone:
        job.status === "FAILED"
          ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
          : job.status === "PARTIAL"
            ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
            : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    })),
    ...recentConflicts.map((conflict) => ({
      id: `conflict-${conflict.id}`,
      occurredAt: conflict.resolvedAt ?? conflict.detectedAt,
      title: `${conflict.syncAccount.label} conflict ${conflict.status.toLowerCase()}`,
      body:
        conflict.contact?.fullName
          ? `${conflict.conflictType} · ${conflict.contact.fullName}`
          : `${conflict.conflictType} · detached contact`,
      tone:
        conflict.status === "OPEN"
          ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
          : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    })),
  ]
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#07111d_45%,#0f172a_100%)] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-12">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(2,8,23,0.45)] backdrop-blur sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-cyan-200 hover:text-cyan-100" href="/">
              ← Back to dashboard
            </Link>
            <p className="mt-4 text-sm uppercase tracking-[0.35em] text-cyan-200">Sync</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              Prepare CardDAV sync without losing control of the core contact model.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              Ticket `P5-01` starts the sync account surface. Ticket `P5-03` keeps credential
              storage deliberately separate so encrypted secret handling can land cleanly before we
              move real device credentials through the app.
            </p>
          </div>

          <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-[#08101c] p-5 text-sm text-slate-300">
            <p>
              <span className="text-slate-500">Plan:</span> {planSummary.planLabel}
            </p>
            <p>
              <span className="text-slate-500">Sync accounts:</span> {syncAccounts.length} /{" "}
              {planSummary.entitlements.syncAccountsLimit}
            </p>
            <p>
              <span className="text-slate-500">CardDAV access:</span>{" "}
              {canUseCardDavSync ? "Enabled" : "Upgrade required"}
            </p>
          </div>
        </div>

        {created ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Sync account saved successfully.
          </div>
        ) : null}
        {connected ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            CardDAV connection validated successfully. Kontax saved the encrypted credentials and
            discovered the remote principal and address book details, so this account is ready for
            its first sync run.
          </div>
        ) : null}
        {connectFailed ? (
          <div className="rounded-[1.75rem] border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100 shadow-[0_20px_60px_rgba(244,63,94,0.12)]">
            {connectError ??
              "CardDAV connection setup failed before Kontax could save the account. Review the endpoint, credentials, and provider-specific app password requirements, then try again."}
          </div>
        ) : null}
        {activated ? (
          <div className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
            Sync account marked active.
          </div>
        ) : null}
        {paused ? (
          <div className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100 shadow-[0_20px_60px_rgba(251,191,36,0.12)]">
            Sync account paused successfully.
          </div>
        ) : null}
        {queued ? (
          <div className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
            Sync job queued successfully.
          </div>
        ) : null}
        {retryQueued ? (
          <div className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
            Recovery retry queued successfully.
          </div>
        ) : null}
        {preflightCompleted ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            CardDAV preflight completed successfully. Kontax discovered the remote principal and
            address book metadata so the next run can move into queued sync execution.
          </div>
        ) : null}
        {preflightFailed ? (
          <div className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100 shadow-[0_20px_60px_rgba(251,191,36,0.12)]">
            CardDAV preflight failed or was blocked. Check the latest sync job and the account
            error state for the exact credential, network, or discovery issue before retrying.
          </div>
        ) : null}
        {conflictResolved ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Sync conflict resolution saved successfully.
          </div>
        ) : null}
        {credentialsSaved ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Encrypted sync credentials saved successfully.
          </div>
        ) : null}
        {credentialsRevoked ? (
          <div className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100 shadow-[0_20px_60px_rgba(251,191,36,0.12)]">
            Stored sync credentials were revoked. This account now needs fresh encrypted credentials
            before the next run.
          </div>
        ) : null}
        {relinkPrepared ? (
          <div className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
            Sync relink preparation completed. Local sync links were reset and open conflicts were
            closed out so you can review the account and then start a fresh recovery run.
          </div>
        ) : null}
        {runnerProcessed ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Queued sync jobs were handed to the background runner. Review recent jobs and conflict
            activity below for the latest outcome.
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">P5-01 data model</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              CardDAV-ready sync structure is now a first-class product surface
            </h2>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              The schema foundation is already in place, and the sync center now makes the moving
              pieces explicit so later execution logic does not have to invent its own model.
            </p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {syncTopologyItems.map((item) => (
                <div
                  className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
                  key={item.title}
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-400">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.25)]">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">P5-02 scope and direction</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Two-way target, bootstrap fallback, and clear v1 boundaries
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Sync is treated as a product decision, not just a transport toggle. The first-wave
              scope stays intentionally narrow so support expectations remain understandable.
            </p>
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[#08101c] p-4 text-sm text-slate-300">
              <div className="grid gap-2">
                {syncScopeItems.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">P5-04 conflict policy</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Deterministic sync rules before real device traffic lands
            </h2>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              The sync center now makes the intended conflict and tombstone model explicit so later
              CardDAV execution does not invent behavior ad hoc. When local and remote state both
              move, we prefer recorded conflict state over silent mutation.
            </p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {conflictPolicyItems.map((item) => (
                <div
                  className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
                  key={item.title}
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-400">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <div className="rounded-[1.5rem] border border-white/10 bg-[#020617] p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">Resolution strategies</p>
                <div className="mt-3 grid gap-2">
                  {resolutionStrategyItems.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-[#020617] p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">Current signal</p>
                <p className="mt-3">Open conflicts: {openConflictsCount}</p>
                <p className="mt-1">Queued sync jobs: {queuedJobsCount}</p>
                <p className="mt-1">
                  Archive and delete intent should move through tombstones, while merges keep
                  stable sync IDs for the surviving contact.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.25)]">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">P5-05 compatibility</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              iPhone and Android support posture
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              First-wave CardDAV messaging should optimize for reliable core-contact interoperability
              rather than perfect parity across every provider, client, and phone vendor.
            </p>
            <div className="mt-5 grid gap-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-[#08101c] p-4">
                <p className="text-sm font-semibold text-white">Field support bands</p>
                <div className="mt-3 grid gap-3">
                  {compatibilityBands.map((band) => (
                    <div key={band.label}>
                      <p className="text-sm font-semibold text-cyan-100">{band.label}</p>
                      <p className="mt-1 text-sm text-slate-400">{band.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/10 bg-[#08101c] p-4">
                  <p className="text-sm font-semibold text-white">iPhone</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-400">
                    {iphoneNotes.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-[#08101c] p-4">
                  <p className="text-sm font-semibold text-white">Android</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-400">
                    {androidNotes.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-6">
            <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Sync accounts</p>
                <h2 className="text-2xl font-semibold text-white">Connect your contact home</h2>
                <p className="text-sm text-slate-400">
                  Start by validating a real CardDAV connection end to end. Kontax will encrypt the
                  credentials, discover the principal and address book URLs, and only then save a
                  live sync account that is ready for the first import run.
                </p>
              </div>

              {canUseCardDavSync ? (
                <form action={createSyncAccount} className="mt-6 grid gap-4">
                  <input name="redirectTo" type="hidden" value="/sync" />

                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Connection label</span>
                    <input
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                      name="label"
                      placeholder="Personal iCloud"
                      required
                      type="text"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>CardDAV base URL</span>
                    <input
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                      name="baseUrl"
                      placeholder="https://contacts.example.com/dav"
                      required
                      type="url"
                    />
                  </label>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="grid gap-2 text-sm text-slate-200">
                      <span>Username or account email</span>
                      <input
                        autoComplete="username"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                        name="username"
                        placeholder="you@example.com"
                        required
                        type="text"
                      />
                    </label>

                    <label className="grid gap-2 text-sm text-slate-200">
                      <span>Password or app password</span>
                      <input
                        autoComplete="current-password"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                        name="password"
                        placeholder="Provider app password"
                        required
                        type="password"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Credential note</span>
                    <input
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                      name="note"
                      placeholder="Optional note for this credential set"
                      type="text"
                    />
                  </label>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="grid gap-2 text-sm text-slate-200">
                      <span>Principal URL hint</span>
                      <input
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                        name="principalUrl"
                        placeholder="https://contacts.example.com/principals/me"
                        type="url"
                      />
                    </label>

                    <label className="grid gap-2 text-sm text-slate-200">
                      <span>Address book URL hint</span>
                      <input
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                        name="addressBookUrl"
                        placeholder="https://contacts.example.com/addressbooks/me/default"
                        type="url"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Sync direction</span>
                    <select
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                      defaultValue="TWO_WAY"
                      name="syncDirection"
                    >
                      <option className="bg-slate-950 text-white" value="TWO_WAY">
                        Two-way sync
                      </option>
                      <option className="bg-slate-950 text-white" value="IMPORT_ONLY">
                        Import only
                      </option>
                      <option className="bg-slate-950 text-white" value="EXPORT_ONLY">
                        Export only
                      </option>
                    </select>
                  </label>

                  <div className="rounded-2xl border border-white/10 bg-[#08101c] p-4 text-sm text-slate-300">
                    <p>
                      Kontax validates the endpoint before saving anything. If discovery or
                      authentication fails, the connection is not created.
                    </p>
                    <p className="mt-1 text-slate-500">
                      Principal and address book URLs are optional hints. Leave them blank unless
                      your provider documentation requires a specific path.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#08101c] p-4 text-sm text-slate-300">
                    <p>
                      Encryption backend: {getEncryptionModeLabel(encryptionStatus.mode)}
                    </p>
                    <p className="mt-1 text-slate-500">
                      Key reference: {encryptionStatus.keyRef ?? "Missing"}
                    </p>
                  </div>

                  <button
                    className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
                    type="submit"
                  >
                    Connect CardDAV account
                  </button>
                </form>
              ) : (
                <div className="mt-6 rounded-[1.75rem] border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
                  CardDAV sync is currently gated to the Pro plan. You can still use import,
                  export, merge, and the core contact experience on your current plan while we keep
                  building out the sync layer.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Configured accounts</p>
              <div className="mt-4 grid gap-4">
                {syncAccounts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-slate-400">
                    No sync accounts yet. Once one is saved, this is where we will track lifecycle,
                    job health, and conflict counts.
                  </div>
                ) : (
                  syncAccounts.map((account) => (
                    <article
                      className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5"
                      key={account.id}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-semibold text-white">{account.label}</h3>
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                              {account.status.toLowerCase()}
                            </span>
                            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                              {account.syncDirection.replaceAll("_", " ").toLowerCase()}
                            </span>
                          </div>
                          <p className="mt-2 break-all text-sm text-slate-400">{account.baseUrl}</p>
                          <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                            <p>Address book name: {account.addressBookDisplayName ?? "Not discovered yet"}</p>
                            <p>Principal: {account.principalUrl ?? "Not stored yet"}</p>
                            <p>Address book: {account.addressBookUrl ?? "Not stored yet"}</p>
                            <p>
                              Credentials:{" "}
                              {account.credentialReference && !account.credentialRevokedAt
                                ? "Attached"
                                : "Missing"}
                            </p>
                            <p>Credential state: {getCredentialStateLabel(account)}</p>
                            <p>Validation state: {getConnectionValidationLabel(account)}</p>
                            <p>
                              Credential version: {account.credentialVersion}
                            </p>
                            <p>
                              Key reference: {account.encryptionKeyRef ?? "Not attached"}
                            </p>
                            <p>
                              Updated: {formatTimestamp(account.credentialUpdatedAt)}
                            </p>
                            <p>
                              Credential validated: {formatTimestamp(account.credentialLastValidatedAt)}
                            </p>
                            <p>
                              Revoked: {formatTimestamp(account.credentialRevokedAt)}
                            </p>
                            <p>
                              Connection validated: {formatTimestamp(account.connectionValidatedAt)}
                            </p>
                            <p>Last success: {formatTimestamp(account.lastSucceededAt)}</p>
                            <p>Last sync: {formatTimestamp(account.lastSyncedAt)}</p>
                          </div>
                          {account.lastErrorMessage ? (
                            <p className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">
                              {account.lastErrorCode ? `${account.lastErrorCode}: ` : ""}
                              {account.lastErrorMessage}
                            </p>
                          ) : null}
                        </div>

                        <div className="grid gap-3 text-sm text-slate-300 sm:min-w-44">
                          <div className="rounded-2xl border border-white/10 bg-[#08101c] p-4">
                            <p>Jobs tracked: {account._count.syncJobs}</p>
                            <p className="mt-1">Open conflicts: {account._count.syncConflicts}</p>
                            <p className="mt-1">Linked contacts: {account._count.syncLinks}</p>
                          </div>
                          {account.status === "ACTIVE" ? (
                            <form action={pauseSyncAccount}>
                              <input name="redirectTo" type="hidden" value="/sync?paused=1" />
                              <input name="syncAccountId" type="hidden" value={account.id} />
                              <button
                                className="w-full rounded-full border border-amber-300/30 px-4 py-3 font-semibold text-amber-200 transition hover:border-amber-200 hover:text-white"
                                type="submit"
                              >
                                Pause sync
                              </button>
                            </form>
                          ) : (
                            <form action={activateSyncAccount}>
                              <input name="redirectTo" type="hidden" value="/sync?activated=1" />
                              <input name="syncAccountId" type="hidden" value={account.id} />
                              <button
                                className="w-full rounded-full bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
                                type="submit"
                              >
                                Mark active
                              </button>
                            </form>
                          )}
                          <form action={queueSyncJob}>
                            <input
                              name="redirectTo"
                              type="hidden"
                              value={
                                account.credentialReference &&
                                !account.credentialRevokedAt &&
                                account.remoteAccountId &&
                                account.principalUrl &&
                                account.addressBookUrl &&
                                account.connectionValidatedAt &&
                                account.credentialLastValidatedAt &&
                                (!account.credentialUpdatedAt ||
                                  account.credentialLastValidatedAt.getTime() >=
                                    account.credentialUpdatedAt.getTime())
                                  ? "/sync?queued=1"
                                  : account.credentialReference && !account.credentialRevokedAt
                                    ? "/sync?preflightCompleted=1"
                                    : "/sync?preflightFailed=1"
                              }
                            />
                            <input name="syncAccountId" type="hidden" value={account.id} />
                            <button
                              className="w-full rounded-full border border-white/10 px-4 py-3 font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                              type="submit"
                            >
                              {account.credentialReference &&
                              !account.credentialRevokedAt &&
                              account.remoteAccountId &&
                              account.principalUrl &&
                              account.addressBookUrl &&
                              account.connectionValidatedAt &&
                              account.credentialLastValidatedAt &&
                              (!account.credentialUpdatedAt ||
                                account.credentialLastValidatedAt.getTime() >=
                                  account.credentialUpdatedAt.getTime())
                                ? "Queue sync run"
                                : "Validate connection"}
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#08101c]/80 p-4">
                        <p className="text-sm font-semibold text-white">Encrypted credentials</p>
                        <p className="mt-2 text-sm text-slate-400">
                          Ticket `P5-03`: credentials are stored as an encrypted server-side
                          envelope, tracked with key references and rotation metadata instead of
                          being written as plain text fields.
                        </p>
                        {encryptionStatus.available ? (
                          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                            <form action={attachSyncCredentials} className="grid gap-3">
                              <input
                                name="redirectTo"
                                type="hidden"
                                value="/sync?credentialsSaved=1"
                              />
                              <input name="syncAccountId" type="hidden" value={account.id} />
                              <input
                                autoComplete="username"
                                className="rounded-full border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                                name="username"
                                placeholder="CardDAV username or email"
                                type="text"
                              />
                              <input
                                autoComplete="current-password"
                                className="rounded-full border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                                name="password"
                                placeholder="App password or account password"
                                type="password"
                              />
                              <input
                                className="rounded-full border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                                name="note"
                                placeholder="Optional note for this credential set"
                                type="text"
                              />
                              <button
                                className="rounded-full border border-cyan-300/30 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
                                type="submit"
                              >
                                {account.credentialReference && !account.credentialRevokedAt
                                  ? "Rotate encrypted credentials"
                                  : "Attach encrypted credentials"}
                              </button>
                            </form>
                            <div className="grid gap-3 self-start">
                              <div className="rounded-2xl border border-white/10 bg-[#020617] p-4 text-sm text-slate-400">
                                <p>Backend mode: {getEncryptionModeLabel(encryptionStatus.mode)}</p>
                                <p className="mt-1">
                                  Active key ref: {encryptionStatus.keyRef ?? "Missing"}
                                </p>
                              </div>
                              {account.credentialReference ? (
                                <form action={revokeSyncCredentials}>
                                  <input
                                    name="redirectTo"
                                    type="hidden"
                                    value="/sync?credentialsRevoked=1"
                                  />
                                  <input
                                    name="syncAccountId"
                                    type="hidden"
                                    value={account.id}
                                  />
                                  <button
                                    className="w-full rounded-full border border-amber-300/30 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-200 hover:text-white"
                                    type="submit"
                                  >
                                    Revoke stored credentials
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
                            Set `SYNC_CREDENTIAL_ENCRYPTION_KEY` for a dedicated sync-secret key,
                            or keep `AUTH_SECRET` available as the fallback. Credential capture is
                            blocked until one of those server secrets exists.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#08101c]/80 p-4">
                        <p className="text-sm font-semibold text-white">Credential lifecycle and audit posture</p>
                        <p className="mt-2 text-sm text-slate-400">
                          Ticket `P5-03`: credentials stay out of primary relational fields. What
                          we keep here is the audit-facing metadata needed for rotation, revoke,
                          reauth, and support inspection.
                        </p>
                        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                          <div className="rounded-2xl border border-white/10 bg-[#020617] p-4 text-sm text-slate-300">
                            <p className="font-semibold text-white">Stored metadata</p>
                            <p className="mt-2">Credential state: {getCredentialStateLabel(account)}</p>
                            <p className="mt-1">Validation state: {getConnectionValidationLabel(account)}</p>
                            <p className="mt-1">Credential version: {account.credentialVersion}</p>
                            <p className="mt-1">Updated at: {formatTimestamp(account.credentialUpdatedAt)}</p>
                            <p className="mt-1">Credential validated at: {formatTimestamp(account.credentialLastValidatedAt)}</p>
                            <p className="mt-1">Revoked at: {formatTimestamp(account.credentialRevokedAt)}</p>
                            <p className="mt-1">Connection validated at: {formatTimestamp(account.connectionValidatedAt)}</p>
                            <p className="mt-1">Encryption key ref: {account.encryptionKeyRef ?? "Missing"}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-[#020617] p-4 text-sm text-slate-300">
                            <p className="font-semibold text-white">Operational expectations</p>
                            <p className="mt-2">1. Rotate credentials by attaching a fresh encrypted set.</p>
                            <p className="mt-1">2. Revalidate the connection after any credential change before queuing sync work.</p>
                            <p className="mt-1">3. Revoke when a provider app password or token is no longer trusted.</p>
                            <p className="mt-1">4. Treat `NEEDS_REAUTH` as a hard stop for queued sync work.</p>
                            <p className="mt-1">5. Keep raw usernames and passwords out of logs and recovery exports.</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#08101c]/80 p-4">
                        <p className="text-sm font-semibold text-white">Recovery toolkit</p>
                        <p className="mt-2 text-sm text-slate-400">
                          Ticket `P5-06`: when sync health gets messy, the safest path is pause,
                          export, inspect, then relink. Recovery actions here avoid touching your
                          underlying Kontax contacts.
                        </p>
                        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <a
                            className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                            href={`/api/exports/sync-recovery?syncAccountId=${account.id}`}
                          >
                            Export recovery package
                          </a>
                          <form action={prepareSyncRelink}>
                            <input
                              name="redirectTo"
                              type="hidden"
                              value="/sync?relinkPrepared=1"
                            />
                            <input name="syncAccountId" type="hidden" value={account.id} />
                            <button
                              className="w-full rounded-full border border-cyan-300/30 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
                              type="submit"
                            >
                              Prepare relink reset
                            </button>
                          </form>
                        </div>
                        <div className="mt-4 rounded-2xl border border-white/10 bg-[#020617] p-4 text-sm text-slate-400">
                          <p>Recommended recovery order</p>
                          <p className="mt-2">1. Pause sync if the account is still active.</p>
                          <p className="mt-1">2. Export a recovery package before any reset.</p>
                          <p className="mt-1">
                            3. Prepare relink to clear local sync links and stale open conflicts.
                          </p>
                          <p className="mt-1">
                            4. Run a fresh preflight or queue a new recovery sync run.
                          </p>
                        </div>
                      </div>

                      {account.syncJobs[0] ? (
                        <p className="mt-4 text-sm text-slate-500">
                          Latest job: {account.syncJobs[0].status.toLowerCase()} via{" "}
                          {account.syncJobs[0].trigger.toLowerCase()} on{" "}
                          {formatTimestamp(account.syncJobs[0].createdAt)}
                        </p>
                      ) : (
                        <p className="mt-4 text-sm text-slate-500">
                          No sync jobs yet. Ticket `P5-04` will attach scheduling, retries, and
                          conflict-aware execution.
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>

          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Plan fit</p>
              <p className="mt-4 text-sm text-slate-300">
                Ticket `P5-02`: sync remains product-aware from the start so we can gate premium
                capability without forcing a redesign of ownership or auth later.
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#08101c] p-4 text-sm text-slate-300">
                <p>Accounts remaining: {syncAccountsRemaining}</p>
                <p className="mt-1">
                  Live CardDAV entitlement: {canUseCardDavSync ? "Yes" : "No"}
                </p>
                <p className="mt-1">Queued jobs: {queuedJobsCount}</p>
                <p className="mt-1">Open conflicts: {openConflictsCount}</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">P5-06 rollout</p>
              <p className="mt-4 text-sm text-slate-300">
                Ticket `P5-06`: the sync center now pairs recovery actions with an explicit staged
                rollout and support posture so we can introduce CardDAV gradually instead of all at
                once.
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#08101c] p-4">
                <div className="grid gap-2">
                  {rolloutStages.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#08101c] p-4">
                <p className="font-semibold text-white">Support checklist</p>
                <p className="mt-2">1. Pause the account before risky recovery steps.</p>
                <p className="mt-1">2. Export the recovery package before resetting links.</p>
                <p className="mt-1">3. Review recent job failures and open conflicts together.</p>
                <p className="mt-1">
                  4. Prefer relink or bootstrap recovery over silent destructive repair.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">P5-03 orchestration</p>
              <p className="mt-4 text-sm text-slate-300">
                Queue and retry behavior should stay inspectable before background workers become
                more autonomous. The current surface exposes the metadata we need for safer support
                triage.
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#08101c] p-4">
                <p>Retry model: bounded attempts with backoff and idempotency.</p>
                <p className="mt-1">
                  Failure buckets: authentication, connectivity, conflict, rate-limit, protocol/data.
                </p>
                <p className="mt-1">
                  Cursor posture: resume from the most recent known before/after marker.
                </p>
                <p className="mt-1">
                  Worker posture: one lease per job attempt, inspectable from job history.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Recent jobs</p>
              <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-100">
                <p className="font-semibold text-white">P7-02 background runner</p>
                <p className="mt-2">
                  Queue first, then process jobs through the dedicated runner so sync execution can
                  be retried, inspected, and later scheduled without tying work to the request that
                  queued it.
                </p>
                <form action="/api/sync/run" className="mt-4" method="post">
                  <input name="redirectTo" type="hidden" value="/sync?runnerProcessed=1" />
                  <input name="limit" type="hidden" value="5" />
                  <button
                    className="rounded-full border border-cyan-200/40 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-100 hover:text-cyan-50"
                    type="submit"
                  >
                    Run queued jobs now
                  </button>
                </form>
              </div>
              <div className="mt-4 grid gap-3">
                {recentJobs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-slate-400">
                    No sync jobs have been recorded yet.
                  </div>
                ) : (
                  recentJobs.map((job) => (
                    <div className="rounded-2xl border border-white/10 bg-[#08101c]/70 p-4" key={job.id}>
                      <p className="font-semibold text-white">{job.syncAccount.label}</p>
                      <p className="mt-1 text-slate-400">
                        {job.status} · {job.trigger} · {job.syncDirection}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Attempt {job.attemptCount} of {job.maxAttempts} · created{" "}
                        {formatTimestamp(job.createdAt)}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Next retry {formatTimestamp(job.nextRetryAt)} · conflicts {job.conflictCount}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Failure class {getJobFailureClass(job.errorCode)} · cursor{" "}
                        {job.cursorAfter ?? job.cursorBefore ?? "not recorded"}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Lease {formatTimestamp(job.leaseExpiresAt)} · worker {job.workerId ?? "unassigned"}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Result counts imported {job.createdCount} · matched {job.updatedCount} · exported{" "}
                        {job.deletedCount} · skipped {job.skippedCount}
                      </p>
                      {job.errorSummary ? (
                        <p className="mt-2 text-sm text-amber-100">
                          {job.errorCode ? `${job.errorCode}: ` : ""}
                          {job.errorSummary}
                        </p>
                      ) : null}
                      {(job.status === "FAILED" || job.status === "PARTIAL") &&
                      job.attemptCount < job.maxAttempts ? (
                        <form action={retrySyncJob} className="mt-3">
                          <input name="redirectTo" type="hidden" value="/sync?retryQueued=1" />
                          <input name="syncJobId" type="hidden" value={job.id} />
                          <button
                            className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
                            type="submit"
                          >
                            Queue recovery retry
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Activity timeline</p>
              <div className="mt-4 grid gap-3">
                {activityItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-slate-400">
                    No sync activity yet.
                  </div>
                ) : (
                  activityItems.map((item) => (
                    <div className={`rounded-2xl border p-4 ${item.tone}`} key={item.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                          {formatTimestamp(item.occurredAt)}
                        </p>
                      </div>
                      <p className="mt-2 text-sm">{item.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Open conflicts</p>
              <div className="mt-4 grid gap-3">
                {recentConflicts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-slate-400">
                    No sync conflicts yet.
                  </div>
                ) : (
                  recentConflicts.map((conflict) => (
                    <div
                      className="rounded-2xl border border-white/10 bg-[#08101c]/70 p-4"
                      key={conflict.id}
                    >
                      {(() => {
                        const comparisonRows = getConflictComparisonRows(
                          conflict.localSnapshot,
                          conflict.remoteSnapshot,
                        );
                        const manualMergePreview = getManualMergePreview(
                          conflict.localSnapshot,
                          conflict.remoteSnapshot,
                        );

                        return (
                          <>
                      <p className="font-semibold text-white">{conflict.syncAccount.label}</p>
                      <p className="mt-1 text-slate-400">
                        {conflict.conflictType} · {conflict.status}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Contact: {conflict.contact?.fullName ?? "Detached record"} · detected{" "}
                        {formatTimestamp(conflict.detectedAt)}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Remote ETag: {conflict.remoteETag ?? "Unknown"} · snapshots{" "}
                        {conflict.localSnapshot ? "local" : "no local"} /{" "}
                        {conflict.remoteSnapshot ? "remote" : "no remote"}
                      </p>
                      {conflict.resolutionNotes ? (
                        <p className="mt-2 text-slate-400">{conflict.resolutionNotes}</p>
                      ) : null}
                      {comparisonRows.length > 0 ? (
                        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#020617]/80">
                          <div className="grid grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            <p>Field</p>
                            <p>Local</p>
                            <p>Remote</p>
                          </div>
                          <div className="divide-y divide-white/10">
                            {comparisonRows.map((row) => {
                              const changed = row.local !== row.remote;

                              return (
                                <div
                                  className={`grid grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-3 text-sm ${
                                    changed ? "bg-amber-300/5" : ""
                                  }`}
                                  key={`${conflict.id}-${row.label}`}
                                >
                                  <p className="font-medium text-slate-300">{row.label}</p>
                                  <p className={changed ? "text-white" : "text-slate-400"}>
                                    {row.local}
                                  </p>
                                  <p className={changed ? "text-amber-100" : "text-slate-400"}>
                                    {row.remote}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-100">
                        <p className="font-semibold text-white">P7-01 manual merge preview</p>
                        <p className="mt-2 text-cyan-100/80">
                          Manual merge prefers the current local naming fields, keeps useful remote
                          data when local values are blank, combines multi-value identifiers, and
                          appends non-duplicate notes before writing the merged record back to
                          CardDAV.
                        </p>
                        <div className="mt-3 grid gap-2">
                          {manualMergePreview.map((row) => (
                            <div
                              className="grid gap-1 rounded-2xl border border-white/10 bg-[#020617]/60 px-3 py-2 sm:grid-cols-[120px_minmax(0,1fr)]"
                              key={`${conflict.id}-merge-${row.label}`}
                            >
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                {row.label}
                              </p>
                              <p className="text-sm text-white">{row.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {conflict.status === "OPEN" ? (
                        <form action={resolveSyncConflict} className="mt-3 grid gap-3">
                          <input
                            name="redirectTo"
                            type="hidden"
                            value="/sync?conflictResolved=1"
                          />
                          <input name="syncConflictId" type="hidden" value={conflict.id} />
                          <select
                            className="rounded-full border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                            defaultValue="KEEP_LOCAL"
                            name="resolutionStrategy"
                          >
                            <option className="bg-slate-950 text-white" value="KEEP_LOCAL">
                              Keep local
                            </option>
                            <option className="bg-slate-950 text-white" value="KEEP_REMOTE">
                              Keep remote
                            </option>
                            <option className="bg-slate-950 text-white" value="DUPLICATE_LOCAL">
                              Duplicate local
                            </option>
                            <option className="bg-slate-950 text-white" value="ARCHIVE_LOCAL">
                              Archive local
                            </option>
                            <option className="bg-slate-950 text-white" value="MANUAL_MERGE">
                              Manual merge
                            </option>
                          </select>
                          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">
                            <p className="font-semibold text-white">Resolution guide</p>
                            <div className="mt-2 space-y-2">
                              {[
                                "KEEP_LOCAL",
                                "KEEP_REMOTE",
                                "DUPLICATE_LOCAL",
                                "ARCHIVE_LOCAL",
                                "MANUAL_MERGE",
                              ].map((strategy) => (
                                <p key={`${conflict.id}-${strategy}`}>
                                  <span className="font-semibold">{strategy}:</span>{" "}
                                  {getResolutionGuidance(strategy)}
                                </p>
                              ))}
                            </div>
                          </div>
                          <input
                            className="rounded-full border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                            name="resolutionNotes"
                            placeholder="Optional support note for this resolution"
                            type="text"
                          />
                          <button
                            className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200 hover:text-white"
                            type="submit"
                          >
                            Save resolution
                          </button>
                        </form>
                      ) : (
                        <p className="mt-2 text-emerald-100">
                          Resolution: {conflict.resolutionStrategy ?? "Saved"}
                        </p>
                      )}
                          </>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
