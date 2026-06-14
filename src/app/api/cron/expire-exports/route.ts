import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { expireReadyJobs } from "~/server/data-export/jobs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;

  const result = await expireReadyJobs();
  return NextResponse.json({ expired: result.count });
}
