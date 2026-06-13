import { ImageResponse } from "next/og";

// Default Open Graph / Twitter card image for all public routes (P26-07).
// Branded card on the locked light system — green ink, off-white surface.
export const alt = "Kontax — Your contacts, synced everywhere";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 20,
              background: "#17352e",
              color: "#dff0e7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 46,
              fontWeight: 700,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", color: "#17352e" }}>
            Kontax
          </div>
        </div>

        {/* Headline + sub */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#1d2823",
            }}
          >
            Your contacts,
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#1d2823",
            }}
          >
            synced everywhere.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#5c655e", maxWidth: 880 }}>
            One address book, always up to date — across every device, app, and the people you share with.
          </div>
        </div>

        {/* Footer accent */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, color: "#8b938c" }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "#4158f4" }} />
          Built on CardDAV · No lock-in
        </div>
      </div>
    ),
    { ...size },
  );
}
