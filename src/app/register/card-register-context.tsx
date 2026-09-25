"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { CardPrefillData } from "~/app/u/[username]/add-to-kontax";

export function CardRegisterContext({ prefillParam }: { prefillParam: string }) {
  const prefill = useMemo<CardPrefillData | null>(() => {
    try {
      return JSON.parse(atob(prefillParam)) as CardPrefillData;
    } catch {
      return null;
    }
  }, [prefillParam]);

  if (!prefill) return null;

  const displayName = [prefill.firstName, prefill.lastName].filter(Boolean).join(" ");

  return (
    // P50-06: Direction A tokens copied inline — see the note at the top of
    // `~/app/_components/auth-card.tsx` for why (and the token → hex map).
    <div
      style={{
        width: "100%",
        maxWidth: 400,
        padding: "12px 16px",
        borderRadius: 10,
        background: "#fff",
        border: "1px solid #d4d9d0",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <p style={{ fontSize: 13, color: "#1d2823", fontWeight: 600, margin: 0 }}>
        Adding {displayName} to Kontax
      </p>
      <p style={{ fontSize: 12, color: "#5c655e", margin: 0 }}>
        Create a free account to save this contact. Their details will be waiting for you.
      </p>
      <Link
        href={`/u/${prefill.sourceCardUsername}`}
        style={{ fontSize: 12, color: "#17352e", marginTop: 2 }}
      >
        ← Back to {displayName}&apos;s card
      </Link>
    </div>
  );
}
