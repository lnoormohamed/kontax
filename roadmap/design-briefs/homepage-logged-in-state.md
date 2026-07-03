# Design Brief — Homepage Logged-In State

## Context

The Kontax marketing homepage (`getkontax.com`) is currently fully static — it shows the same content regardless of whether the visitor is signed in. When a logged-in user lands on the homepage (e.g. via a shared link, bookmark, or the back button), they see "Log in" and "Get started" buttons that are irrelevant to them.

This brief covers two surfaces that need a logged-in variant:

1. **The navigation bar** — swap "Log in / Get started" for a "Go to app" button and a user avatar/initial
2. **The hero section** — swap the acquisition-focused copy and CTAs for a returning-user welcome

---

## Brand / Style

| Token | Value |
|---|---|
| Primary green | `#17352e` |
| Dark ink | `#1d2823` |
| Muted text | `#8b938c` |
| Tile / light green | `#dff0e7` |
| Surface | `#f4f6f2` |
| Border | `#d8ddd6` |
| Font | Geist (same as the rest of the site) |

---

## Surface 1 — Navigation Bar

### Logged-out (current)
```
[K Kontax]  Features  Pricing  Security  Changelog       [Log in]  [Get started →]
```

### Logged-in (new)
```
[K Kontax]  Features  Pricing  Security  Changelog       [Go to app →]  [L]
```

**Changes:**
- Replace "Log in" link with nothing (removed)
- Replace "Get started" button with **"Go to app →"** — same dark green pill style, links to `/contacts`
- Add a **user avatar chip** to the right of "Go to app": circle, 32×32px, `#dff0e7` background, `#17352e` text, showing the user's initials (e.g. "LN"). Clicking it goes to `/settings/account`
- On mobile: the hamburger menu's "Log in" link becomes "Go to app" and the "Get started" button is removed

---

## Surface 2 — Hero Section

### Logged-out (current)
- Eyebrow: "Contact management, done right"
- Headline: "Your contacts. Organised, synced, and always with you."
- Subtext: "One address book that stays current on every device, every app, and every person you share with."
- CTAs: **[Get started free]** and **[See how it works ↓]**

### Logged-in (new)
- Eyebrow: "Welcome back"
- Headline: "Pick up where you left off." *(or personalised: "Welcome back, Liaqat.")*
- Subtext: "Your contacts are waiting." *(short and confident — no need to sell the product)*
- CTAs: **[Open Kontax →]** (links to `/contacts`) — single CTA, no secondary button
- The app window mockup on the right stays unchanged

**Visual treatment:** The logged-in hero should feel calm and familiar, not promotional. Same layout, same illustration — just the copy and CTA swap.

---

## What Does Not Change

- The rest of the page (Features, Pricing, Testimonials, FAQ, footer) — marketing content stays visible to logged-in users. They may want to share the page or check pricing for a team upgrade.
- The page URL — no redirect. A logged-in user stays on `/` if that's where they are.
- The app window mockup illustration in the hero

---

## Implementation Notes (for engineering)

- The nav (`marketing-nav.tsx`) and hero section (`page.tsx`) are both in `src/app/(marketing)/`
- Session state is available via `auth()` from `~/server/auth` — this is a server component so a session check is cheap
- The nav is a client component (uses scroll state) — session must be passed as a prop from the server layout, or the logged-in badge can be a separate server component rendered inside the nav slot
- User initials can be derived from `session.user.name` — take the first letter of each word, cap at 2 characters

---

## Deliverables

- Desktop mockup: nav bar (both states, side by side)
- Desktop mockup: hero section (both states, side by side)
- Mobile mockup: hamburger menu (both states)
- Source in Figma
