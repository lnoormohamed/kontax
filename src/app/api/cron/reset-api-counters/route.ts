import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;

  // Runs daily at 00:00 UTC — only acts on the 1st of the month
  const now = new Date();
  if (now.getUTCDate() !== 1) {
    return NextResponse.json({ skipped: true, reason: "not the 1st of the month" });
  }

  const result = await db.apiToken.updateMany({
    where: { revokedAt: null },
    data: { requestCountThisMonth: 0 },
  });

  return NextResponse.json({ reset: result.count });
}
