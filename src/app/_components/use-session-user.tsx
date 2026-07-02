"use client";

import { useEffect, useState } from "react";

export type SessionUserSummary = { name?: string | null } | null;

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
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: { name?: string | null } } | null) => {
        if (!cancelled) setUser(data?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
