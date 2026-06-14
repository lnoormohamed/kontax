import { ImageResponse } from "next/og";

import { db } from "~/server/db";
import type { PublicCardFieldConfig } from "~/server/public-card/types";

export const alt = "Contact card on Kontax";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Deterministic avatar colour — matches the contacts list palette.
const PALETTE = [
  { bg: "#e7efe9", fg: "#17352e" },
  { bg: "#eef2ff", fg: "#3730a3" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#fae8ff", fg: "#86198f" },
  { bg: "#dcfce7", fg: "#166534" },
  { bg: "#ffe4e6", fg: "#9f1239" },
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function CardOgImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const user = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { name: true, publicCardFields: true },
  });

  const fields = (user?.publicCardFields ?? {}) as PublicCardFieldConfig;
  const displayName = user?.name ?? username;

  // Hidden or unknown card → default OG
  if (!user || fields.hidden) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f4f6f2",
            fontSize: 40,
            color: "#8b938c",
          }}
        >
          Kontax
        </div>
      ),
      { ...size },
    );
  }

  const colour = avatarColor(displayName);
  const initial = initials(displayName);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f4f6f2",
          backgroundImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(23,53,46,0.08) 0%, rgba(23,53,46,0) 70%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 24,
            border: "1px solid #d8ddd6",
            boxShadow: "0 24px 60px rgba(29,40,35,0.10)",
            padding: "56px 72px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: 480,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              background: colour.bg,
              color: colour.fg,
              fontSize: 44,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 28,
            }}
          >
            {initial}
          </div>

          {/* Name */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#1d2823",
              letterSpacing: "-0.025em",
              marginBottom: 8,
            }}
          >
            {displayName}
          </div>

          {/* Label */}
          <div
            style={{
              fontSize: 18,
              color: "#8b938c",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginTop: 20,
            }}
          >
            Contact card on Kontax
          </div>
        </div>

        {/* Kontax wordmark */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            right: 48,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "#17352e",
              color: "#dff0e7",
              fontSize: 18,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            K
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#17352e",
              letterSpacing: "-0.018em",
            }}
          >
            Kontax
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
