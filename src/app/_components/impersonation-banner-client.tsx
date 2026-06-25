"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { endImpersonation } from "~/app/actions/admin";

function formatRemaining(exp: number) {
  const remainingMs = Math.max(0, exp - Date.now());
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")} left`;
}

export function ImpersonationBannerClient({
  expiresAt,
}: {
  expiresAt: number;
}) {
  const [label, setLabel] = useState(() => formatRemaining(expiresAt));

  useEffect(() => {
    const timer = setInterval(() => setLabel(formatRemaining(expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return <span style={{ color: "rgba(255,255,255,0.75)" }}>{label}</span>;
}

export function EndImpersonationButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const end = () => {
    start(async () => {
      await endImpersonation();
      router.push("/admin/users");
      router.refresh();
    });
  };

  return (
    <button
      onClick={end}
      disabled={pending}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 30,
        padding: "0 13px",
        whiteSpace: "nowrap",
        border: "1px solid rgba(255,255,255,0.5)",
        borderRadius: 8,
        background: "transparent",
        color: "#fff",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: pending ? "default" : "pointer",
      }}
    >
      {pending ? "Ending…" : "End impersonation"}
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
      </svg>
    </button>
  );
}
