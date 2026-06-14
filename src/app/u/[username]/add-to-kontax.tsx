"use client";

import Link from "next/link";

import type { PublicCardData } from "~/server/public-card/types";

// ── Prefill data format shared with /contacts/new ────────────────────────────
export interface CardPrefillData {
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  emails?: Array<{ label: string; value: string }>;
  phones?: Array<{ label: string; value: string }>;
  websites?: Array<{ label: string; value: string }>;
  sourceCardUsername: string;
}

function buildPrefillData(card: PublicCardData): CardPrefillData {
  const [firstName, ...rest] = card.displayName.split(" ");
  return {
    firstName,
    lastName: rest.join(" ") || undefined,
    company: card.company ?? undefined,
    jobTitle: card.jobTitle ?? undefined,
    emails: card.emails.map((e) => ({ label: "Home", value: e })),
    phones: card.phones.map((p) => ({ label: "Mobile", value: p })),
    websites: card.websites.map((w) => ({ label: "Homepage", value: w })),
    sourceCardUsername: card.username,
  };
}

function buildVCard(card: PublicCardData): string {
  const [firstName = "", ...restParts] = card.displayName.split(" ");
  const lastName = restParts.join(" ");

  const lines = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    `FN:${card.displayName}`,
    `N:${lastName};${firstName};;;`,
  ];

  if (card.jobTitle) lines.push(`TITLE:${card.jobTitle}`);
  if (card.company) lines.push(`ORG:${card.company}`);
  card.emails.forEach((e) => lines.push(`EMAIL;TYPE=HOME:${e}`));
  card.phones.forEach((p) => lines.push(`TEL;TYPE=CELL:${p}`));
  card.websites.forEach((w) => lines.push(`URL:${w}`));
  lines.push(`URL:https://kontax.app/u/${card.username}`);
  lines.push("END:VCARD");

  return lines.join("\r\n");
}

function downloadVCard(card: PublicCardData) {
  const blob = new Blob([buildVCard(card)], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${card.displayName.replace(/\s+/g, "-")}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

const CTA_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  padding: "13px 0",
  borderRadius: 14,
  background: "#17352e",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  textAlign: "center" as const,
  textDecoration: "none",
  letterSpacing: "-0.01em",
  border: "none",
  cursor: "pointer",
};

export function AddToKontaxButton({
  card,
  isLoggedIn,
  isOwnCard,
}: {
  card: PublicCardData;
  isLoggedIn: boolean;
  isOwnCard: boolean;
}) {
  if (isOwnCard) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#8b938c", marginBottom: 8 }}>This is your card.</p>
        <Link
          href="/settings/profile/card"
          style={{ fontSize: 13, color: "#4158f4", fontWeight: 500 }}
        >
          Edit visibility settings →
        </Link>
      </div>
    );
  }

  const fireClick = () => {
    void fetch(`/api/card/${card.username}/click`, { method: "POST" });
  };

  if (isLoggedIn) {
    const prefill = btoa(JSON.stringify(buildPrefillData(card)));
    return (
      <Link
        href={`/contacts/new?prefill=${encodeURIComponent(prefill)}`}
        style={CTA_STYLE}
        onClick={fireClick}
      >
        Save to Kontax
      </Link>
    );
  }

  // Logged-out: navigate to register with prefill context
  const prefill = btoa(JSON.stringify(buildPrefillData(card)));
  return (
    <div>
      <Link
        href={`/register?prefill=${encodeURIComponent(prefill)}`}
        style={CTA_STYLE}
        onClick={fireClick}
      >
        Add {card.displayName.split(" ")[0]} to Kontax
      </Link>
      <button
        type="button"
        onClick={() => { fireClick(); downloadVCard(card); }}
        style={{
          display: "block",
          width: "100%",
          marginTop: 10,
          padding: "9px 0",
          borderRadius: 12,
          background: "transparent",
          border: "1px solid #d8ddd6",
          color: "#5c655e",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Download .vcf (no account needed)
      </button>
    </div>
  );
}
