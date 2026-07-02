import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { auth } from "~/server/auth";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";
import { fetchExternalImage } from "~/server/safe-image-fetch";

/**
 * P38-08 follow-up — same-origin proxy for external contact avatars.
 *
 * Contact avatars can be arbitrary pasted (and, with photo sync, provider-
 * origin) URLs. The app CSP intentionally stays strict (img-src 'self' +
 * media host); external images are fetched server-side through the
 * SSRF-hardened fetcher and re-encoded with sharp, so the browser only ever
 * receives same-origin webp bytes — no client IP leak to third parties, no
 * mixed content, no raw third-party payloads.
 *
 * `w=96` serves the list-row size; anything else gets the 512px detail size.
 */

const SIZES = { thumb: 96, full: 512 } as const;
const MAX_URL_LENGTH = 500; // matches the avatarUrl column validation

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { allowed } = await checkRateLimit(rateLimiters.imageProxy, session.user.id);
    if (!allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }
  } catch {
    // limiter backend down — fail open, auth is the gate
  }

  const url = req.nextUrl.searchParams.get("url") ?? "";
  if (!url || url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
  }
  const size = req.nextUrl.searchParams.get("w") === "96" ? SIZES.thumb : SIZES.full;

  try {
    const image = await fetchExternalImage(url);
    const body = await sharp(image.body)
      .rotate()
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/webp",
        // Per-user privacy is not a concern (the bytes derive only from the
        // URL), but keep caches private since the endpoint is auth-gated.
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // Blocked, unreachable, oversized, or not an image — the client <img>
    // falls back via onError. Don't echo details to the caller.
    console.warn(
      `[image-proxy] refused ${url.slice(0, 120)}: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 502 });
  }
}
