import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OG_PAGES: Record<string, { title: string; description: string }> = {
  homepage: {
    title: "Your contacts. Organised, synced, and always with you.",
    description: "The address book for how you actually live.",
  },
  features: {
    title: "Everything your contacts need",
    description:
      "Search, labels, sync, sharing, public card, and a developer API.",
  },
  pricing: {
    title: "Simple, honest pricing",
    description:
      "Free forever, or upgrade for unlimited contacts and sync.",
  },
  security: {
    title: "Security you can trust",
    description: "Encrypted at rest, TLS in transit, GDPR compliant.",
  },
  changelog: {
    title: "What's new in Kontax",
    description: "Every update, newest first.",
  },
  contact: {
    title: "Get in touch",
    description:
      "We read every message and respond within 1 business day.",
  },
  about: {
    title: "About Kontax",
    description:
      "Built because address books haven't kept up with how we live.",
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "homepage";
  const data = OG_PAGES[page] ?? OG_PAGES.homepage!;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#17352e",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            K
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.01em",
            }}
          >
            Kontax
          </div>
        </div>

        {/* Title + description */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              color: "#ffffff",
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              maxWidth: 960,
            }}
          >
            {data.title}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 24,
              lineHeight: 1.5,
              maxWidth: 760,
            }}
          >
            {data.description}
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            color: "rgba(255,255,255,0.35)",
            fontSize: 17,
            letterSpacing: "0.01em",
          }}
        >
          getkontax.com
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
