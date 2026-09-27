import { NextResponse } from "next/server";

/**
 * P49A-13 (SEC P2: no Origin check on cookie-authed side-effecting GETs).
 *
 * Server actions get Next's own Origin check; plain route handlers don't. A GET
 * that does work with the session cookie (re-running CardDAV discovery with the
 * stored credentials, writing an export job) can be triggered cross-site by a
 * link or an <img>, because the session cookie is SameSite=Lax. This refuses
 * requests a browser marks as coming from another site.
 *
 *   1. `Sec-Fetch-Site` (every current browser): allow `same-origin` and `none`
 *      (typed URL, bookmark); refuse `same-site` and `cross-site`.
 *   2. Otherwise an `Origin` header, if present, must be this app's origin.
 *   3. Neither header: a non-browser client or a very old browser — nothing
 *      to judge by, so allowed (the cookie is still required).
 */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  const origin = request.headers.get("origin");
  if (!origin) return true;
  return allowedOrigins(request).has(origin);
}

const allowedOrigins = (request: Request): Set<string> => {
  const origins = new Set<string>();
  const add = (value: string | undefined | null) => {
    if (!value) return;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // ignore a malformed value
    }
  };
  add(process.env.APP_URL?.trim());
  add(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(/:$/, "");
    add(`${proto}://${host}`);
  }
  return origins;
};

/** A 403 for a cross-site request, or null to carry on. */
export function rejectCrossSite(request: Request): NextResponse | null {
  if (isSameOriginRequest(request)) return null;
  return NextResponse.json({ error: "CROSS_SITE_REQUEST" }, { status: 403 });
}
