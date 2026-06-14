import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { JsonLd } from "~/app/_components/json-ld";
import { auth } from "~/server/auth";
import { buildPersonSchema, getPublicCard } from "~/server/public-card/get-card";
import { recordCardView } from "~/server/public-card/analytics";
import { SITE_URL } from "~/lib/site-url";
import { AddToKontaxButton } from "./add-to-kontax";

import "~/app/_components/public-site.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const card = await getPublicCard(username);

  if (!card) {
    return { title: "Not found — Kontax", robots: { index: false } };
  }

  const subtitle =
    [card.jobTitle, card.company].filter(Boolean).join(" at ") ||
    `Contact ${card.displayName} via Kontax.`;

  return {
    title: `${card.displayName} — Kontax`,
    description: subtitle,
    robots: { index: true, follow: true },
    openGraph: {
      title: card.displayName,
      description: subtitle,
      url: `${SITE_URL}/u/${card.username}`,
    },
  };
}

// ── Minimal card nav ───────────────────────────────────────────────────────────
function CardNav() {
  return (
    <header className="nav">
      <div className="nav__inner">
        <Link className="brand" href="/" aria-label="Kontax home">
          <span className="brand__k">K</span>
          <span className="brand__word">Kontax</span>
        </Link>
        <div className="nav__actions">
          <Link className="nav__link" href="/login">Log in</Link>
          <Link className="btn-primary--sm" href="/register">Get started free</Link>
        </div>
      </div>
    </header>
  );
}

// ── Avatar / initial tile ─────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 88 }: { name: string; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: "50%", objectFit: "cover", width: size, height: size }}
      />
    );
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Deterministic colour from name
  const colours = [
    ["#e6f3ec", "#17352e"],
    ["#e8effe", "#2a3db0"],
    ["#fdf0e6", "#8a4a0e"],
    ["#f5e8fe", "#5e2a8a"],
    ["#e8f8f5", "#0e6b57"],
  ];
  const idx = name.charCodeAt(0) % colours.length;
  const [bg, fg] = colours[idx]!;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        flexShrink: 0,
      }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

// ── Contact field row ─────────────────────────────────────────────────────────
function FieldRow({
  icon,
  value,
  href,
}: {
  icon: React.ReactNode;
  value: string;
  href?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid #f0f2ee",
      }}
    >
      <span style={{ color: "#8b938c", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, color: "#1d2823", wordBreak: "break-all" }}>
        {href ? (
          <a href={href} rel="nofollow noopener noreferrer" style={{ color: "#1d2823" }}>
            {value}
          </a>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

// ── SVG icons (inline, no dependency) ─────────────────────────────────────────
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="3" />
    <path d="M2 7l10 7 10-7" />
  </svg>
);
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 012 1.18 2 2 0 013.98 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
  </svg>
);
const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);

// ── Public card component ─────────────────────────────────────────────────────
import type { PublicCardData } from "~/server/public-card/types";

function PublicCard({
  card,
  isLoggedIn,
  isOwnCard,
}: {
  card: PublicCardData;
  isLoggedIn: boolean;
  isOwnCard: boolean;
}) {
  const hasFields =
    card.emails.length > 0 || card.phones.length > 0 || card.websites.length > 0;

  return (
    <div
      style={{
        maxWidth: 440,
        margin: "48px auto 80px",
        background: "#ffffff",
        borderRadius: 20,
        border: "1px solid #d8ddd6",
        boxShadow: "0 16px 48px rgba(29,40,35,0.08)",
        padding: "40px 32px 32px",
      }}
    >
      {/* Avatar */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <Avatar name={card.displayName} avatarUrl={card.avatarUrl} size={88} />
      </div>

      {/* Name */}
      <h1
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: "#1d2823",
          textAlign: "center",
          letterSpacing: "-0.015em",
          margin: "0 0 4px",
          lineHeight: 1.2,
        }}
      >
        {card.displayName}
      </h1>

      {/* Job title / company */}
      {(card.jobTitle ?? card.company) && (
        <p style={{ fontSize: 14, color: "#5c655e", textAlign: "center", margin: "0 0 0" }}>
          {[card.jobTitle, card.company].filter(Boolean).join(" at ")}
        </p>
      )}

      {hasFields && (
        <>
          <hr style={{ border: "none", borderTop: "1px solid #e9ece7", margin: "20px 0 4px" }} />

          {card.emails.map((e) => (
            <FieldRow key={e} icon={<MailIcon />} value={e} href={`mailto:${e}`} />
          ))}
          {card.phones.map((p) => (
            <FieldRow key={p} icon={<PhoneIcon />} value={p} href={`tel:${p}`} />
          ))}
          {card.websites.map((w) => (
            <FieldRow key={w} icon={<GlobeIcon />} value={w} href={w} />
          ))}
        </>
      )}

      <hr style={{ border: "none", borderTop: "1px solid #e9ece7", margin: "20px 0" }} />

      <AddToKontaxButton card={card} isLoggedIn={isLoggedIn} isOwnCard={isOwnCard} />

      <p style={{ fontSize: 12, color: "#8b938c", textAlign: "center", marginTop: 20 }}>
        Shared via{" "}
        <a href={SITE_URL} style={{ color: "#8b938c" }}>
          Kontax
        </a>
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function PublicCardPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [card, session, hdrs] = await Promise.all([getPublicCard(username), auth(), headers()]);

  if (!card) notFound();

  const isLoggedIn = !!session?.user?.id;
  const isOwnCard = session?.user?.id === card.userId;

  // Record view — fire-and-forget, skip self-views
  if (!isOwnCard) {
    void recordCardView(
      card.userId,
      hdrs.get("referer") ?? undefined,
      hdrs.get("user-agent") ?? undefined,
    );
  }

  return (
    <div className="kx" style={{ minHeight: "100dvh", background: "#f6f7f4" }}>
      <JsonLd data={buildPersonSchema(card)} />
      <CardNav />
      <main style={{ padding: "0 16px" }}>
        <PublicCard card={card} isLoggedIn={isLoggedIn} isOwnCard={isOwnCard} />
      </main>
    </div>
  );
}
