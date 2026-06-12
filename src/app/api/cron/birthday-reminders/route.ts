import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { eligibleReminderUserIds, runBirthdayReminders } from "~/server/reminders";

export const dynamic = "force-dynamic";

/**
 * P22-09: daily birthday/anniversary reminder scan. Runs reminder detection for
 * every active user with REMINDERS in-app notifications enabled. Schedule once a
 * day (08:00 UTC). Dedup is handled per-user by BirthdayReminderState.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;

  const userIds = await eligibleReminderUserIds();
  const results = await Promise.allSettled(userIds.map((id) => runBirthdayReminders(id)));

  const raised = results.reduce(
    (sum, r) => (r.status === "fulfilled" ? sum + r.value : sum),
    0,
  );
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ users: userIds.length, raised, failed });
}
