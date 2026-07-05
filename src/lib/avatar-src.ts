import { getAvatarThumbUrl } from "~/lib/avatar-thumb";

/**
 * P38-08 follow-up — resolve what an <img src> should actually load for an
 * avatar URL, keeping the strict app CSP intact:
 *
 *  - relative / data: / blob: URLs render as-is
 *  - Kontax-hosted avatars (the media host) render directly; `thumb` swaps in
 *    the 96px webp sibling (P38-08)
 *  - any other http(s) URL routes through /api/image-proxy (SSRF-hardened,
 *    re-encoded server-side); `thumb` requests the 96px proxy variant
 *
 * P46-02 — the Kontax-media host is **config-driven**, not a hardcoded literal.
 * Uploads build their URL from `MINIO_PUBLIC_URL`; if a deploy's public media
 * host differs from `media.getkontax.com`, every Kontax-hosted avatar used to
 * fall through to the proxy (and bypass the thumb) — the prime "images not
 * displaying / slow" suspect. We match against `NEXT_PUBLIC_MEDIA_HOST` and
 * keep the `media.getkontax.com` literal as a legacy allowance.
 *
 * NOTE: this must be a build-time **public** env var (`NEXT_PUBLIC_*`) so the
 * client and server resolve the same host — a server-only var (`MINIO_PUBLIC_URL`)
 * is `undefined` in the browser bundle and would cause a hydration mismatch.
 * A deploy whose media host isn't `media.getkontax.com` must set
 * `NEXT_PUBLIC_MEDIA_HOST` (and add that host to the CSP `img-src`).
 */
const LEGACY_MEDIA_ORIGIN = "https://media.getkontax.com";

function toOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const CONFIGURED_MEDIA_ORIGIN = toOrigin(process.env.NEXT_PUBLIC_MEDIA_HOST);

/** True when the URL points at our own media storage (any configured host). */
export function isKontaxHosted(url: string | null | undefined): boolean {
  if (!url) return false;
  if (CONFIGURED_MEDIA_ORIGIN && url.startsWith(`${CONFIGURED_MEDIA_ORIGIN}/`)) return true;
  return url.startsWith(`${LEGACY_MEDIA_ORIGIN}/`);
}

export function resolveAvatarSrc(
  url: string | null | undefined,
  opts?: { thumb?: boolean },
): string | null {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return url;
  if (isKontaxHosted(url)) {
    if (opts?.thumb) {
      return getAvatarThumbUrl(url) ?? url;
    }
    return url;
  }
  const proxied = `/api/image-proxy?url=${encodeURIComponent(url)}`;
  return opts?.thumb ? `${proxied}&w=96` : proxied;
}
