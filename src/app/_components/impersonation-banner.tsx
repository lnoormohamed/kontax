"use client";

import { useEffect, useState } from "react";

import { EndImpersonationButton, ImpersonationBannerClient } from "./impersonation-banner-client";

// P21-07: pinned full-width banner shown above the normal app while an admin
// is impersonating a user. Rendered in the root layout so it appears
// everywhere.
//
// P38-10: resolves its state client-side (was a server component calling
// auth(), which forced every route in the app to render dynamically).
// Impersonation is rare, so the extra fetch is paid only after hydration and
// the whole app can render statically where nothing else is dynamic.
type ImpersonationState = { active: true; email: string; expiresAt: number | null } | { active: false };

export function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState>({ active: false });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/impersonation")
      .then((res) => (res.ok ? res.json() : { active: false }))
      .then((data: ImpersonationState) => {
        if (!cancelled) setState(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state.active) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "#1e3a5f",
        color: "#fff",
        fontSize: 13.5,
        fontFamily: "var(--font-sans, system-ui), sans-serif",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
        <span>
          Viewing as <strong style={{ fontWeight: 600 }}>{state.email}</strong>{" "}
          <span style={{ color: "rgba(255,255,255,0.65)" }}>(read-only)</span>{" "}
          {state.expiresAt !== null ? <ImpersonationBannerClient expiresAt={state.expiresAt} /> : null}
        </span>
      </span>
      <EndImpersonationButton />
    </div>
  );
}
