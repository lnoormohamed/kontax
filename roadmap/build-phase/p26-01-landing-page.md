# P26-01 — Landing Page

## Purpose

Replace the interim public landing page at `/` (shipped by P18-12) with the locked `05-public-landing.md` design spec: a two-column hero with product preview panel, four feature highlight cards, sticky navigation bar, and minimal footer. This is the primary acquisition surface — every marketing link, ad, and word-of-mouth referral lands here.

## Background

**P18-12 already performed the route split** this ticket depends on: `/` is a public marketing homepage (rendering an interim `<PublicLanding />` component), the authenticated workspace lives at `/contacts`, and the middleware treats `/` and the marketing/legal pages as public. So the routing, middleware `PUBLIC_PATHS`, and post-auth redirect work are **done** — this ticket is purely the *visual* implementation of the locked design, swapping the interim `PublicLanding` for the real thing.

**Logged-in behaviour (changed from the original draft):** per P18-12, a logged-in user visiting `/` **sees the landing page** (with an "Open Kontax →" CTA), and is **not** redirected to `/contacts`. The whole point of the split is that authenticated users can still view the marketing homepage. Do **not** add a server-side `redirect("/contacts")` here.

The design is locked in `05-public-landing.md`. This ticket implements it exactly — no design decisions, only implementation. Key points from the brief: light design system, 56–64px headline ("Your contacts, synced everywhere."), product preview panel with specific contacts and avatar colours, four feature cards, subtle feature-card scroll animation respecting `prefers-reduced-motion`.

## Scope

**In scope:**
- `/` page component (`src/app/page.tsx`, server component) replacing the interim P18-12 `<PublicLanding />`
- Sticky nav bar with Kontax brand mark, and **auth-aware CTAs**: "Log in" + "Get started free" when logged out; "Open Kontax →" (→ `/contacts`) when logged in
- Two-column hero: headline, subtext, CTA buttons, product preview panel (hero CTA also swaps to "Open Kontax →" when authenticated)
- Feature highlights section: 4 cards with locked copy and icons
- Footer with © and nav links
- Scroll-triggered feature card entrance animation (IntersectionObserver)
- Full mobile responsiveness per the design brief

**Out of scope:**
- The route split, middleware `PUBLIC_PATHS`, and post-auth redirect targets — **done in P18-12**
- The logged-in→`/contacts` redirect — explicitly removed (see Background); logged-in users see the page
- Pricing section (Phase 19 pricing page — P19-08)
- Testimonials or social proof strip (future)
- Animated product preview panel (future)

---

## Design / Implementation Spec

### Route and server component

Lives at the flat `src/app/page.tsx` (the same file P18-12 created for the
interim landing — this ticket replaces its body). No `(public)` route group:
the app uses a flat route structure and the middleware (P18-12) already gates
routes by path, so a route group adds no value here.

```typescript
import { auth } from "~/server/auth";

export default async function LandingPage() {
  const session = await auth();
  const isAuthenticated = !!session?.user?.id;

  // No redirect: logged-in users see the landing page too (P18-12). The CTAs
  // below switch to "Open Kontax →" when isAuthenticated is true.
  return (
    <>
      <LandingNav isAuthenticated={isAuthenticated} />
      <main>
        <HeroSection isAuthenticated={isAuthenticated} />
        <FeaturesSection />
      </main>
      <LandingFooter />
    </>
  );
}

export const metadata = {
  title: "Kontax — Your contacts, synced everywhere",
  description: "One address book, always up to date — across all your devices, apps, and the people you share with.",
};
```

### Navigation bar

```tsx
// src/app/_components/landing-nav.tsx
// Sticky, height 60px, white, border-bottom: 1px solid #d8ddd6
// Left: K tile + "Kontax" wordmark (34×34px, bg #17352e)
// Right (logged out): "Log in" text link → /login, "Get started free" blue button → /register
// Right (logged in):  "Open Kontax →" blue button → /contacts  (single CTA)
```

K tile: `34×34px`, `border-radius: 10px`, `background: #17352e`, `color: #dff0e7`, `font-size: 19px`, `font-weight: 700`. Wordmark: `font-size: 20px`, `font-weight: 600`, `letter-spacing: -0.018em`, `color: #17352e`.

Mobile nav (< 768px): logo left, "Log in" text link right only (logged out) / "Open Kontax →" (logged in) — "Get started" button removed from nav (hero CTAs are sufficient).

### Hero section

Left column (max-width 520px):
- Eyebrow: "Contact management, reimagined" — `font-size: 12px`, uppercase, `color: #5c655e`, `letter-spacing: 0.1em`
- Headline: `font-size: 56px` (desktop), `font-weight: 700`, `line-height: 1.1`, `letter-spacing: -0.02em`. Preserve the line break after "contacts,"
- Subtext: "One address book, always up to date — across all your devices, apps, and the people you share with." — 18–20px, `color: #5c655e`
- CTAs (logged out): "Get started free" (blue, 48px height) + "Log in →" (outlined). When authenticated, replace both with a single "Open Kontax →" (blue) → `/contacts`.

Right column: product preview panel — browser chrome bar + app header + contact list rows. Use the exact avatar colours from the design brief for each contact. Bottom fade with `linear-gradient`. Optional `perspective(1200px) rotateY(-3deg)` tilt (disabled for `prefers-reduced-motion`).

### Feature highlights section

`background: #f4f6f2`, `padding: 80px 48px`. Four cards in CSS Grid `grid-template-columns: repeat(4, 1fr)` (2-col tablet, 1-col mobile).

Cards: white, `border: 1px solid #d8ddd6`, `border-radius: 14px`. Content per the design brief. "Family & team sharing" card has `[Coming soon]` chip and `opacity: 0.75`.

Scroll entrance animation:
```typescript
// IntersectionObserver — applies "animate-in" class when card enters viewport
// CSS: .feature-card { opacity: 0; transform: translateY(8px); transition: opacity 400ms, transform 400ms; }
// .feature-card.animate-in { opacity: 1; transform: translateY(0); }
// Stagger: 80ms delay per card using animation-delay
// @media (prefers-reduced-motion: reduce) { .feature-card { opacity: 1; transform: none; } }
```

### Footer

White, `border-top: 1px solid #d8ddd6`, height 56px. "© 2026 Kontax" left. "Log in", "Register", "Pricing (coming soon)" right.

---

## Acceptance Criteria

- Logged-in users visiting `/` **see the landing page** (no redirect), with the nav and hero CTAs showing a single "Open Kontax →" button linking to `/contacts`.
- Logged-out users visiting `/` see the landing page with "Log in" / "Get started free" CTAs.
- The page renders fully server-side (no client JS required for the initial paint).
- Nav, hero, features, and footer match the `05-public-landing.md` design spec.
- The product preview panel shows the exact contacts, avatar colours, and layout from the brief.
- Feature cards animate in on scroll; animation is disabled when `prefers-reduced-motion: reduce`.
- The page is fully responsive: hero stacks at < 768px; feature cards are 2-col at tablet, 1-col at mobile.
- `<title>` and `<meta description>` are set (P26-07 adds full OG tags; this ticket sets the basics).
- Time to First Contentful Paint < 1.5s on a simulated 4G connection (no dynamic data fetch).

---

## Risks and Open Questions

- **Middleware / public routes — already done in P18-12:** `/` and the marketing/legal pages are already excluded from the auth redirect (P18-12 restructured the middleware into ALWAYS_ALLOW / restricted-session gates / public-content / protected tiers, with `/` matched exactly). This ticket does **not** touch the middleware. If Phase 26 adds new public surfaces (e.g. `/help`), add their prefixes to `PUBLIC_PREFIXES` then — but the landing page itself needs no middleware change. No `(public)` route group is introduced (the app uses flat routes).
- **Product preview panel maintenance:** the preview panel contains hardcoded contact data and avatar colours. When the contacts list design changes (e.g., new field shown in rows), the preview must be manually updated. Consider a comment flag: `// LANDING PAGE PREVIEW — update when contact row design changes`.
