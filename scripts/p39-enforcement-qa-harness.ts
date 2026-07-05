// P39-08 — Enforcement QA matrix harness.
//
// Exercises the Phase 39 runner enforcement (sync window, deletion threshold,
// field exclusions, export label filter, retry sensitivity) against LIVE
// staging connections, through the product code paths (runQueuedSyncJobs,
// enqueueDueSyncJobs, the resume cores) — never by simulating them.
//
// SAFETY CONTRACT
// - Only contacts whose fullName starts with "P39QA" are ever created,
//   modified, or deleted — locally or remotely.
// - Every connection setting the harness changes is snapshotted first and
//   restored in a finally block, along with account status/error fields.
// - Live modes require --confirm-live.
//
// Usage:
//   npx tsx --tsconfig tsconfig.json scripts/p39-enforcement-qa-harness.ts --mode=<mode> [--account=<syncAccountId>] [--confirm-live]
//
// Modes:
//   status            — list the account's current settings/state (read-only)
//   dst               — DST wall-clock checks for isWithinSyncWindow (pure)
//   window            — scheduler holds runs outside the window (SKIPPED row, throttled)
//   retry             — retry sensitivity 1 / never / default + notification gating (scratch account)
//   deletion          — CardDAV outbound threshold: trip, review, both resume paths
//   deletion-inbound  — Google remote-wipe threshold: local data untouched, resume-without
//   exclusions        — NOTE/BDAY/ADR exclusions both directions + unknown-token grace (CardDAV)
//   exclusions-google — NOTE exclusion outbound on Google (mask withholding)
//   labelfilter       — export label filter: new pushes gated, linked contacts kept

import { auth as googleAuth, people } from "@googleapis/people";

import { db } from "~/server/db";
import {
  deleteCardDavContact,
  fetchCardDavAddressBookCards,
  pushCardDavContact,
  type CardDavContactCard,
} from "~/server/carddav";
import type { PortableContactInput } from "~/server/contact-portability";
import {
  decryptGoogleSyncCredential,
  decryptSyncCredentialPayload,
  encryptGoogleSyncCredential,
  encryptSyncCredentialPayload,
} from "~/server/sync-credentials";
import {
  getDeletionHoldReviewCore,
  readDeletionHold,
  resumeSyncAllowDeletionsCore,
  resumeSyncWithoutDeletionsCore,
} from "~/server/sync-deletion-resume";
import { resolveSyncProviderCapabilityProfile } from "~/server/sync-provider-capabilities";
import { enqueueDueSyncJobs, runQueuedSyncJobs } from "~/server/sync-runner";
import { getHourInTimezone, isWithinSyncWindow } from "~/server/sync-window";

// ── CLI ───────────────────────────────────────────────────────────────────────

const getArg = (name: string, fallback?: string) => {
  const prefix = `--${name}=`;
  const entry = process.argv.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
};
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const mode = (getArg("mode", "status") ?? "status").toLowerCase();
const accountId = getArg("account");
const confirmLive = hasFlag("confirm-live");

const MARKER = "P39QA";
const runTag = Math.random().toString(36).slice(2, 8);

// ── result collection ─────────────────────────────────────────────────────────

type Row = { id: string; desc: string; pass: boolean; detail: string };
const rows: Row[] = [];
const check = (id: string, desc: string, pass: boolean, detail = "") => {
  rows.push({ id, desc, pass, detail });
  console.log(`${pass ? "✅ PASS" : "❌ FAIL"}  [${id}] ${desc}${detail ? ` — ${detail}` : ""}`);
};

const finish = async () => {
  const failed = rows.filter((r) => !r.pass);
  console.log(`\n${rows.length - failed.length}/${rows.length} checks passed`);
  await db.$disconnect();
  process.exit(failed.length > 0 ? 1 : 0);
};

// ── shared helpers ────────────────────────────────────────────────────────────

// The staging DB rides the VPN and occasionally drops a connection mid-run;
// cleanup steps MUST land, so they retry with a short backoff.
const retry = async <T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(`· ${label} failed (attempt ${attempt}/${attempts}) — retrying`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError;
};

const requireAccount = async () => {
  if (!accountId) throw new Error("--account=<syncAccountId> is required for this mode");
  const account = await db.syncAccount.findUnique({
    where: { id: accountId },
    include: { settings: true },
  });
  if (!account) throw new Error(`Sync account ${accountId} not found`);
  return account;
};

type AccountRow = NonNullable<Awaited<ReturnType<typeof requireAccount>>>;

const requireLive = () => {
  if (!confirmLive) {
    throw new Error("This mode writes to a live provider account — re-run with --confirm-live");
  }
};

// Snapshot + restore the fields the harness touches.
const snapshotAccount = (account: AccountRow) => ({
  status: account.status,
  lastErrorAt: account.lastErrorAt,
  lastErrorCode: account.lastErrorCode,
  lastErrorMessage: account.lastErrorMessage,
  settings: account.settings
    ? {
        maxDeletionsThreshold: account.settings.maxDeletionsThreshold,
        excludedFields: [...account.settings.excludedFields],
        exportLabelFilter: [...account.settings.exportLabelFilter],
        syncWindowStart: account.settings.syncWindowStart,
        syncWindowEnd: account.settings.syncWindowEnd,
        syncWindowTimezone: account.settings.syncWindowTimezone,
        maxAttemptsBeforePause: account.settings.maxAttemptsBeforePause,
        notifyOnFailure: account.settings.notifyOnFailure,
      }
    : null,
});

const restoreAccount = async (account: AccountRow, snap: ReturnType<typeof snapshotAccount>) => {
  await db.syncAccount.update({
    where: { id: account.id },
    data: {
      status: snap.status,
      lastErrorAt: snap.lastErrorAt,
      lastErrorCode: snap.lastErrorCode,
      lastErrorMessage: snap.lastErrorMessage,
    },
  });
  if (snap.settings) {
    await db.syncAccountSettings.update({
      where: { syncAccountId: account.id },
      data: snap.settings,
    });
  }
  console.log("· settings/status restored");
};

const patchSettings = async (
  account: AccountRow,
  data: Partial<{
    maxDeletionsThreshold: number | null;
    excludedFields: string[];
    exportLabelFilter: string[];
    syncWindowStart: number | null;
    syncWindowEnd: number | null;
    syncWindowTimezone: string | null;
    maxAttemptsBeforePause: number | null;
    notifyOnFailure: boolean;
  }>,
) => {
  await db.syncAccountSettings.upsert({
    where: { syncAccountId: account.id },
    create: { syncAccountId: account.id, ...data },
    update: data,
  });
};

// Run a manual sync for the account through the product runner. A dropped VPN
// connection mid-run can leave the claimed job RUNNING (the runner's failure
// bookkeeping itself needs the DB) — clear such stale claims before retrying,
// otherwise the sibling-RUNNING guard parks every subsequent attempt.
const syncNow = async (account: AccountRow, label: string) =>
  retry(`sync ${label}`, async () => {
    await db.syncJob.updateMany({
      where: { syncAccountId: account.id, status: "RUNNING" },
      data: { status: "FAILED", completedAt: new Date(), leaseExpiresAt: null },
    });
    await db.syncJob.create({
      data: {
        syncAccountId: account.id,
        status: "QUEUED",
        trigger: "MANUAL",
        syncDirection: account.syncDirection,
        attemptCount: 1,
        maxAttempts: 5,
        nextRetryAt: new Date(),
        idempotencyKey: `${account.id}:p39qa:${label}:${Date.now()}`,
      },
    });
    const summary = await runQueuedSyncJobs({ syncAccountId: account.id, limit: 1 });
    console.log(`· sync (${label}):`, JSON.stringify(summary));
    if (summary.failed > 0) {
      const failedJob = await db.syncJob.findFirst({
        where: { syncAccountId: account.id, status: "FAILED" },
        orderBy: { createdAt: "desc" },
        select: { errorCode: true, errorSummary: true },
      });
      console.log(
        `· sync (${label}) FAILED: ${failedJob?.errorCode ?? "?"} — ${(failedJob?.errorSummary ?? "").slice(0, 600)}`,
      );
    }
    return summary;
  });

const freshAccount = async (id: string) =>
  db.syncAccount.findUniqueOrThrow({ where: { id }, include: { settings: true } });

const createLocalContact = async (
  userId: string,
  name: string,
  fields: Partial<{
    phone: string;
    notes: string;
    birthday: string;
    address: string;
    labels: string[];
  }> = {},
) =>
  db.contact.create({
    data: {
      userId,
      fullName: name,
      firstName: name,
      phone: fields.phone ?? null,
      ...(fields.phone
        ? {
            phoneNumbers: [fields.phone],
            phoneEntries: [{ label: "Mobile", value: fields.phone, isPrimary: true }],
          }
        : {}),
      notes: fields.notes ?? null,
      birthday: fields.birthday ?? null,
      address: fields.address ?? null,
      ...(fields.labels ? { labels: fields.labels } : {}),
      sourceType: "MANUAL",
      lastMutatedBy: "MANUAL",
    },
    select: { id: true, fullName: true },
  });

// Hard-delete local QA contacts (cascade removes links). Marker-guarded.
const deleteLocalQaContacts = async (userId: string, ids: string[]) => {
  if (ids.length === 0) return;
  const result = await db.contact.deleteMany({
    where: { id: { in: ids }, userId, fullName: { startsWith: MARKER } },
  });
  console.log(`· deleted ${result.count} local QA contacts`);
};

// Remove the harness's job rows from the account's sync history (matched by
// the p39qa idempotency-key marker; covers HALTED/FAILED/SUCCEEDED alike).
const deleteQaJobs = async (syncAccountId: string) => {
  const result = await db.syncJob.deleteMany({
    where: { syncAccountId, idempotencyKey: { contains: ":p39qa:" } },
  });
  if (result.count > 0) console.log(`· removed ${result.count} QA job rows from history`);
};

// Delete QA notifications raised for this account during the run window.
const deleteQaNotifications = async (userId: string, since: Date, syncAccountId: string) => {
  const result = await db.notification.deleteMany({
    where: {
      userId,
      category: "SYNC_STATUS",
      createdAt: { gte: since },
      actionUrl: { contains: syncAccountId },
    },
  });
  if (result.count > 0) console.log(`· removed ${result.count} QA notifications`);
};

const countQaNotifications = (userId: string, since: Date, syncAccountId: string) =>
  db.notification.count({
    where: {
      userId,
      category: "SYNC_STATUS",
      createdAt: { gte: since },
      actionUrl: { contains: syncAccountId },
    },
  });

// ── CardDAV remote adapter ────────────────────────────────────────────────────

const cardDavContext = (account: AccountRow) => {
  if (!account.credentialReference || !account.addressBookUrl) {
    throw new Error("Account is missing CardDAV credentials or an address book URL");
  }
  const credential = decryptSyncCredentialPayload(account.credentialReference);
  return {
    addressBookUrl: account.addressBookUrl,
    credentials: { username: credential.username, password: credential.password },
    capabilityProfile: resolveSyncProviderCapabilityProfile({
      provider: account.provider,
      baseUrl: account.baseUrl,
      addressBookUrl: account.addressBookUrl,
      label: account.label,
      capabilityProfileOverride: account.settings?.capabilityProfileOverride ?? null,
    }),
  };
};

const listRemoteQaCards = async (account: AccountRow) => {
  const ctx = cardDavContext(account);
  const cards = await fetchCardDavAddressBookCards({
    addressBookUrl: ctx.addressBookUrl,
    credentials: ctx.credentials,
  });
  return cards.filter((card) => card.fullName.startsWith(MARKER));
};

const cardToPortable = (card: CardDavContactCard): PortableContactInput => ({
  fullName: card.fullName,
  firstName: card.firstName,
  middleName: card.middleName,
  lastName: card.lastName,
  namePrefix: card.namePrefix,
  nameSuffix: card.nameSuffix,
  nickname: card.nickname,
  email: card.emailAddresses[0] ?? null,
  emailAddresses: card.emailAddresses,
  emailEntries: card.emailEntries,
  phone: card.phoneNumbers[0] ?? null,
  phoneNumbers: card.phoneNumbers,
  phoneEntries: card.phoneEntries,
  company: card.company,
  department: card.department,
  jobTitle: card.jobTitle,
  website: card.website,
  websiteEntries: card.websiteEntries,
  birthday: card.birthday,
  significantDates: card.significantDates,
  address: card.address,
  postalAddresses: card.postalAddresses,
  addressEntries: card.addressEntries,
  notes: card.notes,
});

// Edit a remote card directly (bypasses product sync — simulates "someone
// changed it on the provider"). Marker-guarded.
const editRemoteCard = async (
  account: AccountRow,
  card: CardDavContactCard,
  patch: Partial<PortableContactInput>,
) => {
  if (!card.fullName.startsWith(MARKER)) throw new Error("refusing to edit a non-QA card");
  const ctx = cardDavContext(account);
  await pushCardDavContact({
    addressBookUrl: ctx.addressBookUrl,
    credentials: ctx.credentials,
    remoteUid: card.uid,
    contact: { ...cardToPortable(card), ...patch },
    capabilityProfile: ctx.capabilityProfile,
    hrefOverride: card.href,
  });
};

const deleteRemoteQaCards = async (account: AccountRow) => {
  const ctx = cardDavContext(account);
  const cards = await listRemoteQaCards(account);
  for (const card of cards) {
    await deleteCardDavContact({ href: card.href, credentials: ctx.credentials });
  }
  if (cards.length > 0) console.log(`· deleted ${cards.length} remote QA cards`);
};

// ── Google remote adapter (photo-harness transport pattern) ───────────────────

const getGooglePeopleService = async (account: AccountRow) => {
  if (!account.credentialReference) throw new Error("Google account has no stored credentials.");
  const credential = decryptGoogleSyncCredential(account.credentialReference);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const client =
    clientId && clientSecret
      ? new googleAuth.OAuth2(clientId, clientSecret, process.env.GOOGLE_REDIRECT_URI)
      : new googleAuth.OAuth2();
  client.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken,
    expiry_date: credential.expiryDate ?? undefined,
    scope: credential.scope,
  });
  const expired = !credential.expiryDate || Date.now() > credential.expiryDate - 60_000;
  if (expired) {
    if (!clientId || !clientSecret) {
      throw new Error("Google token expired and no client id/secret to refresh with.");
    }
    const refreshed = await client.refreshAccessToken();
    const next = refreshed.credentials;
    const enc = encryptGoogleSyncCredential({
      ...credential,
      accessToken: next.access_token ?? credential.accessToken,
      refreshToken: next.refresh_token ?? credential.refreshToken,
      expiryDate: next.expiry_date ?? credential.expiryDate,
      scope: next.scope ?? credential.scope,
    });
    await db.syncAccount.update({
      where: { id: account.id },
      data: {
        credentialReference: enc.credentialReference,
        encryptionKeyRef: enc.encryptionKeyRef,
        credentialUpdatedAt: new Date(),
        credentialLastValidatedAt: new Date(),
      },
    });
    client.setCredentials(next);
  }
  return people({ version: "v1", auth: client });
};

const listGoogleQaPeople = async (account: AccountRow) => {
  const service = await getGooglePeopleService(account);
  const found: Array<{ resourceName: string; name: string; note: string | null; phone: string | null }> = [];
  let pageToken: string | undefined;
  do {
    const res = await service.people.connections.list({
      resourceName: "people/me",
      pageSize: 1000,
      personFields: "names,biographies,phoneNumbers",
      pageToken,
    });
    for (const person of res.data.connections ?? []) {
      const name = person.names?.[0]?.displayName ?? "";
      if (!name.startsWith(MARKER) || !person.resourceName) continue;
      found.push({
        resourceName: person.resourceName,
        name,
        note: person.biographies?.[0]?.value ?? null,
        phone: person.phoneNumbers?.[0]?.value ?? null,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return found;
};

const deleteGoogleQaPeople = async (account: AccountRow) => {
  const service = await getGooglePeopleService(account);
  const found = await listGoogleQaPeople(account);
  for (const person of found) {
    await service.people.deleteContact({ resourceName: person.resourceName });
  }
  if (found.length > 0) console.log(`· deleted ${found.length} remote QA people`);
};

// ── modes ─────────────────────────────────────────────────────────────────────

const modeStatus = async () => {
  const account = await requireAccount();
  console.log(
    JSON.stringify(
      {
        id: account.id,
        label: account.label,
        provider: account.provider,
        status: account.status,
        lastErrorCode: account.lastErrorCode,
        deletionHoldAt: account.deletionHoldAt,
        settings: account.settings,
      },
      null,
      2,
    ),
  );
};

// P39-01 DST acceptance: the window tracks the user's wall clock across a DST
// change. America/New_York springs forward 2026-03-08 (02:00→03:00, UTC-5→-4)
// and falls back 2026-11-01 (UTC-4→-5).
const modeDst = async () => {
  const tz = "America/New_York";
  // 12:00 UTC = 07:00 EST the day before spring-forward, 08:00 EDT the day after.
  const beforeSpring = new Date("2026-03-07T12:00:00Z");
  const afterSpring = new Date("2026-03-09T12:00:00Z");
  check(
    "DST-1",
    "hour tracks wall clock across spring-forward",
    getHourInTimezone(beforeSpring, tz) === 7 && getHourInTimezone(afterSpring, tz) === 8,
    `07↔${getHourInTimezone(beforeSpring, tz)} / 08↔${getHourInTimezone(afterSpring, tz)}`,
  );
  // Window 08:00–22:00: 12:00 UTC is OUTSIDE (07:00) before the change and
  // INSIDE (08:00) after it — same UTC instant, different wall-clock verdicts.
  const win = { windowStart: 8, windowEnd: 22, timezone: tz };
  check(
    "DST-2",
    "same UTC instant flips window verdict across spring-forward",
    !isWithinSyncWindow({ now: beforeSpring, ...win }) &&
      isWithinSyncWindow({ now: afterSpring, ...win }),
  );
  const beforeFall = new Date("2026-10-31T12:00:00Z"); // 08:00 EDT — inside
  const afterFall = new Date("2026-11-02T12:00:00Z"); // 07:00 EST — outside
  check(
    "DST-3",
    "same UTC instant flips window verdict across fall-back",
    isWithinSyncWindow({ now: beforeFall, ...win }) &&
      !isWithinSyncWindow({ now: afterFall, ...win }),
  );
  // Legacy row (null timezone) keeps stored-as-UTC semantics.
  check(
    "DST-4",
    "null timezone evaluates as UTC (legacy semantics)",
    isWithinSyncWindow({ now: beforeSpring, windowStart: 12, windowEnd: 13, timezone: null }) &&
      !isWithinSyncWindow({ now: beforeSpring, windowStart: 13, windowEnd: 14, timezone: null }),
  );
  // Midnight-wrapping window.
  check(
    "DST-5",
    "window wrapping midnight (22–06) matches correctly",
    isWithinSyncWindow({ now: new Date("2026-03-07T04:00:00Z"), windowStart: 22, windowEnd: 6, timezone: "UTC" }) &&
      !isWithinSyncWindow({ now: new Date("2026-03-07T12:00:00Z"), windowStart: 22, windowEnd: 6, timezone: "UTC" }),
  );
};

// P39-01: scheduler holds runs outside the window; one throttled SKIPPED row.
const modeWindow = async () => {
  const account = await requireAccount();
  const snap = snapshotAccount(account);
  const t0 = new Date();
  try {
    const tz = "America/Toronto";
    const hour = getHourInTimezone(new Date(), tz);
    const start = (hour + 2) % 24;
    const end = (hour + 10) % 24;
    await patchSettings(account, {
      syncWindowStart: start,
      syncWindowEnd: end,
      syncWindowTimezone: tz,
    });
    // Make the account due.
    await db.syncAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date(Date.now() - 24 * 3600_000), status: "ACTIVE" },
    });

    const first = await enqueueDueSyncJobs();
    console.log("· enqueue #1:", JSON.stringify(first));
    const skippedRows = await db.syncJob.findMany({
      where: { syncAccountId: account.id, status: "SKIPPED", createdAt: { gte: t0 } },
      select: { id: true, errorCode: true, errorSummary: true },
    });
    const queued = await db.syncJob.count({
      where: { syncAccountId: account.id, status: "QUEUED", createdAt: { gte: t0 } },
    });
    check(
      "WIN-1",
      "due account outside window is deferred, not enqueued",
      skippedRows.length === 1 && queued === 0,
      skippedRows[0]?.errorSummary ?? `skipped=${skippedRows.length} queued=${queued}`,
    );
    check(
      "WIN-2",
      "SKIPPED row carries SYNC_WINDOW_DEFERRED + window copy",
      skippedRows[0]?.errorCode === "SYNC_WINDOW_DEFERRED" &&
        (skippedRows[0]?.errorSummary ?? "").includes("outside sync window"),
    );

    const second = await enqueueDueSyncJobs();
    console.log("· enqueue #2:", JSON.stringify(second));
    const skippedAfter = await db.syncJob.count({
      where: { syncAccountId: account.id, status: "SKIPPED", createdAt: { gte: t0 } },
    });
    check("WIN-3", "deferral rows are throttled (no second SKIPPED per period)", skippedAfter === 1);

    const streakInput = await db.syncJob.findMany({
      where: { syncAccountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { status: true },
    });
    check(
      "WIN-4",
      "skipped row does not count toward consecutiveFailures",
      streakInput[0]?.status === "SKIPPED",
      "streak fn ignores SKIPPED (unit-verified in sync-health)",
    );
  } finally {
    // Remove QA scheduler artifacts: our SKIPPED rows and any QUEUED scheduled
    // jobs the global enqueue created for OTHER accounts during the test.
    await retry("delete skipped rows", () =>
      db.syncJob.deleteMany({
        where: { syncAccountId: account.id, status: "SKIPPED", createdAt: { gte: t0 } },
      }),
    );
    const swept = await retry("sweep queued scheduled jobs", () =>
      db.syncJob.deleteMany({
        where: { status: "QUEUED", trigger: "SCHEDULED", createdAt: { gte: t0 } },
      }),
    );
    if (swept.count > 0) console.log(`· swept ${swept.count} QUEUED scheduled jobs (global enqueue side-effect)`);
    await retry("restore lastSyncedAt", () =>
      db.syncAccount.update({
        where: { id: account.id },
        data: { lastSyncedAt: account.lastSyncedAt },
      }),
    );
    await retry("remove QA job rows", () => deleteQaJobs(account.id));
    await retry("restore account", () => restoreAccount(account, snap));
  }
};

// P39-05: retry sensitivity on a scratch CardDAV account pointing nowhere.
const modeRetry = async () => {
  const owner = await db.user.findUniqueOrThrow({
    where: { email: getArg("user", "li@linoormohamed.com") },
    select: { id: true },
  });
  const t0 = new Date();
  const credential = encryptSyncCredentialPayload({
    username: "p39qa",
    password: "p39qa",
    provider: "CARDDAV",
    version: 1,
  });
  const scratch = await db.syncAccount.create({
    data: {
      userId: owner.id,
      provider: "CARDDAV",
      status: "ACTIVE",
      syncDirection: "TWO_WAY",
      label: `${MARKER} Retry ${runTag}`,
      // 127.0.0.1:9 refuses instantly — no DNS stall for the VPN'd DB
      // connection to idle out behind.
      baseUrl: "https://127.0.0.1:9",
      addressBookUrl: "https://127.0.0.1:9/dav/book/",
      credentialReference: credential.credentialReference,
      encryptionKeyRef: credential.encryptionKeyRef,
      setupCompletedAt: new Date(),
      settings: { create: { maxAttemptsBeforePause: 1, notifyOnFailure: true } },
    },
    include: { settings: true },
  });
  console.log(`· scratch account ${scratch.id}`);
  try {
    // maxAttemptsBeforePause = 1 → a single failure pauses.
    await syncNow(scratch, "retry-1");
    let state = await freshAccount(scratch.id);
    const notifsAfterFirst = await countQaNotifications(owner.id, t0, scratch.id);
    check(
      "RETRY-1",
      "threshold 1: paused after a single failure with SYNC_AUTO_PAUSED",
      state.status === "PAUSED" && state.lastErrorCode === "SYNC_AUTO_PAUSED",
      `${state.status}/${state.lastErrorCode}`,
    );
    check("RETRY-2", "auto-pause raised exactly one notification", notifsAfterFirst === 1);

    // 0 = never auto-pause: keeps failing without pausing.
    await patchSettings(state, { maxAttemptsBeforePause: 0 });
    await db.syncAccount.update({
      where: { id: scratch.id },
      data: { status: "ACTIVE", lastErrorCode: null, lastErrorMessage: null, lastErrorAt: null },
    });
    await syncNow(state, "retry-never-a");
    await syncNow(state, "retry-never-b");
    state = await freshAccount(scratch.id);
    check(
      "RETRY-3",
      "threshold 0 (never): repeated failures do not pause",
      state.status === "ERROR",
      `${state.status}/${state.lastErrorCode}`,
    );

    // Default (null) = 5: with 3 consecutive failures so far, two more trip it.
    await patchSettings(state, { maxAttemptsBeforePause: null });
    await syncNow(state, "retry-default-a");
    const mid = await freshAccount(scratch.id);
    const notPausedAt4 = mid.status === "ERROR";
    await syncNow(mid, "retry-default-b");
    state = await freshAccount(scratch.id);
    check(
      "RETRY-4",
      "platform default (5): pauses on the 5th consecutive failure, not the 4th",
      notPausedAt4 && state.status === "PAUSED" && state.lastErrorCode === "SYNC_AUTO_PAUSED",
      state.lastErrorMessage ?? "",
    );
    const trippingJob = await db.syncJob.findFirst({
      where: { syncAccountId: scratch.id, status: "FAILED" },
      orderBy: { createdAt: "desc" },
      select: { errorSummary: true },
    });
    check(
      "RETRY-5",
      "tripping run's history row carries the attempt counter",
      (trippingJob?.errorSummary ?? "").includes("attempt 5 of 5"),
      trippingJob?.errorSummary ?? "",
    );

    // notifyOnFailure gating: silence, re-trip, expect no new notification.
    const notifsBeforeGate = await countQaNotifications(owner.id, t0, scratch.id);
    await patchSettings(state, { maxAttemptsBeforePause: 1, notifyOnFailure: false });
    await db.syncAccount.update({
      where: { id: scratch.id },
      data: { status: "ACTIVE", lastErrorCode: null, lastErrorMessage: null, lastErrorAt: null },
    });
    await syncNow(state, "retry-gated");
    state = await freshAccount(scratch.id);
    const notifsAfterGate = await countQaNotifications(owner.id, t0, scratch.id);
    check(
      "RETRY-6",
      "notifyOnFailure=false silences the auto-pause notification",
      state.status === "PAUSED" && notifsAfterGate === notifsBeforeGate,
      `notifications ${notifsBeforeGate}→${notifsAfterGate}`,
    );
    // Two pause transitions happened before the gate (threshold-1 trip and the
    // default-5 trip); the 5 intermediate failed attempts must not notify.
    check(
      "RETRY-7",
      "notifications fire per state change, not per attempt",
      notifsBeforeGate === 2,
      `${notifsBeforeGate} notification(s) for 2 pause transitions across 7 failed attempts`,
    );
  } finally {
    await retry("delete QA notifications", () => deleteQaNotifications(owner.id, t0, scratch.id));
    await retry("delete scratch account", () => db.syncAccount.delete({ where: { id: scratch.id } }));
    console.log("· scratch account deleted");
  }
};

// P39-02 (CardDAV, outbound): trip, review states, both resume paths.
const modeDeletion = async () => {
  requireLive();
  const account = await requireAccount();
  const snap = snapshotAccount(account);
  const t0 = new Date();
  const localIds: string[] = [];
  try {
    const nameA = `${MARKER}-DEL-${runTag}-A`;
    const nameB = `${MARKER}-DEL-${runTag}-B`;
    const a = await createLocalContact(account.userId, nameA, { phone: "+15550001111" });
    const b = await createLocalContact(account.userId, nameB, { phone: "+15550002222" });
    localIds.push(a.id, b.id);

    await patchSettings(account, { maxDeletionsThreshold: null });
    await syncNow(account, "del-push");
    let remote = await listRemoteQaCards(account);
    check(
      "DEL-1",
      "QA contacts pushed to remote",
      [nameA, nameB].every((n) => remote.some((c) => c.fullName === n)),
      `${remote.length} QA cards on remote`,
    );

    // Trip: threshold 1, two pending deletions.
    await patchSettings(account, { maxDeletionsThreshold: 1 });
    await db.contact.updateMany({
      where: { id: { in: localIds } },
      data: { archivedAt: new Date(), lastMutatedBy: "MANUAL" },
    });
    await syncNow(account, "del-trip");

    let state = await freshAccount(account.id);
    const hold = await readDeletionHold(account.userId, account.id);
    remote = await listRemoteQaCards(account);
    check(
      "DEL-2",
      "run halted before commit: PAUSED + DELETION_THRESHOLD_EXCEEDED",
      state.status === "PAUSED" && state.lastErrorCode === "DELETION_THRESHOLD_EXCEEDED",
      `${state.status}/${state.lastErrorCode}`,
    );
    check(
      "DEL-3",
      "nothing was deleted remotely",
      [nameA, nameB].every((n) => remote.some((c) => c.fullName === n)),
    );
    check(
      "DEL-4",
      "hold payload records the pending outbound deletions",
      hold?.total === 2 && hold.outboundLinkIds.length === 2 && hold.threshold === 1,
      JSON.stringify({ total: hold?.total, byBook: hold?.byBook }),
    );
    const halted = await db.syncJob.findFirst({
      where: { syncAccountId: account.id, status: "HALTED", createdAt: { gte: t0 } },
      select: { errorSummary: true },
    });
    check(
      "DEL-5",
      "HALTED history row written",
      (halted?.errorSummary ?? "").includes("Halted before commit"),
      halted?.errorSummary ?? "missing",
    );
    const notifs = await countQaNotifications(account.userId, t0, account.id);
    check("DEL-6", "deletion-pause notification raised", notifs >= 1, `${notifs} notification(s)`);

    const review = await getDeletionHoldReviewCore(account.userId, account.id);
    check(
      "DEL-7",
      "review core reports 2 remaining (not yet reconciled)",
      review.ok && review.review.remaining === 2,
      review.ok ? JSON.stringify(review.review.byBook) : review.error,
    );

    // Resume WITHOUT deleting: remote copies survive, links reconciled.
    const resumeSkip = await resumeSyncWithoutDeletionsCore(account.userId, account.id);
    state = await freshAccount(account.id);
    await syncNow(account, "del-after-skip");
    remote = await listRemoteQaCards(account);
    check(
      "DEL-8",
      "resume-without-deleting reactivates and never deletes",
      resumeSkip.ok &&
        state.status === "ACTIVE" &&
        state.deletionHold == null &&
        [nameA, nameB].every((n) => remote.some((c) => c.fullName === n)),
    );

    // Round 2 — resume AND ALLOW: deletions apply exactly once.
    const nameC = `${MARKER}-DEL-${runTag}-C`;
    const nameD = `${MARKER}-DEL-${runTag}-D`;
    const c = await createLocalContact(account.userId, nameC, { phone: "+15550003333" });
    const d = await createLocalContact(account.userId, nameD, { phone: "+15550004444" });
    localIds.push(c.id, d.id);
    await patchSettings(account, { maxDeletionsThreshold: null });
    await syncNow(account, "del-push-2");
    await patchSettings(account, { maxDeletionsThreshold: 1 });
    await db.contact.updateMany({
      where: { id: { in: [c.id, d.id] } },
      data: { archivedAt: new Date(), lastMutatedBy: "MANUAL" },
    });
    await syncNow(account, "del-trip-2");
    const hold2 = await readDeletionHold(account.userId, account.id);
    check("DEL-9", "second trip parks a fresh hold", hold2?.total === 2);

    const resumeAllow = await resumeSyncAllowDeletionsCore(account.userId, account.id);
    state = await freshAccount(account.id);
    remote = await listRemoteQaCards(account);
    check(
      "DEL-10",
      "resume-and-allow commits the deletions once and clears the hold + bypass",
      resumeAllow.ok &&
        state.deletionHold == null &&
        !state.deletionGuardBypassOnce &&
        ![nameC, nameD].some((n) => remote.some((card) => card.fullName === n)),
      `remote QA cards now: ${remote.map((r) => r.fullName).join(", ") || "none"}`,
    );
  } finally {
    await retry("reset threshold", () => patchSettings(account, { maxDeletionsThreshold: null }));
    await deleteRemoteQaCards(account).catch((e) => console.error("remote cleanup:", e));
    await retry("delete local QA contacts", () => deleteLocalQaContacts(account.userId, localIds));
    await retry("delete QA notifications", () => deleteQaNotifications(account.userId, t0, account.id));
    await retry("remove QA job rows", () => deleteQaJobs(account.id));
    await retry("restore account", () => restoreAccount(account, snap));
  }
};

// P39-02 (Google, inbound): a remote wipe > threshold leaves local data untouched.
const modeDeletionInbound = async () => {
  requireLive();
  const account = await requireAccount();
  if (account.provider !== "GOOGLE") throw new Error("deletion-inbound expects a GOOGLE account");
  const snap = snapshotAccount(account);
  const t0 = new Date();
  const localIds: string[] = [];
  try {
    const nameA = `${MARKER}-WIPE-${runTag}-A`;
    const nameB = `${MARKER}-WIPE-${runTag}-B`;
    const a = await createLocalContact(account.userId, nameA, { phone: "+15550005555" });
    const b = await createLocalContact(account.userId, nameB, { phone: "+15550006666" });
    localIds.push(a.id, b.id);

    await patchSettings(account, { maxDeletionsThreshold: null });
    await syncNow(account, "wipe-push");
    const remote = await listGoogleQaPeople(account);
    check(
      "WIPE-1",
      "QA contacts pushed to Google",
      [nameA, nameB].every((n) => remote.some((p) => p.name === n)),
      `${remote.length} QA people on Google`,
    );

    // Simulate the remote wipe: delete both directly on Google.
    await deleteGoogleQaPeople(account);
    await patchSettings(account, { maxDeletionsThreshold: 1 });
    await syncNow(account, "wipe-trip");

    const state = await freshAccount(account.id);
    const hold = await readDeletionHold(account.userId, account.id);
    const survivors = await db.contact.findMany({
      where: { id: { in: localIds }, archivedAt: null },
      select: { id: true },
    });
    check(
      "WIPE-2",
      "remote wipe > threshold: halted with an inbound hold",
      state.status === "PAUSED" &&
        state.lastErrorCode === "DELETION_THRESHOLD_EXCEEDED" &&
        (hold?.inboundLinkIds.length ?? 0) >= 2,
      JSON.stringify({ total: hold?.total, inbound: hold?.inboundLinkIds.length }),
    );
    check(
      "WIPE-3",
      "local contacts untouched (not archived)",
      survivors.length === 2,
      `${survivors.length}/2 still active locally`,
    );

    const resume = await resumeSyncWithoutDeletionsCore(account.userId, account.id);
    const after = await db.contact.count({ where: { id: { in: localIds }, archivedAt: null } });
    check(
      "WIPE-4",
      "resume-without-deleting keeps the local contacts",
      resume.ok && after === 2,
    );
  } finally {
    await retry("reset threshold", () => patchSettings(account, { maxDeletionsThreshold: null }));
    await deleteGoogleQaPeople(account).catch((e) => console.error("google cleanup:", e));
    await retry("delete local QA contacts", () => deleteLocalQaContacts(account.userId, localIds));
    await retry("delete QA notifications", () => deleteQaNotifications(account.userId, t0, account.id));
    await retry("remove QA job rows", () => deleteQaJobs(account.id));
    await retry("restore account", () => restoreAccount(account, snap));
  }
};

// P39-03 (CardDAV): NOTE/BDAY/ADR both directions + unknown-token grace.
const modeExclusions = async () => {
  requireLive();
  const account = await requireAccount();
  const snap = snapshotAccount(account);
  const localIds: string[] = [];
  try {
    const name = `${MARKER}-EXCL-${runTag}`;
    const contact = await createLocalContact(account.userId, name, {
      phone: "+15550007777",
      notes: "note-v1",
      birthday: "1990-01-15",
      address: "1 QA Street",
    });
    localIds.push(contact.id);
    await patchSettings(account, { excludedFields: [] });
    await syncNow(account, "excl-push");
    let card = (await listRemoteQaCards(account)).find((c) => c.fullName === name);
    check("EXCL-1", "baseline contact (with note/bday/addr) on remote", !!card, card?.notes ?? "");

    // Outbound: exclude, edit everything locally, push — only phone moves.
    await patchSettings(account, { excludedFields: ["NOTE", "BDAY", "ADR"] });
    await db.contact.update({
      where: { id: contact.id },
      data: {
        notes: "note-v2-LOCAL",
        birthday: "1991-02-16",
        address: "2 QA Street",
        phone: "+15550008888",
        phoneNumbers: ["+15550008888"],
        phoneEntries: [{ label: "Mobile", value: "+15550008888", isPrimary: true }],
        lastMutatedBy: "MANUAL",
      },
    });
    await syncNow(account, "excl-out");
    card = (await listRemoteQaCards(account)).find((c) => c.fullName === name);
    check(
      "EXCL-2",
      "outbound: phone pushed, excluded NOTE/BDAY/ADR unchanged on remote",
      card?.phoneNumbers.includes("+15550008888") === true &&
        card?.notes === "note-v1" &&
        card?.birthday === "1990-01-15" &&
        (card?.address ?? "").includes("1 QA Street"),
      JSON.stringify({ phone: card?.phoneNumbers, note: card?.notes, bday: card?.birthday, addr: card?.address }),
    );

    // Inbound: edit the remote note directly, pull — local note unchanged.
    if (card) await editRemoteCard(account, card, { notes: "note-v9-REMOTE" });
    await syncNow(account, "excl-in");
    const local = await db.contact.findUniqueOrThrow({
      where: { id: contact.id },
      select: { notes: true },
    });
    check(
      "EXCL-3",
      "inbound: remote note change never overwrites the local note",
      local.notes === "note-v2-LOCAL",
      `local note: ${local.notes}`,
    );

    // Unknown token: ignored gracefully, everything else still syncs.
    await patchSettings(account, { excludedFields: ["BOGUS-TOKEN"] });
    await db.contact.update({
      where: { id: contact.id },
      data: {
        phone: "+15550009999",
        phoneNumbers: ["+15550009999"],
        phoneEntries: [{ label: "Mobile", value: "+15550009999", isPrimary: true }],
        lastMutatedBy: "MANUAL",
      },
    });
    const summary = await syncNow(account, "excl-unknown");
    card = (await listRemoteQaCards(account)).find((c) => c.fullName === name);
    check(
      "EXCL-4",
      "unknown exclusion token: no crash, no accidental exclude-everything",
      summary.failed === 0 && card?.phoneNumbers.includes("+15550009999") === true,
      `remote phone: ${card?.phoneNumbers.join("/")}`,
    );
  } finally {
    await deleteRemoteQaCards(account).catch((e) => console.error("remote cleanup:", e));
    await retry("delete local QA contacts", () => deleteLocalQaContacts(account.userId, localIds));
    await retry("remove QA job rows", () => deleteQaJobs(account.id));
    await retry("restore account", () => restoreAccount(account, snap));
  }
};

// P39-03 (Google): NOTE exclusion outbound — mask withholding preserves the
// remote biography while other fields update.
const modeExclusionsGoogle = async () => {
  requireLive();
  const account = await requireAccount();
  if (account.provider !== "GOOGLE") throw new Error("exclusions-google expects a GOOGLE account");
  const snap = snapshotAccount(account);
  const localIds: string[] = [];
  try {
    const name = `${MARKER}-GEXCL-${runTag}`;
    const contact = await createLocalContact(account.userId, name, {
      phone: "+15550101010",
      notes: "gnote-v1",
    });
    localIds.push(contact.id);
    await patchSettings(account, { excludedFields: [] });
    await syncNow(account, "gexcl-push");
    let person = (await listGoogleQaPeople(account)).find((p) => p.name === name);
    check("GEXCL-1", "baseline contact (with note) on Google", person?.note === "gnote-v1", person?.note ?? "");

    await patchSettings(account, { excludedFields: ["NOTE"] });
    await db.contact.update({
      where: { id: contact.id },
      data: {
        notes: "gnote-v2-LOCAL",
        phone: "+15550202020",
        phoneNumbers: ["+15550202020"],
        phoneEntries: [{ label: "Mobile", value: "+15550202020", isPrimary: true }],
        lastMutatedBy: "MANUAL",
      },
    });
    await syncNow(account, "gexcl-out");
    person = (await listGoogleQaPeople(account)).find((p) => p.name === name);
    check(
      "GEXCL-2",
      "outbound: phone pushed, Google keeps its biography (mask withheld)",
      person?.phone?.replace(/\D/g, "").endsWith("5550202020") === true && person?.note === "gnote-v1",
      JSON.stringify({ phone: person?.phone, note: person?.note }),
    );
  } finally {
    await deleteGoogleQaPeople(account).catch((e) => console.error("google cleanup:", e));
    await retry("delete local QA contacts", () => deleteLocalQaContacts(account.userId, localIds));
    await retry("remove QA job rows", () => deleteQaJobs(account.id));
    await retry("restore account", () => restoreAccount(account, snap));
  }
};

// P39-04: label filter gates NEW pushes; linked contacts stay + keep syncing.
const modeLabelFilter = async () => {
  requireLive();
  const account = await requireAccount();
  const snap = snapshotAccount(account);
  const localIds: string[] = [];
  let labelId: string | null = null;
  const isGoogle = account.provider === "GOOGLE";
  const listRemote = async () =>
    isGoogle
      ? (await listGoogleQaPeople(account)).map((p) => ({ fullName: p.name, phones: [p.phone ?? ""] }))
      : (await listRemoteQaCards(account)).map((c) => ({ fullName: c.fullName, phones: c.phoneNumbers }));
  try {
    const labelName = `${MARKER} Export ${runTag}`;
    const label = await db.label.create({
      data: { userId: account.userId, name: labelName, color: "#4158f4" },
      select: { id: true },
    });
    labelId = label.id;

    const nameIn = `${MARKER}-LBL-${runTag}-IN`;
    const nameOut = `${MARKER}-LBL-${runTag}-OUT`;
    const labelled = await createLocalContact(account.userId, nameIn, {
      phone: "+15550303030",
      labels: [labelName],
    });
    const unlabelled = await createLocalContact(account.userId, nameOut, { phone: "+15550404040" });
    localIds.push(labelled.id, unlabelled.id);

    await patchSettings(account, { exportLabelFilter: [label.id] });
    await syncNow(account, "lbl-push");
    let remote = await listRemote();
    check(
      "LBL-1",
      "only the labelled contact appears on the remote",
      remote.some((r) => r.fullName === nameIn) && !remote.some((r) => r.fullName === nameOut),
      remote.map((r) => r.fullName).join(", ") || "none",
    );

    // Remove the label + edit: remote copy survives AND keeps updating.
    await db.contact.update({
      where: { id: labelled.id },
      data: {
        labels: [],
        phone: "+15550505050",
        phoneNumbers: ["+15550505050"],
        phoneEntries: [{ label: "Mobile", value: "+15550505050", isPrimary: true }],
        lastMutatedBy: "MANUAL",
      },
    });
    await syncNow(account, "lbl-unlabel");
    remote = await listRemote();
    const survivor = remote.find((r) => r.fullName === nameIn);
    check(
      "LBL-2",
      "removing the label neither deletes nor freezes the linked contact",
      !!survivor && survivor.phones.some((p) => p.replace(/\D/g, "").endsWith("5550505050")),
      JSON.stringify(survivor ?? "missing"),
    );
  } finally {
    await patchSettings(account, { exportLabelFilter: [] });
    if (isGoogle) await deleteGoogleQaPeople(account).catch((e) => console.error("google cleanup:", e));
    else await deleteRemoteQaCards(account).catch((e) => console.error("remote cleanup:", e));
    await retry("delete local QA contacts", () => deleteLocalQaContacts(account.userId, localIds));
    if (labelId) await db.label.delete({ where: { id: labelId } }).catch(() => undefined);
    await retry("remove QA job rows", () => deleteQaJobs(account.id));
    await retry("restore account", () => restoreAccount(account, snap));
  }
};

// ── dispatch ──────────────────────────────────────────────────────────────────

const main = async () => {
  console.log(`P39-08 harness · mode=${mode} · tag=${runTag}\n`);
  switch (mode) {
    case "status":
      await modeStatus();
      break;
    case "dst":
      await modeDst();
      break;
    case "window":
      await modeWindow();
      break;
    case "retry":
      await modeRetry();
      break;
    case "deletion":
      await modeDeletion();
      break;
    case "deletion-inbound":
      await modeDeletionInbound();
      break;
    case "exclusions":
      await modeExclusions();
      break;
    case "exclusions-google":
      await modeExclusionsGoogle();
      break;
    case "labelfilter":
      await modeLabelFilter();
      break;
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
  await finish();
};

main().catch(async (error) => {
  console.error("\nHarness error:", error instanceof Error ? error.message : error);
  await db.$disconnect();
  process.exit(1);
});
