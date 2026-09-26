import { type NextRequest, NextResponse } from "next/server";

import { getClientIp } from "~/lib/client-ip";
import { isTrackablePath, recordPageView } from "~/server/page-view-metrics";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

// P50A-08 — cookieless page-view + register-conversion beacon.
//
// Called by ~/app/_components/page-view-beacon.tsx via `navigator.sendBeacon`
// from content pages (/guides/*, /compare/*, /help/*, /for/*, /features/*)
// and /register. No cookies are read or set here, no per-visitor identifier
// is generated, and the client IP below is used only as an ephemeral
// rate-limit key (same pattern as /api/card/[username]/click) — it is never
// written into the page-view counters themselves, which are keyed by path
// and UTC date only (see page-view-metrics.ts).
//
// NOTE for the integrator: this route must be added to
// src/server/public-paths.ts (PUBLIC_PREFIXES or EXACT_PUBLIC_PATHS) so
// signed-out visitors' beacons aren't redirected by the session-gating
// middleware — not done here, per this ticket's scope.
//
// Always responds 200 regardless of validation outcome: a beacon has no UI to
// react to an error, and the response must never hint at the allow-list.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (ip) {
    const rl = await checkRateLimit(rateLimiters.pageViewBeacon, `ip:${ip}`);
    if (!rl.allowed) return NextResponse.json({ ok: true });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const path =
    typeof body === "object" && body !== null && "path" in body ? body.path : null;

  if (typeof path === "string" && isTrackablePath(path)) {
    await recordPageView(path);
  }

  return NextResponse.json({ ok: true });
}
