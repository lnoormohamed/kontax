# P34C-19 — Meta Titles and Descriptions Audit

## Purpose

Audit and update `<title>` and `<meta name="description">` for all marketing
pages and key public routes. Accurate, well-crafted meta descriptions improve
click-through rate from organic search and ensure link previews in messaging
apps show useful text.

## Background

New pages created in Phase 34C each need `metadata` exports. Older pages (the
existing homepage, `/login`, `/register`, `/help`, `/developers`, `/u/[username]`)
may have placeholder, auto-generated, or stale descriptions. This ticket audits
them all and updates to production-quality copy.

## Scope

**In scope**
- All marketing pages: `/`, `/features`, `/pricing`, `/security`, `/changelog`,
  `/about`, `/contact`, `/privacy`, `/terms`.
- Key public routes: `/login`, `/register`, `/help`, `/developers`,
  `/u/[username]` (public contact card).
- A centralised marketing meta constants file (optional but recommended).
- `og:title` and `og:description` updated to match `<title>` and
  `<meta description>` respectively.

**Out of scope**
- Authenticated routes (`/contacts`, `/settings`, `/sync`, `/admin`).
- Per-contact detail pages (authenticated, no public meta needed).
- Keyword research or SEO strategy (out of engineering scope).

## Design / Implementation Spec

### Meta specification table

| Route | Title | Description (≤ 160 chars) |
|---|---|---|
| `/` | `Kontax — Your contacts, organised and synced` | `Manage your address book across every device. Search, labels, CardDAV sync, Google Contacts, shared books, and a public contact card.` |
| `/features` | `Features — Kontax` | `Grouped search, labels, multi-provider sync, family and team shared books, public contact cards, and a developer REST API.` |
| `/pricing` | `Pricing — Kontax` | `Start free with 100 contacts. Upgrade to Pro for unlimited contacts, sync, and the developer API.` |
| `/security` | `Security — Kontax` | `How Kontax protects your data: TLS encryption, bcrypt passwords, 2FA, encrypted sync credentials, and GDPR compliance.` |
| `/changelog` | `Changelog — Kontax` | `Every Kontax update in order — new features, improvements, and fixes.` |
| `/about` | `About — Kontax` | `Kontax was built because address books haven't kept up with how we live. Made by Vexon.` |
| `/contact` | `Contact — Kontax` | `Get in touch with the Kontax team. We aim to respond within 1 business day.` |
| `/privacy` | `Privacy Policy — Kontax` | `How Kontax collects, uses, and protects your data, and your rights under GDPR.` |
| `/terms` | `Terms of Service — Kontax` | `The terms governing your use of Kontax — subscriptions, acceptable use, and your rights.` |
| `/login` | `Log in — Kontax` | `Log in to your Kontax account.` |
| `/register` | `Get started — Kontax` | `Create a free Kontax account. No credit card required.` |
| `/help` | `Help — Kontax` | `Guides and documentation for using Kontax.` |
| `/developers` | `Developer API — Kontax` | `The Kontax REST API at api.getkontax.com — CRUD for contacts, labels, and sync. API reference and authentication docs.` |
| `/u/[username]` | `[Name]'s contact card — Kontax` | `Add [Name] to your contacts in one tap.` |

**Length check**: every description above is ≤ 160 characters. Verify with a
character counter before finalising — Google truncates at ~155–160 chars.

### Implementation approach

**Option A (inline in each page)**:
Each `page.tsx` exports its own `metadata` object. Simple, co-located, but
requires opening many files.

**Option B (centralised constants)**:
```ts
// src/app/(marketing)/_lib/marketing-meta.ts
export const MARKETING_META = {
  home: {
    title: "Kontax — Your contacts, organised and synced",
    description: "Manage your address book across every device …",
  },
  features: { title: "Features — Kontax", description: "…" },
  // …
};
```
Each `page.tsx` imports from this file. Easier to audit and update — recommended.

For `/u/[username]`, the metadata must be dynamic:
```tsx
export async function generateMetadata(
  { params }: { params: { username: string } }
): Promise<Metadata> {
  const user = await getPublicUser(params.username);
  if (!user) return { title: "Kontax" };
  return {
    title: `${user.name}'s contact card — Kontax`,
    description: `Add ${user.name} to your contacts in one tap.`,
    openGraph: {
      title: `${user.name}'s contact card`,
      description: `Add ${user.name} to your contacts in one tap.`,
      images: [{ url: `/api/og?page=public-card&name=${encodeURIComponent(user.name)}` }],
    },
  };
}
```

### og: properties

For each page set:
```tsx
openGraph: {
  title: "…",            // same as <title> without "— Kontax" suffix
  description: "…",     // same as meta description
  url: "https://getkontax.com/features",
  siteName: "Kontax",
  images: [{ url: "/api/og?page=features", width: 1200, height: 630 }],
  type: "website",
},
twitter: {
  card: "summary_large_image",
  title: "…",
  description: "…",
},
```

### Audit checklist

Run through each route before marking done:
- [ ] `/` — title and description match table above.
- [ ] `/features`
- [ ] `/pricing`
- [ ] `/security`
- [ ] `/changelog`
- [ ] `/about`
- [ ] `/contact`
- [ ] `/privacy`
- [ ] `/terms`
- [ ] `/login`
- [ ] `/register`
- [ ] `/help`
- [ ] `/developers`
- [ ] `/u/[username]` — dynamic metadata works.

Verify descriptions are ≤ 160 chars and `og:description` matches.

## Acceptance Criteria

- [ ] All 14 routes listed above have `title` and `description` set.
- [ ] No description exceeds 160 characters.
- [ ] `og:title` and `og:description` are set on every marketing page.
- [ ] `/u/[username]` dynamic metadata generates correctly for an existing user.
- [ ] No pages have the Next.js default title (`Create Next App`) or an
      auto-generated description.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **`/u/[username]` OG image**: the dynamic OG image for public cards requires
  a `?page=public-card&name=` variant in the OG route (P34C-18). Coordinate
  with P34C-18 to ensure the param is supported.
- **Existing meta**: some routes may use `layout.tsx`-level metadata that
  overrides page-level metadata unexpectedly. Check for a root layout
  `metadata` export and ensure page-level `metadata` properly overrides it.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: document the marketing-meta.ts constants
      file and the process for updating meta copy
