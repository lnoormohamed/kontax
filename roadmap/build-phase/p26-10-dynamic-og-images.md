# P26-10 — Dynamic OG Images

## Purpose

Generate server-side Open Graph images for vCard share pages (`/share/[token]`) so that when a share link is posted on WhatsApp, iMessage, or Twitter, the preview shows the contact's name and Kontax branding rather than the generic OG default image. Every shared contact link becomes an organic acquisition touchpoint.

## Background

Phase 12 (P12-02) created the vCard share page at `/share/[token]`. Currently it uses the static `og-default.png`. A dynamic branded card showing the contact's name makes the preview recognisable and compelling — the recipient immediately knows what they're about to receive. `@vercel/og` (or the equivalent `next/og`) renders a React component to a PNG image at the edge, with no external image processing service.

## Scope

**In scope:**
- `GET /api/og/share/[token]` — generates a branded OG image for a share page
- OG image design: contact name, optional first initial avatar, "Shared via Kontax" subtext, Kontax wordmark
- Wire the `/share/[token]` page to use the dynamic OG image URL in its `og:image` tag
- Privacy: only the contact's display name is shown (no phone number, email, or company in the OG image)

**Out of scope:**
- User profile card OG images (Phase 30, P30-05 — the public contact card)

---

## Design / Implementation Spec

### OG image route

`src/app/api/og/share/[token]/route.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const runtime = "edge"; // edge runtime required for @vercel/og

export async function GET(
  req: Request,
  { params }: { params: { token: string } },
) {
  const share = await fetchShareForOg(params.token);

  if (!share) {
    // Return the default OG image
    return new Response(null, { status: 302, headers: { Location: "/og-default.png" } });
  }

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        {/* Background gradient */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 70% 55% at 50% 36%, rgba(23,53,46,0.08) 0%, transparent 70%)",
        }} />

        {/* Avatar initial */}
        <div style={{
          width: 96, height: 96, borderRadius: 48,
          background: "#e3efe7", color: "#17352e",
          fontSize: 40, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 20,
        }}>
          {getInitial(share.contactName)}
        </div>

        {/* Contact name */}
        <div style={{
          fontSize: 42, fontWeight: 700, color: "#1d2823",
          letterSpacing: "-0.02em", marginBottom: 10,
        }}>
          {share.contactName}
        </div>

        {/* Sub text */}
        <div style={{
          fontSize: 20, color: "#5c655e", marginBottom: 40,
        }}>
          Shared via Kontax
        </div>

        {/* Kontax wordmark */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          position: "absolute", bottom: 32,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "#17352e", color: "#dff0e7",
            fontSize: 18, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>K</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#17352e", letterSpacing: "-0.018em" }}>
            Kontax
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
```

`fetchShareForOg` is a lightweight DB query (edge-compatible using the Prisma edge client or a direct query):
```typescript
async function fetchShareForOg(token: string) {
  const share = await db.contactShare.findFirst({
    where: { token, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { contactSnapshot: true },
  });
  if (!share) return null;
  const snapshot = share.contactSnapshot as { fullName?: string };
  return { contactName: snapshot.fullName ?? "A contact" };
}
```

### Wire to share page metadata

In `src/app/share/[token]/page.tsx`:

```typescript
export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const share = await getShareForPage(params.token);
  if (!share) return {};

  const ogImageUrl = `${BASE_URL}/api/og/share/${params.token}`;

  return {
    title: `${share.contactName} — shared via Kontax`,
    description: `${share.senderName} shared a contact with you on Kontax.`,
    robots: { index: false, follow: false }, // share pages should not be indexed
    openGraph: {
      title: `${share.contactName} — shared via Kontax`,
      description: `${share.senderName} shared a contact with you.`,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogImageUrl],
    },
  };
}
```

---

## Acceptance Criteria

- `GET /api/og/share/{token}` returns a 1200×630px PNG image for a valid, non-expired share token.
- The image shows the contact's display name, a branded avatar initial, "Shared via Kontax", and the Kontax wordmark.
- Expired or revoked tokens return a redirect to `/og-default.png`.
- The `/share/[token]` page `og:image` tag points to the dynamic image URL.
- Sharing a vCard link on WhatsApp or iMessage shows the branded contact card preview.
- The OG image shows only the contact name — no phone, email, or company is visible.
- The route uses the edge runtime for low latency.

---

## Risks and Open Questions

- **Edge DB access:** `@vercel/og` runs at the edge, which may not have access to the Prisma connection pool. Use Prisma's edge-compatible client (`@prisma/client/edge`) or a raw fetch to a lightweight `/api/share-meta/[token]` endpoint that the OG route calls. Confirm the DB access pattern before implementation.
- **Contact name privacy:** the OG image is publicly accessible by token. It only shows the name, but even a name may be sensitive for some users. Document that the share token URL (and thus the OG image) should only be sent to the intended recipient.
