"use client";

import { useEffect, useState } from "react";

export type SessionUserSummary = { name?: string | null } | null;

// P50A-02: the homepage has several session-aware islands (nav, hero, closing
// CTA). Components that mount together share one in-flight request; the
// promise is dropped once it settles, so a later mount (after sign-in or
// sign-out) reads the session afresh.
let inflight: Promise<SessionUserSummary> | null = null;

function fetchSessionUser(): Promise<SessionUserSummary> {
  inflight ??= fetch("/api/auth/session")
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { user?: { name?: string | null } } | null) => data?.user ?? null)
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * P38-10 — client-side session peek for statically rendered public pages.
 *
 * The marketing/legal/help pages were all dynamically rendered because their
 * shared nav called auth() server-side just to swap a "Log in" CTA for the
 * account chip. The pages are now static; this hook resolves the session
 * after hydration via the NextAuth session endpoint. Anonymous visitors
 * resolve fast (cookie-less request, no DB hit); `undefined` means "still
 * resolving" so callers can render the logged-out default without flicker
 * for the common anonymous case.
 */
export function useSessionUser(): SessionUserSummary | undefined {
  const [user, setUser] = useState<SessionUserSummary | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchSessionUser().then((sessionUser) => {
      if (!cancelled) setUser(sessionUser);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
