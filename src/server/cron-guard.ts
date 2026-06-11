import { type NextRequest, NextResponse } from "next/server";

/**
 * Guards /api/cron/* routes against arbitrary HTTP access.
 * Returns a 401 response if the x-cron-secret header doesn't match CRON_SECRET.
 * Returns null if the request is allowed — the caller should proceed.
 *
 * Usage:
 *   const denied = assertCronSecret(req);
 *   if (denied) return denied;
 */
export function assertCronSecret(req: NextRequest): NextResponse | null {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
