# P30-02 — Public Card Page

## Purpose

Build the public contact card at `/u/{username}` — a server-rendered, SEO-crawlable page that displays a user's chosen public fields (name, photo, contact methods) to anyone with the URL. The page is the product's primary acquisition touchpoint: every person who receives someone's Kontax card URL is a potential new user.

## Background

The username model (P30-01) and visibility controls (P30-03) establish which users have a public card and which fields are shown. This ticket implements the page itself: server-side rendering for SEO, the `Person` JSON-LD schema, graceful handling of unclaimed usernames (404), and the structural layout specified in P30-DB11.

## Scope

**In scope:**
- `/u/{username}` server component (App Router dynamic route)
- Renders only the fields the user has made visible (P30-03)
- Avatar: if uploaded, displayed as a circle; otherwise, a coloured initial tile
- `Person` JSON-LD structured data
- Graceful 404 for unclaimed or hidden (visibility = none) usernames
- Authenticated user redirect: logged-in users do NOT get redirected to `/contacts` — they see the card (it's someone else's card)
- View count increment on each page load (calls `recordCardView`, P30-06)
- Minimal nav: Kontax logo + "Log in" link (not the full app nav)
- `<meta name="robots" content="index, follow">`

**Out of scope:**
- OG image (P30-05)
- "Add to Kontax" flow implementation (P30-04)
- Analytics detail (P30-06)

---

## Design / Implementation Spec

### Route

`src/app/(public)/u/[username]/page.tsx`:

```typescript
export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const card = await getPublicCard(params.username);
  if (!card) return { title: "Not found — Kontax", robots: { index: false } };

  return {
    title: `${card.displayName} — Kontax`,
    description: [card.jobTitle, card.company].filter(Boolean).join(" at ") ||
      `Contact ${card.displayName} via Kontax.`,
    robots: { index: true, follow: true },
    openGraph: {
      title: `${card.displayName}`,
      description: card.jobTitle ? `${card.jobTitle}${card.company ? ` at ${card.company}` : ""}` : undefined,
      images: [`${BASE_URL}/api/og/card/${params.username}`], // P30-05
    },
  };
}

export default async function PublicCardPage({ params }: { params: { username: string } }) {
  const card = await getPublicCard(params.username);

  if (!card) {
    notFound(); // renders /u/[username]/not-found.tsx or the root not-found page
  }

  // Record the view (fire-and-forget — never blocks render)
  void recordCardView(card.userId, params.username);

  return (
    <>
      <JsonLd data={buildPersonSchema(card)} />
      <PublicCardLayout>
        <PublicCard card={card} />
      </PublicCardLayout>
    </>
  );
}
```

### `getPublicCard`

```typescript
interface PublicCardData {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  company: string | null;
  visibleFields: VisibleFields; // from User.publicCardFields
  emails: Array<{ value: string; label: string }>;
  phones: Array<{ value: string; label: string }>;
  websites: Array<{ value: string; label: string }>;
}

export async function getPublicCard(username: string): Promise<PublicCardData | null> {
  const user = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      name: true,
      publicCardFields: true,
      // The card fields come from the user's own contact record (their own contact in their Default book)
      // OR from explicit User profile fields (simpler approach for v1)
    },
  });

  if (!user || !user.username) return null;

  const fields = (user.publicCardFields ?? {}) as VisibleFields;

  // If the user has set visibility to "none", return null
  if (fields.hidden) return null;

  // Build the card from the user's profile + their own contact record
  const ownContact = await db.contact.findFirst({
    where: { userId: user.id, isOwnProfile: true },
    select: {
      firstName: true, lastName: true, fullName: true,
      jobTitle: true, company: true, emails: true, phones: true, urls: true,
    },
  });

  const displayName = ownContact?.fullName ?? user.name ?? username;

  return {
    userId: user.id,
    username: user.username,
    displayName,
    avatarUrl: null, // avatar upload deferred — use initial tile
    jobTitle: fields.showJobTitle !== false ? (ownContact?.jobTitle ?? null) : null,
    company: fields.showCompany !== false ? (ownContact?.company ?? null) : null,
    visibleFields: fields,
    emails: fields.showEmail ? (ownContact?.emails as any[] ?? []) : [],
    phones: fields.showPhone ? (ownContact?.phones as any[] ?? []) : [],
    websites: fields.showWebsite ? (ownContact?.urls as any[] ?? []) : [],
  };
}
```

**Alternative for v1** (simpler): instead of a separate "own profile" contact, the public card reads directly from `User` profile fields (`name`, `jobTitle`, `company`) and the user's explicitly exported field values. This avoids the need for an `isOwnProfile` contact flag. Decide which approach to take before implementation and document the decision.

### `PublicCard` component

Per the P30-DB11 spec:

```tsx
function PublicCard({ card }: { card: PublicCardData }) {
  return (
    <div style={{
      maxWidth: 440, margin: "48px auto",
      background: "#ffffff", borderRadius: 20,
      border: "1px solid #d8ddd6",
      boxShadow: "0 16px 48px rgba(29,40,35,0.08)",
      padding: "40px 32px",
    }}>
      {/* Avatar */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <AvatarOrInitial name={card.displayName} size={96} avatarUrl={card.avatarUrl} />
      </div>

      {/* Name + subtitle */}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1d2823", textAlign: "center",
        letterSpacing: "-0.015em", margin: "0 0 6px" }}>
        {card.displayName}
      </h1>
      {(card.jobTitle || card.company) && (
        <p style={{ fontSize: 15, color: "#5c655e", textAlign: "center", margin: "0 0 24px" }}>
          {[card.jobTitle, card.company].filter(Boolean).join(" at ")}
        </p>
      )}

      <hr style={{ border: "none", borderTop: "1px solid #e9ece7", margin: "0 0 20px" }} />

      {/* Contact fields */}
      {card.emails.map((e) => (
        <FieldRow key={e.value} icon={<Mail size={16} />} value={e.value}
          action={{ label: "Copy", onClick: () => copyToClipboard(e.value) }} />
      ))}
      {card.phones.map((p) => (
        <FieldRow key={p.value} icon={<Phone size={16} />} value={p.value}
          action={{ label: "Copy", onClick: () => copyToClipboard(p.value) }} />
      ))}
      {card.websites.map((w) => (
        <FieldRow key={w.value} icon={<Globe size={16} />} value={w.value}
          action={{ label: "Open", href: w.value }} />
      ))}

      <hr style={{ border: "none", borderTop: "1px solid #e9ece7", margin: "20px 0" }} />

      {/* CTA — P30-04 wires this */}
      <AddToKontaxButton card={card} />

      {/* Attribution */}
      <p style={{ fontSize: 12, color: "#8b938c", textAlign: "center", marginTop: 24 }}>
        Shared via{" "}
        <a href="https://kontax.app" style={{ color: "#8b938c" }}>Kontax</a>
      </p>
    </div>
  );
}
```

### `Person` JSON-LD schema

```typescript
function buildPersonSchema(card: PublicCardData): object {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: card.displayName,
    jobTitle: card.jobTitle ?? undefined,
    worksFor: card.company ? { "@type": "Organization", name: card.company } : undefined,
    email: card.emails[0]?.value,
    telephone: card.phones[0]?.value,
    url: card.websites[0]?.value,
    sameAs: card.websites.map((w) => w.value),
  };
}
```

---

## Acceptance Criteria

- `/u/{username}` renders the correct card for a user with a claimed username.
- Only fields the user has made visible (P30-03) appear on the card.
- A username with no user or with `fields.hidden = true` returns a 404.
- The page includes `Person` JSON-LD structured data.
- `recordCardView` is called on each page load (fire-and-forget, never blocks render).
- The page is server-rendered; content is visible in view-source.
- `<meta name="robots" content="index, follow">` is present.
- The minimal nav (logo + Log in) renders — not the full app nav.
- The avatar shows an initial tile when no photo is uploaded.

---

## Risks and Open Questions

- **"Own profile" contact vs User fields:** deciding whether the public card reads from a special contact record or from User-level fields is an architectural choice. The contact record approach is more flexible (uses all the rich field infrastructure from Phase 6) but adds complexity (an `isOwnProfile` flag, a migration to create the profile contact for existing users). The User-field approach is simpler but limits the card to fields explicitly stored on User. For v1, start with User fields and add a migration path to contact-backed profiles later.
- **Card caching:** public cards are server-rendered on every request. For popular cards, add a 60-second `Cache-Control: public, max-age=60` header so CDN edge nodes cache the page. The view count increment is fire-and-forget so it is not blocked by caching.
