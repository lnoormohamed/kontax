// P23-01: backfill a default SyncAccountSettings row for every SyncAccount that
// lacks one. Idempotent — safe to re-run. Defaults mirror the schema column
// defaults (TWO_WAY / SERVER_WINS / empty allowlist).
import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

async function main() {
  const accounts = await db.syncAccount.findMany({
    where: { settings: null },
    select: { id: true },
  });

  if (accounts.length === 0) {
    console.log("No SyncAccount rows missing settings. Nothing to backfill.");
    return;
  }

  const result = await db.syncAccountSettings.createMany({
    data: accounts.map((a) => ({
      syncAccountId: a.id,
      syncDirection: "TWO_WAY",
      conflictPolicy: "SERVER_WINS",
      bookAllowlist: [],
    })),
    skipDuplicates: true,
  });

  console.log(`Backfilled ${result.count} SyncAccountSettings row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
