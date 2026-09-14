import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Guards /api/cron/* routes (and other scheduler-only endpoints) against
 * arbitrary HTTP access. Returns a 401 response if the x-cron-secret header
 * doesn't match CRON_SECRET, or if CRON_SECRET is unset.
 * Returns null if the request is allowed — the caller MUST return the denial:
 *
 *   const denied = assertCronSecret(req);
 *   if (denied) return denied;
 *
 * Prefer `withCronAuth(handler)` for new routes so the check cannot be dropped.
 */
export function assertCronSecret(req: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  const presented = req.headers.get("x-cron-secret");
  if (!expected || !presented || !secretsMatch(presented, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Wrap a route handler so it only runs when the cron secret matches (P48-10). */
export function withCronAuth<T extends NextRequest>(
  handler: (req: T) => Promise<Response> | Response,
): (req: T) => Promise<Response> {
  return async (req: T) => {
    const denied = assertCronSecret(req);
    if (denied) return denied;
    return handler(req);
  };
}

/** Constant-time comparison of two secrets (P48-10). */
export function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
