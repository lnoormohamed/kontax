import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;

  const due = await db.user.findMany({
    where: {
      scheduledDeleteAt: { lte: new Date() },
      lifecycleState: "LOCKED",
    },
    select: { id: true, email: true },
  });

  let deleted = 0;
  const errors: string[] = [];

  for (const user of due) {
    try {
      await db.user.delete({ where: { id: user.id } });
      // Cascade deletes all child records via Prisma onDelete: Cascade
      deleted++;
      console.log(`[Kontax] Hard-deleted account ${user.id} (${user.email})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${user.id}: ${msg}`);
      console.error(`[Kontax] Failed to delete account ${user.id}:`, err);
    }
  }

  return NextResponse.json({ deleted, errors, scanned: due.length });
}
