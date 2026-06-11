# P30-05 — OG Image for Card Pages

## Purpose

Generate a server-side Open Graph image for each public contact card page (`/u/{username}`) so that when the card URL is shared on WhatsApp, iMessage, LinkedIn, or Twitter, the preview shows a branded card with the contact's name and avatar initial — turning every card share into a recognisable visual impression.

## Background

P26-10 created the OG image for vCard share links (`/share/{token}`). This ticket creates a similar but distinct OG image for the permanent card pages at `/u/{username}`. The design matches the public card page itself: a clean white card with the Kontax wordmark, avatar initial in a coloured circle, name, and job title/company.

## Scope

**In scope:**
- `GET /api/og/card/[username]` edge-runtime route — generates a 1200×630px PNG
- Design: avatar initial circle (same colour hash as the contacts list), name, job/company subtitle, "Contact card on Kontax" label, Kontax wordmark in the bottom corner
- Privacy: only renders fields that the user has made public (reads `User.publicCardFields`)
- Caching: `Cache-Control: public, max-age=3600` so the CDN caches the image per username
- Wire to the `/u/{username}` page's `og:image` and `twitter:image` meta tags (P30-02)

**Out of scope:**
- Photo/avatar images (deferred — initial tile only in v1)
- Custom card backgrounds

---

## Design / Implementation Spec

### OG image route

`src/app/api/og/card/[username]/route.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(
  req: Request,
  { params }: { params: { username: string } },
) {
  const card = await getPublicCardForOg(params.username);

  if (!card) {
    // Return the default OG image
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/og-default.png`, 302);
  }

  // Compute avatar colour from name hash (same logic as the contact list)
  const avatarColour = computeAvatarColor(card.displayName);
  const initial = card.displayName.charAt(0).toUpperCase();

  const subtitle = [card.jobTitle, card.company].filter(Boolean).join(" at ");

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%",
        background: "#f4f6f2",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Card */}
        <div style={{
          background: "#ffffff", borderRadius: 24,
          border: "1px solid #d8ddd6",
          boxShadow: "0 24px 60px rgba(29,40,35,0.10)",
          padding: "48px 60px",
          display: "flex", flexDirection: "column", alignItems: "center",
          minWidth: 480, maxWidth: 600,
        }}>
          {/* Avatar initial */}
          <div style={{
            width: 96, height: 96, borderRadius: 48,
            background: avatarColour.bg,
            color: avatarColour.text,
            fontSize: 42, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 24,
          }}>
            {initial}
          </div>

          {/* Name */}
          <div style={{
            fontSize: 40, fontWeight: 700, color: "#1d2823",
            letterSpacing: "-0.02em", marginBottom: 8,
          }}>
            {card.displayName}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div style={{ fontSize: 20, color: "#5c655e", marginBottom: 32 }}>
              {subtitle}
            </div>
          )}

          {/* "Contact card on Kontax" label */}
          <div style={{
            fontSize: 14, color: "#8b938c",
            letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            Contact card on Kontax
          </div>
        </div>

        {/* Kontax wordmark — bottom right of the image */}
        <div style={{
          position: "absolute", bottom: 32, right: 40,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "#17352e", color: "#dff0e7",
            fontSize: 15, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>K</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#17352e", letterSpacing: "-0.018em" }}>
            Kontax
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}

async function getPublicCardForOg(username: string): Promise<{
  displayName: string;
  jobTitle: string | null;
  company: string | null;
} | null> {
  // Lightweight query — only fields needed for the OG image
  const user = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { name: true, publicCardFields: true },
  });

  if (!user?.name) return null;
  const fields = (user.publicCardFields ?? {}) as { hidden?: boolean };
  if (fields.hidden) return null;

  // For v1, job title and company come from User-level profile fields
  // (or the own-profile contact — see P30-02 architectural note)
  return {
    displayName: user.name,
    jobTitle: null, // populated when profile fields are expanded in P30-02
    company: null,
  };
}
```

### Avatar colour computation (shared with the contact list)

```typescript
// src/lib/avatar-color.ts — already used by the contacts list
export function computeAvatarColor(name: string): { bg: string; text: string } {
  const PALETTES = [
    { bg: "#efe9df", text: "#85703f" },
    { bg: "#e9e7f4", text: "#5a55a6" },
    { bg: "#f2e6ea", text: "#9a4a63" },
    { bg: "#e6ece4", text: "#3f6b53" },
    { bg: "#e8efe0", text: "#5f7a3a" },
    { bg: "#e3eef0", text: "#3f7d7a" },
    { bg: "#f3e7df", text: "#9a623a" },
    { bg: "#eae3f2", text: "#6a4a9a" },
  ];

  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) & 0xffffffff;
  return PALETTES[Math.abs(hash) % PALETTES.length]!;
}
```

### Wire to card page metadata (P30-02)

In `generateMetadata` for `/u/{username}`:

```typescript
openGraph: {
  images: [{
    url: `${BASE_URL}/api/og/card/${params.username}`,
    width: 1200,
    height: 630,
    alt: `${card.displayName}'s contact card on Kontax`,
  }],
},
twitter: {
  card: "summary_large_image",
  images: [`${BASE_URL}/api/og/card/${params.username}`],
},
```

---

## Acceptance Criteria

- `GET /api/og/card/{username}` returns a 1200×630px PNG image for a valid, public username.
- The image shows the avatar initial circle (correct colour from the hash palette), display name, subtitle (job title + company), and Kontax wordmark.
- Hidden cards (`fields.hidden = true`) return a 302 redirect to `/og-default.png`.
- Unknown usernames return a 302 redirect to `/og-default.png`.
- The image has `Cache-Control: public, max-age=3600` so CDN caches it.
- Sharing a card URL on WhatsApp or Twitter shows the correct branded card preview.
- The avatar colour matches the colour used for the same person in the contacts list.

---

## Risks and Open Questions

- **Edge DB access:** same as P26-10 — the edge runtime may not support the full Prisma client. Use an edge-compatible query or call an internal API endpoint from the OG route. Benchmark the cold start time; if > 500ms, switch to a short-TTL edge cache with a background regeneration strategy.
- **Name-only OG image:** for v1, the OG image contains only the public name (no job title or company) because the profile field architecture (P30-02 risk note) is not yet resolved. Ship the basic name-and-initial image first; add subtitle when the profile fields decision is made.
