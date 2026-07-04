"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { resolveAvatarSrc } from "~/lib/avatar-src";

/**
 * P46-02 — the contact detail heroes (desktop `contacts/[id]/page.tsx`,
 * `mobile-contact-detail.tsx`) render an avatar with **no fallback**, so a
 * 404 (pre-thumbnail-backfill object, dead pasted URL, proxy 5xx) shows a
 * broken-image icon. This client component implements the settled
 * thumb → canonical → initials chain (P46-DB02, Surface 4), mirroring the
 * list-row pattern in `contacts-workspace-table.tsx`.
 *
 * Each onError advances one step through the distinct candidate srcs and never
 * re-points at a src that just failed; the final step is the initials element,
 * which has no <img> and cannot error.
 */
export function ContactHeroAvatar({
  avatarUrl,
  alt,
  initials,
  bg,
  fg,
  size,
  className,
  style,
}: {
  avatarUrl: string;
  alt: string;
  initials: string;
  bg: string;
  fg: string;
  /** Explicit pixel size (mobile). Omit to fill a sized wrapper via className. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Distinct candidates only — thumb then canonical; dedupe so a missing thumb
  // (resolves to the canonical) doesn't waste an onError retrying the same URL.
  const candidates = useMemo(() => {
    const thumb = resolveAvatarSrc(avatarUrl, { thumb: true });
    const full = resolveAvatarSrc(avatarUrl);
    return Array.from(new Set([thumb, full].filter((s): s is string => Boolean(s))));
  }, [avatarUrl]);

  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [avatarUrl]);

  // The <img> is server-rendered, so it can finish loading — and error — before
  // React hydrates and attaches onError, which would leave a broken image with
  // no fallback. After each render, catch an already-errored image (complete but
  // zero natural size) and advance. A still-loading image reports complete=false,
  // so this never false-fires mid-load.
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setStage((s) => s + 1);
  }, [stage]);

  const dim = size ? { width: size, height: size } : undefined;

  if (stage < candidates.length) {
    return (
      <img
        alt={alt}
        className={className}
        onError={() => setStage((s) => s + 1)}
        ref={imgRef}
        src={candidates[stage]}
        // inline-block matches the original hero markup so the avatar sits at the
        // same vertical position as the initials fallback (an inline <img> would
        // baseline-align differently and appear shifted). Font styles from `style`
        // are for the initials span only — they must not reach the <img>.
        style={{ display: "inline-block", objectFit: "cover", ...dim, ...style }}
      />
    );
  }

  // Guaranteed end — CSS initials. Never a broken-image icon. The initials font
  // is derived from `size` (mobile) so callers don't pass font styles that would
  // otherwise leak onto the <img>; desktop omits `size` and inherits its wrapper.
  return (
    <span
      aria-label={alt}
      className={className}
      role="img"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color: fg,
        ...(size ? { fontSize: Math.round(size * 0.35), fontWeight: 700, letterSpacing: "-0.01em" } : null),
        ...dim,
        ...style,
      }}
    >
      {initials}
    </span>
  );
}
