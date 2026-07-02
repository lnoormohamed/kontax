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
 */
const KONTAX_MEDIA_HOST = /^https:\/\/media\.getkontax\.com\//i;

export function resolveAvatarSrc(
  url: string | null | undefined,
  opts?: { thumb?: boolean },
): string | null {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return url;
  if (KONTAX_MEDIA_HOST.test(url)) {
    if (opts?.thumb) {
      return getAvatarThumbUrl(url) ?? url;
    }
    return url;
  }
  const proxied = `/api/image-proxy?url=${encodeURIComponent(url)}`;
  return opts?.thumb ? `${proxied}&w=96` : proxied;
}
