// P48-18 — move legacy plaintext capability tokens to hash (+ encrypted
// display copy) storage.
//
//   node scripts/backfill-p48-18-token-hashes.mjs            # dry run (default)
//   node scripts/backfill-p48-18-token-hashes.mjs --apply    # write changes
//
// For every row that still holds a plaintext token:
//
//   User.calToken             → calTokenHash + calTokenEncrypted, calToken = NULL
//   ContactShare.token        → tokenHash + tokenEncrypted,       token = NULL
//   GroupMember.inviteToken   → inviteTokenHash,                  inviteToken = NULL
//
// The hash is written and the plaintext nulled in ONE UPDATE, conditional on the
// plaintext still being the value we read (so a token the user regenerates
// mid-run is never clobbered). Existing links keep working afterwards: the app
// looks them up by sha256(token). Idempotent — a second run finds nothing to do.
//
// A row that already has a hash AND still has plaintext is not produced by any
// app code path. If the two agree, the plaintext is simply nulled; if they
// disagree the row is reported as a conflict, left untouched, and the script
// exits non-zero so an operator looks at it.
//
// Requires the display-token key (the sync credential keyring:
// SYNC_CREDENTIAL_ENCRYPTION_KEYS / _KEY, or AUTH_SECRET outside production)
// for the calendar and share tables. Never prints a token.
//
// Deploy order (roadmap/runbooks/deploy.md, "P48-18"): migrate → deploy the
// dual-read code → run this with --apply → verify the plaintext counts are 0.
//
// This file re-execs itself with the repo's TypeScript loader so it shares the
// exact hashing/envelope code the app uses (src/server/capability-tokens.ts),
// as scripts/rotate-sync-credential-key.mjs does.

import { fileURLToPath } from "node:url";

if (!process.env.KONTAX_P48_18_BOOTSTRAPPED) {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--loader",
      new URL("./node-test-loader.mjs", import.meta.url).href,
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    {
      stdio: "inherit",
      env: { ...process.env, KONTAX_P48_18_BOOTSTRAPPED: "1" },
    },
  );
  process.exit(result.status ?? 1);
}

const { PrismaClient } = await import("../generated/prisma/index.js");
const { decryptDisplayToken, encryptDisplayToken, hashToken } = await import(
  "~/server/capability-tokens"
);
const { getSyncCredentialEncryptionStatus } = await import("~/server/sync-credentials");

const BATCH_SIZE = 200;

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Usage: node scripts/backfill-p48-18-token-hashes.mjs [--apply]",
      "",
      "  --apply   Persist the changes (default is a dry run that writes nothing).",
      "  --prefer-plaintext",
      "            Resolve conflict rows (plaintext AND a different hash, which only a",
      "            rollback to the pre-P48-18 build can produce) in favour of the",
      "            plaintext token — the one the user was shown most recently.",
      "",
      "Hashes User.calToken, ContactShare.token and GroupMember.inviteToken,",
      "stores an encrypted display copy for calendar/share tokens, and nulls the",
      "plaintext column in the same UPDATE. Idempotent; batched by " + BATCH_SIZE + ".",
    ].join("\n"),
  );
  process.exit(0);
}

const apply = args.includes("--apply");
const preferPlaintext = args.includes("--prefer-plaintext");

const db = new PrismaClient();

/**
 * @typedef {{ id: string; plaintext: string; hash: string | null }} LegacyRow
 * @typedef {{ scanned: number; converted: number; conflicts: number; failed: number }} Counts
 * @typedef {{
 *   label: string;
 *   readBatch: (afterId: string | null) => Promise<LegacyRow[]>;
 *   convert: (row: LegacyRow) => Promise<number>;
 *   remaining: () => Promise<number>;
 * }} TableSpec
 */

/** @param {string | null} afterId */
const idCursor = (afterId) => (afterId ? { id: { gt: afterId } } : {});

/** @type {TableSpec[]} */
const TABLES = [
  {
    label: 'User."calToken"',
    readBatch: async (afterId) =>
      (
        await db.user.findMany({
          where: { calToken: { not: null }, ...idCursor(afterId) },
          select: { id: true, calToken: true, calTokenHash: true },
          orderBy: { id: "asc" },
          take: BATCH_SIZE,
        })
      ).map((r) => ({ id: r.id, plaintext: /** @type {string} */ (r.calToken), hash: r.calTokenHash })),
    convert: async (row) =>
      (
        await db.user.updateMany({
          where: { id: row.id, calToken: row.plaintext },
          data: {
            calTokenHash: hashToken(row.plaintext),
            calTokenEncrypted: encryptDisplayToken(row.plaintext),
            calToken: null,
          },
        })
      ).count,
    remaining: () => db.user.count({ where: { calToken: { not: null } } }),
  },
  {
    label: 'ContactShare."token"',
    readBatch: async (afterId) =>
      (
        await db.contactShare.findMany({
          where: { token: { not: null }, ...idCursor(afterId) },
          select: { id: true, token: true, tokenHash: true },
          orderBy: { id: "asc" },
          take: BATCH_SIZE,
        })
      ).map((r) => ({ id: r.id, plaintext: /** @type {string} */ (r.token), hash: r.tokenHash })),
    convert: async (row) =>
      (
        await db.contactShare.updateMany({
          where: { id: row.id, token: row.plaintext },
          data: {
            tokenHash: hashToken(row.plaintext),
            tokenEncrypted: encryptDisplayToken(row.plaintext),
            token: null,
          },
        })
      ).count,
    remaining: () => db.contactShare.count({ where: { token: { not: null } } }),
  },
  {
    label: 'GroupMember."inviteToken"',
    readBatch: async (afterId) =>
      (
        await db.groupMember.findMany({
          where: { inviteToken: { not: null }, ...idCursor(afterId) },
          select: { id: true, inviteToken: true, inviteTokenHash: true },
          orderBy: { id: "asc" },
          take: BATCH_SIZE,
        })
      ).map((r) => ({
        id: r.id,
        plaintext: /** @type {string} */ (r.inviteToken),
        hash: r.inviteTokenHash,
      })),
    // No display copy: invite tokens are only ever emailed.
    convert: async (row) =>
      (
        await db.groupMember.updateMany({
          where: { id: row.id, inviteToken: row.plaintext },
          data: { inviteTokenHash: hashToken(row.plaintext), inviteToken: null },
        })
      ).count,
    remaining: () => db.groupMember.count({ where: { inviteToken: { not: null } } }),
  },
];

/** @param {TableSpec} table @returns {Promise<Counts>} */
async function backfillTable(table) {
  /** @type {Counts} */
  const counts = { scanned: 0, converted: 0, conflicts: 0, failed: 0 };
  /** @type {string | null} */
  let afterId = null;

  for (;;) {
    const batch = await table.readBatch(afterId);
    if (batch.length === 0) break;
    afterId = batch[batch.length - 1]?.id ?? null;

    for (const row of batch) {
      counts.scanned += 1;

      if (row.hash && row.hash !== hashToken(row.plaintext)) {
        if (!preferPlaintext) {
          counts.conflicts += 1;
          console.error(
            `  ✗ ${table.label} row ${row.id}: already has a hash for a different token — left untouched (re-run with --prefer-plaintext to resolve)`,
          );
          continue;
        }
        // The plaintext was written by the pre-P48-18 build during a rollback
        // window, so it is the token the user saw last: it wins, and the older
        // hashed token stops resolving once this row is converted.
        console.log(`  ! ${table.label} row ${row.id}: conflict resolved in favour of the plaintext token`);
      }

      if (!apply) {
        counts.converted += 1;
        continue;
      }

      try {
        const updated = await table.convert(row);
        // 0 = the row changed under us (token regenerated/revoked mid-run);
        // it no longer holds this plaintext, which is the goal anyway.
        if (updated > 0) counts.converted += 1;
      } catch (error) {
        counts.failed += 1;
        // Prisma error messages can echo query arguments — print only the
        // error class/code, never the message, so no token reaches the log.
        const code =
          error && typeof error === "object" && "code" in error ? String(error.code) : "";
        console.error(
          `  ✗ ${table.label} row ${row.id}: update failed (${
            error instanceof Error ? error.name : "Error"
          }${code ? ` ${code}` : ""})`,
        );
      }
    }
  }

  const remaining = await table.remaining();
  console.log(
    `${table.label}: ${counts.scanned} plaintext row(s) — ${counts.converted} ${
      apply ? "converted" : "would convert"
    }, ${counts.conflicts} conflict(s), ${counts.failed} failed; ${remaining} plaintext row(s) remaining`,
  );
  return counts;
}

async function main() {
  // Fail before touching anything if the display-token key is missing: a
  // calendar/share row converted without its display copy could no longer be
  // shown in the UI.
  try {
    encryptDisplayToken("p48-18-preflight");
  } catch (error) {
    throw new Error(
      `Display-token encryption is not available: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  // A wrong key would still "work" here — and then write display copies the app
  // cannot open, after the plaintext is gone. Two guards:
  // 1. production must use the dedicated key, never the AUTH_SECRET fallback;
  // 2. if the running app has already written any display copy, this process
  //    must be able to decrypt it, i.e. it holds the app's key.
  const status = getSyncCredentialEncryptionStatus();
  const deployEnv = (process.env.KONTAX_DEPLOY_ENV ?? "").trim().toLowerCase();
  console.log(`Display-token key: "${status.keyRef}" (${status.mode})`);
  if (deployEnv === "production" && status.mode !== "dedicated") {
    throw new Error(
      "Refusing to run in production with the AUTH_SECRET fallback key. Export the app's SYNC_CREDENTIAL_ENCRYPTION_KEY(S) first.",
    );
  }
  const sample =
    (await db.user.findFirst({
      where: { calTokenEncrypted: { not: null } },
      select: { calTokenEncrypted: true },
    }))?.calTokenEncrypted ??
    (await db.contactShare.findFirst({
      where: { tokenEncrypted: { not: null } },
      select: { tokenEncrypted: true },
    }))?.tokenEncrypted ??
    null;
  if (sample && decryptDisplayToken(sample) === null) {
    throw new Error(
      "This process cannot decrypt a display copy the app already wrote — it does not hold the app's key. Nothing was changed.",
    );
  }
  if (!sample) {
    console.log("(no display copy written by the app yet — key match could not be cross-checked)");
  }

  console.log(`${apply ? "APPLY" : "DRY RUN"} — P48-18 capability-token backfill (batch ${BATCH_SIZE})`);
  if (!apply) console.log("No changes will be written. Re-run with --apply to persist.\n");

  let problems = 0;
  for (const table of TABLES) {
    const counts = await backfillTable(table);
    problems += counts.conflicts + counts.failed;
  }

  if (problems > 0) {
    console.error(`\n${problems} row(s) need attention (see above).`);
    process.exitCode = 1;
  }
}

await main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
