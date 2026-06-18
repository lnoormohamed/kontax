// seed-sync-showcase.mjs — multi-account sync showcase for staging
//
// Adds to li@linoormohamed.com:
//   • A second Google account (work, NEEDS_REAUTH)
//   • A Microsoft / Outlook account (healthy)
//   • Realistic SyncJob history for all 5 accounts
//   • SyncAccountSettings for each
//   • One open SyncConflict on the Fastmail account
//
// Usage:
//   node scripts/seed-sync-showcase.mjs
//   node scripts/seed-sync-showcase.mjs --reset   # wipe added accounts first

import { PrismaClient } from '../generated/prisma/index.js';

const db = new PrismaClient();
const TARGET_EMAIL = 'li@linoormohamed.com';

const hoursAgo  = (n) => new Date(Date.now() - n * 3_600_000);
const minsAgo   = (n) => new Date(Date.now() - n * 60_000);
const daysAgo   = (n) => new Date(Date.now() - n * 86_400_000);
const hasFlag   = (f) => process.argv.includes(`--${f}`);

// ── helpers ──────────────────────────────────────────────────────────────────
async function upsertSettings(syncAccountId, overrides = {}) {
  return db.syncAccountSettings.upsert({
    where:  { syncAccountId },
    update: overrides,
    create: { syncAccountId, bookAllowlist: [], ...overrides },
  });
}

async function addJobs(syncAccountId, rows) {
  // Avoid duplicates via idempotencyKey
  for (const row of rows) {
    const { idempotencyKey, ...data } = row;
    await db.syncJob.upsert({
      where:  { syncAccountId_idempotencyKey: { syncAccountId, idempotencyKey } },
      update: {},
      create: { syncAccountId, idempotencyKey, ...data },
    });
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
const user = await db.user.findUnique({ where: { email: TARGET_EMAIL } });
if (!user) { console.error('User not found'); process.exitCode = 1; process.exit(); }

// ── optional reset ────────────────────────────────────────────────────────────
if (hasFlag('reset')) {
  const labels = ['Google Contacts Work', 'Outlook / Exchange'];
  const deleted = await db.syncAccount.deleteMany({
    where: { userId: user.id, label: { in: labels } },
  });
  console.log(`Reset: removed ${deleted.count} showcase sync account(s).`);
}

// ── 1. Second Google account — work email, NEEDS_REAUTH ──────────────────────
const googleWork = await db.syncAccount.upsert({
  where: { userId_baseUrl_label: { userId: user.id, baseUrl: 'https://people.googleapis.com/v1', label: 'Google Contacts Work' } },
  update: { status: 'NEEDS_REAUTH', lastSyncedAt: hoursAgo(6), lastErrorAt: hoursAgo(4), lastErrorCode: 'AUTH_FAILED', lastErrorMessage: 'Token expired' },
  create: {
    userId: user.id,
    provider: 'GOOGLE',
    label: 'Google Contacts Work',
    baseUrl: 'https://people.googleapis.com/v1',
    remoteAccountId: 'li@kontax.io',
    status: 'NEEDS_REAUTH',
    lastSyncedAt: hoursAgo(6),
    lastSucceededAt: hoursAgo(48),
    lastErrorAt: hoursAgo(4),
    lastErrorCode: 'AUTH_FAILED',
    lastErrorMessage: 'Token expired — please re-authorise',
  },
});
await upsertSettings(googleWork.id, {
  syncDirection: 'TWO_WAY',
  conflictPolicy: 'SERVER_WINS',
  syncFrequencyMinutes: 60,
});
await addJobs(googleWork.id, [
  { idempotencyKey: 'gw-ok-1',    syncDirection: 'TWO_WAY',    status: 'SUCCEEDED', trigger: 'SCHEDULED', createdCount: 4, updatedCount: 7,  deletedCount: 0, pushedUpdatedCount: 2, startedAt: daysAgo(3),   completedAt: daysAgo(3) },
  { idempotencyKey: 'gw-ok-2',    syncDirection: 'TWO_WAY',    status: 'SUCCEEDED', trigger: 'SCHEDULED', createdCount: 0, updatedCount: 2,  deletedCount: 1, pushedUpdatedCount: 0, startedAt: daysAgo(2),   completedAt: daysAgo(2) },
  { idempotencyKey: 'gw-fail-1',  syncDirection: 'TWO_WAY',    status: 'FAILED',    trigger: 'SCHEDULED', errorCode: 'AUTH_FAILED', errorSummary: 'OAuth token expired', startedAt: hoursAgo(6), completedAt: hoursAgo(6) },
  { idempotencyKey: 'gw-fail-2',  syncDirection: 'TWO_WAY',    status: 'FAILED',    trigger: 'SCHEDULED', errorCode: 'AUTH_FAILED', errorSummary: 'OAuth token expired', startedAt: hoursAgo(2), completedAt: hoursAgo(2) },
]);

// ── 2. Microsoft / Outlook ── healthy, two-way ────────────────────────────────
const msAccount = await db.syncAccount.upsert({
  where: { userId_baseUrl_label: { userId: user.id, baseUrl: 'https://graph.microsoft.com/v1.0', label: 'Outlook / Exchange' } },
  update: { status: 'ACTIVE', lastSyncedAt: minsAgo(25) },
  create: {
    userId: user.id,
    provider: 'MICROSOFT',
    label: 'Outlook / Exchange',
    baseUrl: 'https://graph.microsoft.com/v1.0',
    remoteAccountId: 'li@linoormohamed.com',
    status: 'ACTIVE',
    lastSyncedAt: minsAgo(25),
    lastSucceededAt: minsAgo(25),
  },
});
await upsertSettings(msAccount.id, {
  syncDirection: 'TWO_WAY',
  conflictPolicy: 'MANUAL',
  syncFrequencyMinutes: 30,
});
await addJobs(msAccount.id, [
  { idempotencyKey: 'ms-ok-1', syncDirection: 'TWO_WAY', status: 'SUCCEEDED', trigger: 'MANUAL',     createdCount: 198, updatedCount: 0,  deletedCount: 0,  pushedCreatedCount: 0, pushedUpdatedCount: 0, startedAt: daysAgo(7),  completedAt: daysAgo(7) },
  { idempotencyKey: 'ms-ok-2', syncDirection: 'TWO_WAY', status: 'SUCCEEDED', trigger: 'SCHEDULED',  createdCount: 3,   updatedCount: 5,  deletedCount: 0,  pushedUpdatedCount: 1, startedAt: daysAgo(4),  completedAt: daysAgo(4) },
  { idempotencyKey: 'ms-ok-3', syncDirection: 'TWO_WAY', status: 'SUCCEEDED', trigger: 'SCHEDULED',  createdCount: 0,   updatedCount: 2,  deletedCount: 0,  pushedUpdatedCount: 3, startedAt: daysAgo(1),  completedAt: daysAgo(1) },
  { idempotencyKey: 'ms-ok-4', syncDirection: 'TWO_WAY', status: 'SUCCEEDED', trigger: 'SCHEDULED',  createdCount: 1,   updatedCount: 0,  deletedCount: 0,  pushedUpdatedCount: 0, startedAt: minsAgo(25), completedAt: minsAgo(25) },
]);

// ── 3. Enrich the existing 3 accounts with job history + settings ─────────────
const [googlePersonal, fastmail, icloud] = await Promise.all([
  db.syncAccount.findFirst({ where: { userId: user.id, provider: 'GOOGLE', label: 'Google Contacts' } }),
  db.syncAccount.findFirst({ where: { userId: user.id, label: 'Fastmail Personal' } }),
  db.syncAccount.findFirst({ where: { userId: user.id, label: 'iCloud' } }),
]);

if (googlePersonal) {
  await upsertSettings(googlePersonal.id, { syncDirection: 'TWO_WAY', conflictPolicy: 'SERVER_WINS', syncFrequencyMinutes: 60 });
  await addJobs(googlePersonal.id, [
    { idempotencyKey: 'gp-ok-init', syncDirection: 'IMPORT_ONLY', status: 'SUCCEEDED', trigger: 'MANUAL',    createdCount: 541, updatedCount: 0,  deletedCount: 0, startedAt: daysAgo(14), completedAt: daysAgo(14) },
    { idempotencyKey: 'gp-ok-1',    syncDirection: 'TWO_WAY',    status: 'SUCCEEDED', trigger: 'SCHEDULED', createdCount: 2,   updatedCount: 11, deletedCount: 1, pushedUpdatedCount: 4, startedAt: daysAgo(6),  completedAt: daysAgo(6) },
    { idempotencyKey: 'gp-ok-2',    syncDirection: 'TWO_WAY',    status: 'SUCCEEDED', trigger: 'SCHEDULED', createdCount: 0,   updatedCount: 3,  deletedCount: 0, pushedUpdatedCount: 1, startedAt: daysAgo(2),  completedAt: daysAgo(2) },
    { idempotencyKey: 'gp-ok-3',    syncDirection: 'TWO_WAY',    status: 'SUCCEEDED', trigger: 'SCHEDULED', createdCount: 0,   updatedCount: 1,  deletedCount: 0, pushedUpdatedCount: 0, startedAt: hoursAgo(2), completedAt: hoursAgo(2) },
  ]);
}

if (fastmail) {
  await upsertSettings(fastmail.id, { syncDirection: 'TWO_WAY', conflictPolicy: 'MANUAL', syncFrequencyMinutes: 60 });
  await addJobs(fastmail.id, [
    { idempotencyKey: 'fm-ok-init', syncDirection: 'IMPORT_ONLY', status: 'SUCCEEDED', trigger: 'MANUAL',    createdCount: 88, updatedCount: 0, deletedCount: 0, startedAt: daysAgo(10), completedAt: daysAgo(10) },
    { idempotencyKey: 'fm-ok-1',    syncDirection: 'TWO_WAY',    status: 'SUCCEEDED', trigger: 'SCHEDULED', createdCount: 1, updatedCount: 3, deletedCount: 0, pushedUpdatedCount: 2, startedAt: daysAgo(5),  completedAt: daysAgo(5) },
    { idempotencyKey: 'fm-ok-2',    syncDirection: 'TWO_WAY',    status: 'SUCCEEDED', trigger: 'SCHEDULED', createdCount: 0, updatedCount: 1, deletedCount: 0, pushedUpdatedCount: 1, startedAt: daysAgo(2),  completedAt: daysAgo(2) },
    { idempotencyKey: 'fm-warn-1',  syncDirection: 'TWO_WAY',    status: 'FAILED',    trigger: 'SCHEDULED', errorCode: 'NETWORK_TIMEOUT', errorSummary: 'Connection timed out after 30s', startedAt: daysAgo(1), completedAt: daysAgo(1) },
    { idempotencyKey: 'fm-ok-3',    syncDirection: 'TWO_WAY',    status: 'SUCCEEDED', trigger: 'SCHEDULED', createdCount: 0, updatedCount: 2, deletedCount: 0, pushedUpdatedCount: 0, startedAt: hoursAgo(4), completedAt: hoursAgo(4) },
  ]);

  // Open conflict on Fastmail (MANUAL policy makes sense)
  // Find a real contact to attach it to
  const sampleContact = await db.contact.findFirst({
    where: { userId: user.id, firstName: { not: null }, phone: { not: null } },
    select: { id: true, fullName: true, phone: true },
  });
  if (sampleContact) {
    await db.syncConflict.upsert({
      where: { id: `demo-conflict-${fastmail.id}` },
      update: {},
      create: {
        id: `demo-conflict-${fastmail.id}`,
        syncAccountId: fastmail.id,
        contactId: sampleContact.id,
        conflictType: 'LOCAL_REMOTE_MUTATION',
        conflictSource: 'INBOUND_DEVICE',
        status: 'OPEN',
        localSnapshot: {
          fieldName: 'phone',
          fieldLabel: 'Phone',
          localValue: sampleContact.phone,
          localEditedAt: hoursAgo(12).toISOString(),
        },
        remoteSnapshot: {
          fieldName: 'phone',
          fieldLabel: 'Phone',
          remoteValue: '+44 7700 900000',
          remoteEditedAt: hoursAgo(8).toISOString(),
        },
        detectedAt: hoursAgo(8),
      },
    });
    console.log(`  • Open SyncConflict on Fastmail for "${sampleContact.fullName}" (phone)`);
  }
}

if (icloud) {
  await upsertSettings(icloud.id, { syncDirection: 'IMPORT_ONLY', conflictPolicy: 'SERVER_WINS', syncFrequencyMinutes: 360 });
  await addJobs(icloud.id, [
    { idempotencyKey: 'ic-ok-init', syncDirection: 'IMPORT_ONLY', status: 'SUCCEEDED', trigger: 'MANUAL',    createdCount: 124, updatedCount: 0, deletedCount: 0, startedAt: daysAgo(8),  completedAt: daysAgo(8) },
    { idempotencyKey: 'ic-ok-1',    syncDirection: 'IMPORT_ONLY', status: 'SUCCEEDED', trigger: 'SCHEDULED', createdCount: 0, updatedCount: 4, deletedCount: 0, startedAt: daysAgo(3),  completedAt: daysAgo(3) },
    { idempotencyKey: 'ic-ok-2',    syncDirection: 'IMPORT_ONLY', status: 'SUCCEEDED', trigger: 'SCHEDULED', createdCount: 1, updatedCount: 2, deletedCount: 0, startedAt: hoursAgo(6), completedAt: hoursAgo(6) },
  ]);
}

// ── summary ──────────────────────────────────────────────────────────────────
const allAccounts = await db.syncAccount.findMany({
  where: { userId: user.id },
  select: { label: true, provider: true, status: true },
  orderBy: { createdAt: 'asc' },
});
console.log(`\nSync accounts for ${user.email}:`);
for (const a of allAccounts) {
  console.log(`  • [${a.provider.padEnd(9)}] ${a.label.padEnd(30)} — ${a.status}`);
}
console.log('\nDone. Reload /sync in the browser.');

await db.$disconnect();
