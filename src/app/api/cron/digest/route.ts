import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { dueDigestUserIds, sendDigest } from "~/server/digest";

export const dynamic = "force-dynamic";

/**
 * P22-08: notification digest scheduler. Schedule daily at 08:00 UTC — DAILY
 * users get a digest every run; WEEKLY users only on Mondays. Users with no
 * unread non-security notifications in the window receive nothing.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;

  const { daily, weekly } = await dueDigestUserIds();
  const jobs = [
    ...daily.map((userId) => sendDigest({ userId, cadence: "DAILY" as const })),
    ...weekly.map((userId) => sendDigest({ userId, cadence: "WEEKLY" as const })),
  ];
  const results = await Promise.allSettled(jobs);

  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ candidates: jobs.length, sent, failed });
}
