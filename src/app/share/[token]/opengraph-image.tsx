import { ImageResponse } from "next/og";

import { resolveShareForDisplay, shareInitials } from "~/server/public-share";

// P26-10: branded OG card for a vCard share link — contact name + Kontax mark, on
// the locked light system. Auto-wired as og:image / twitter:image for /share/{token}.
export const alt = "Shared contact on Kontax";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ShareOgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await resolveShareForDisplay(token);
  const name = share.status === "ok" ? share.name : "Shared contact";
  const secondary = share.status === "ok" ? share.secondary : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f4f6f2",
          backgroundImage:
            "radial-gradient(ellipse 70% 60% at 70% 35%, rgba(23,53,46,0.10) 0%, rgba(23,53,46,0) 70%)",
          padding: "72px 80px",
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#17352e",
              color: "#dff0e7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
              fontWeight: 700,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", color: "#17352e" }}>
            Shared via Kontax
          </div>
        </div>

        {/* Contact card */}
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div
            style={{
              width: 168,
              height: 168,
              borderRadius: 84,
              background: "#e7efe9",
              color: "#17352e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
              fontWeight: 600,
            }}
          >
            {shareInitials(name)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "#1d2823",
              }}
            >
              {name}
            </div>
            {secondary ? (
              <div style={{ marginTop: 16, fontSize: 34, color: "#5c655e" }}>{secondary}</div>
            ) : null}
          </div>
        </div>

        {/* Footer accent */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, color: "#8b938c" }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "#4158f4" }} />
          Save this contact to your address book
        </div>
      </div>
    ),
    { ...size },
  );
}
