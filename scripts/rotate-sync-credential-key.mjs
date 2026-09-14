// P48-16 — re-encrypt at-rest secrets under the current keyring key.
//
//   node scripts/rotate-sync-credential-key.mjs            # dry run (default)
//   node scripts/rotate-sync-credential-key.mjs --apply    # write changes
//   node scripts/rotate-sync-credential-key.mjs --totp --apply
//
// Rotation is online: the app already decrypts by the key id embedded in each
// envelope, so old and new keys coexist and nothing needs a restart. Procedure:
//
//   1. Prepend the new key to SYNC_CREDENTIAL_ENCRYPTION_KEYS (new key FIRST —
//      the first entry is the one new writes use) and redeploy.
//   2. Run this script with --apply.
//   3. Once it reports 0 rows left on the old key, drop the old key from the
//      variable and redeploy.
//
// Dropping the old key before step 3 completes makes the remaining rows
// permanently unreadable, so always dry-run first.
//
// This file re-execs itself with the repo's TypeScript loader so it can share
// the exact envelope/keyring implementation the app uses, rather than keeping a
// second copy of the crypto that could silently drift.

import { fileURLToPath } from "node:url";

if (!process.env.KONTAX_ROTATE_BOOTSTRAPPED) {
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
      env: { ...process.env, KONTAX_ROTATE_BOOTSTRAPPED: "1" },
    },
  );
  process.exit(result.status ?? 1);
}

const { PrismaClient } = await import("../generated/prisma/index.js");
const { rotateSyncCredential, getSyncCredentialEncryptionStatus } = await import(
  "~/server/sync-credentials"
);
const { decryptTotp, encryptTotp, isTotpCiphertextStale } = await import(
  "~/server/totp-crypto"
);

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Usage: node scripts/rotate-sync-credential-key.mjs [--apply] [--totp]",
      "",
      "  --apply   Persist the re-encrypted values (default is a dry run).",
      "  --totp    Also rotate stored TOTP secrets (User.totpSecret).",
      "",
      "Reads keys from SYNC_CREDENTIAL_ENCRYPTION_KEYS / TOTP_ENCRYPTION_KEYS",
      "(or the single-key SYNC_CREDENTIAL_ENCRYPTION_KEY / TOTP_ENCRYPTION_KEY).",
    ].join("\n"),
  );
  process.exit(0);
}

const apply = args.includes("--apply");
const includeTotp = args.includes("--totp");

const db = new PrismaClient();

/** @type {(label: string, counts: Record<string, number>) => void} */
const report = (label, counts) => {
  console.log(
    `${label}: ${counts.total} row(s) — ${counts.rotated} ${
      apply ? "rotated" : "would rotate"
    }, ${counts.current} already current, ${counts.failed} unreadable`,
  );
};

async function rotateSyncAccounts() {
  const accounts = await db.syncAccount.findMany({
    where: { credentialReference: { not: null } },
    select: { id: true, label: true, provider: true, credentialReference: true, encryptionKeyRef: true },
    orderBy: { createdAt: "asc" },
  });

  const counts = { total: accounts.length, rotated: 0, current: 0, failed: 0 };

  for (const account of accounts) {
    let result;
    try {
      result = rotateSyncCredential(account.credentialReference, account.encryptionKeyRef);
    } catch (error) {
      counts.failed += 1;
      console.error(
        `  ✗ SyncAccount ${account.id} (${account.provider} · ${account.label}) — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      continue;
    }

    if (!result.rotated) {
      counts.current += 1;
      continue;
    }

    counts.rotated += 1;
    console.log(
      `  ${apply ? "→" : "·"} SyncAccount ${account.id} (${account.provider} · ${account.label}) ${result.previousKeyId} → ${result.encryptionKeyRef}`,
    );

    if (apply) {
      await db.syncAccount.update({
        where: { id: account.id },
        data: {
          credentialReference: result.credentialReference,
          encryptionKeyRef: result.encryptionKeyRef,
          credentialVersion: { increment: 1 },
        },
      });
    }
  }

  report("SyncAccount credentials", counts);
  return counts;
}

async function rotateTotpSecrets() {
  const users = await db.user.findMany({
    where: { totpSecret: { not: null } },
    select: { id: true, email: true, totpSecret: true },
    orderBy: { createdAt: "asc" },
  });

  const counts = { total: users.length, rotated: 0, current: 0, failed: 0 };

  for (const user of users) {
    if (!isTotpCiphertextStale(user.totpSecret)) {
      counts.current += 1;
      continue;
    }

    let reencrypted;
    try {
      reencrypted = encryptTotp(decryptTotp(user.totpSecret));
    } catch (error) {
      counts.failed += 1;
      console.error(
        `  ✗ User ${user.id} (${user.email}) — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      continue;
    }

    counts.rotated += 1;
    console.log(`  ${apply ? "→" : "·"} User ${user.id} (${user.email}) TOTP secret`);

    if (apply) {
      await db.user.update({ where: { id: user.id }, data: { totpSecret: reencrypted } });
    }
  }

  report("TOTP secrets", counts);
  return counts;
}

async function main() {
  const status = getSyncCredentialEncryptionStatus();
  if (!status.available) {
    throw new Error(
      "No credential encryption key configured. Set SYNC_CREDENTIAL_ENCRYPTION_KEYS before rotating.",
    );
  }

  console.log(
    `${apply ? "APPLY" : "DRY RUN"} — current sync credential key: "${status.keyRef}" (${status.mode})`,
  );
  if (!apply) console.log("No changes will be written. Re-run with --apply to persist.\n");

  const sync = await rotateSyncAccounts();
  const totp = includeTotp ? await rotateTotpSecrets() : null;

  if (!includeTotp) {
    console.log("\nTOTP secrets were not touched — pass --totp to rotate them too.");
  }

  const failed = sync.failed + (totp?.failed ?? 0);
  if (failed > 0) {
    console.error(
      `\n${failed} row(s) could not be decrypted. Keep every retired key in the keyring until this reaches 0.`,
    );
    process.exitCode = 1;
  }
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
