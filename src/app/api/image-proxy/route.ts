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

// P48-11 item 7: sharp's default `limitInputPixels` (~268M px) still lets a
// small, highly-compressible file (a "pixel bomb" — e.g. a huge flat-color
// PNG) decode into hundreds of MB of raw pixel data. 25M px (~5000x5000) is
// comfortably above any legitimate avatar while bounding decode cost.
const MAX_INPUT_PIXELS = 25_000_000;

// A handful of concurrent sharp decodes is fine; unbounded concurrency lets
// a burst of proxy requests (or a single attacker looping large images) pin
// every CPU core decoding at once. This is process-local — fine for a
// same-origin, auth-gated proxy with no external LB fan-out assumption.
const MAX_CONCURRENT_TRANSFORMS = 4;
let activeTransforms = 0;

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

  if (activeTransforms >= MAX_CONCURRENT_TRANSFORMS) {
    return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 503 });
  }
  activeTransforms += 1;

  try {
    const image = await fetchExternalImage(url);
    const body = await sharp(image.body, { limitInputPixels: MAX_INPUT_PIXELS })
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
  } finally {
    activeTransforms -= 1;
  }
}
