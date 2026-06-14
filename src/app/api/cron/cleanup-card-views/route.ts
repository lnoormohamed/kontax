import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { db } from "~/server/db";

export async function POST(req: NextRequest) {
  assertCronSecret(req);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
  const result = await db.publicCardView.deleteMany({
    where: { viewedAt: { lt: ninetyDaysAgo } },
  });
  return NextResponse.json({ deleted: result.count });
}
