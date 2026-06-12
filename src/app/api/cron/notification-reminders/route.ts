import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { runBirthdayReminderScan } from "~/server/notifications";

export const dynamic = "force-dynamic";

/**
 * P22-DB05: daily birthday/anniversary reminder scan. Raises a REMINDERS
 * notification for each contact whose birthday is today (UTC). Schedule once a
 * day (the digest email cron, P22-08, is separate).
 */
export async function POST(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;

  const raised = await runBirthdayReminderScan();
  return NextResponse.json({ raised });
}
