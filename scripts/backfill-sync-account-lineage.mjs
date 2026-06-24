// P34G-01: backfill a stable connectionId for legacy SyncAccount rows.
// Idempotent — safe to re-run; only rows with null connectionId are updated.
import { createId } from "@paralleldrive/cuid2";

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

async function main() {
  const accounts = await db.syncAccount.findMany({
    where: { connectionId: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length === 0) {
    console.log("No SyncAccount rows missing connectionId. Nothing to backfill.");
    return;
  }

  let updated = 0;
  for (const account of accounts) {
    const result = await db.syncAccount.updateMany({
      where: { id: account.id, connectionId: null },
      data: { connectionId: createId() },
    });
    updated += result.count;
  }

  console.log(`Backfilled ${updated} SyncAccount connectionId value(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
