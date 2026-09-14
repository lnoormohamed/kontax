import {
  isPrivateIp,
  requestPinned,
  resolvePublicAddress,
  SafeFetchError,
  validateOutboundUrl,
  MAX_REDIRECTS,
  type UrlValidation,
} from "~/server/safe-fetch";

/**
 * P38-08 follow-up — SSRF-hardened fetching of user-supplied image URLs.
 *
 * P48-04: the primitives (private-range detection, DNS pinning, per-hop
 * redirect re-validation) now live in `safe-fetch.ts` and are shared with the
 * CardDAV client and the photo pass. This module keeps the image-specific
 * policy: default ports only, `image/*` content-type, 5 MB / 6 s caps. The
 * proxy route re-encodes whatever this returns through sharp, so raw
 * third-party bytes are never served to clients.
 */

export { isPrivateIp };
export type { UrlValidation };

/** Exported for tests. Structural checks that need no network access. */
export function validateImageUrl(raw: string): UrlValidation {
  // Pasted avatar links may legitimately be http://; the private-range and
  // DNS checks are what matter here, and the proxy re-encodes the bytes.
  return validateOutboundUrl(raw, { allowHttp: true, defaultPortOnly: true });
}

export type FetchedImage = { body: Buffer; contentType: string };

export async function fetchExternalImage(
  rawUrl: string,
  {
    maxBytes = 5 * 1024 * 1024,
    timeoutMs = 6_000,
  }: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<FetchedImage> {
  const deadline = Date.now() + timeoutMs;
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const validated = validateImageUrl(current);
    if (!validated.ok) throw new Error(`blocked: ${validated.reason}`);
    const { url } = validated;

    const address = await resolvePublicAddress(url.hostname);
    if (!address) throw new Error("blocked: unresolvable or private address");

    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("timeout");

    let response: Awaited<ReturnType<typeof requestPinned>>;
    try {
      response = await requestPinned(url, address, {
        method: "GET",
        headers: { Accept: "image/*", "User-Agent": "Kontax-ImageProxy/1.0" },
        timeoutMs: remaining,
        maxBytes,
      });
    } catch (err) {
      if (err instanceof SafeFetchError && err.kind === "too_large") throw new Error("image too large");
      if (err instanceof SafeFetchError && err.kind === "timeout") throw new Error("timeout");
      throw new Error("network error");
    }
    const location = response.headers.location;
    if (response.status >= 301 && response.status <= 308 && location) {
      current = new URL(location, url).toString();
      continue;
    }
    if (response.status !== 200) {
      throw new Error(`upstream status ${response.status}`);
    }
    const contentType = response.headers["content-type"] ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new Error("not an image");
    }
    return { body: response.body, contentType };
  }
  throw new Error("too many redirects");
}
