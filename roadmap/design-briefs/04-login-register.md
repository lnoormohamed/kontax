# Design Brief: Login & Register Pages

**Routes:** `/login` · `/register`
**Phase:** P0 core surface
**Last updated:** 2026-06-08

---

## Purpose

The login and register pages are the gateway to Kontax. They handle two actions: authenticating an existing user and creating a new account. Both routes are structurally identical — a centred card on a branded background — and share the same visual DNA. The audience is a new or returning user, typically arriving from a bookmark, a link in an invitation email, or the public landing page. The design should feel like Kontax, not a generic SaaS auth page: the background should carry the brand atmosphere (dark, quiet, green-tinted) while the card itself is clean and focused. The one primary action per page principle applies strictly here: "Log in" or "Create account". Everything else is secondary.

No OAuth or SSO in v1. Credential-based only: email + password. No email verification step on register in v1 — users land directly in the app after submitting the form.

---

## Layout (Desktop ≥ 1280px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    BRANDED BACKGROUND                                       │
│               (dark, see Background section below)                         │
│                                                                             │
│                                                                             │
│          ┌───────────────────────────────────────────┐                     │
│          │                                           │                     │
│          │   [Kontax wordmark / logo]                │                     │
│          │                                           │                     │
│          │   Log in to Kontax       ← page heading   │                     │
│          │                                           │                     │
│          │   Email address                           │                     │
│          │   [                                    ]  │                     │
│          │                                           │                     │
│          │   Password                     [show]     │                     │
│          │   [                                    ]  │                     │
│          │                                           │                     │
│          │   [         Log in          ]  ← CTA      │                     │
│          │                                           │                     │
│          │   Don't have an account? Create one →     │                     │
│          │                                           │                     │
│          └───────────────────────────────────────────┘                     │
│                                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Card dimensions:** max-width 440px, width 100% (shrinks on smaller viewports). Padding: 40px. Background: `#ffffff`. Border-radius: `1.5rem` (24px). Box-shadow: `0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)` — enough to lift the card off the dark background without looking garish.

**Vertical centring:** the card is centred both horizontally and vertically in the viewport using flexbox on the `<body>` or a full-height wrapper. On very short viewports (<600px tall), the card is top-aligned with `padding-top: 32px` to allow scroll.

---

## Background

The background is the defining brand moment on these pages. It should feel like the app exists behind the card — not an abstract pattern.

**Treatment:**
- Full-viewport background. Base colour: `#0f1a17` (near-black, deep green-tinted).
- Radial gradient in the centre: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(23,53,46,0.7) 0%, transparent 100%)` — a subtle warm green glow behind the card.
- Optionally: a very faint noise/grain texture overlay (CSS `filter: url(#noise)` or a semi-transparent noise SVG) to add tactility. Opacity: 0.04.
- Background is static — no animation in v1.
- In the bottom portion of the background (below the card), a faint hint of the contacts list UI is visible — extremely blurred and low-opacity (opacity: 0.06), as if the product exists in the darkness. This is a CSS `backdrop` treatment or a pre-rendered blurred screenshot. It communicates "your data is in there" without being distracting.

The net effect: arriving at `/login` feels like approaching a lit room in a dark building. The card is the light source.

---

## Key Components

### Logo / Wordmark

- At the top of the card, centred.
- The Kontax wordmark in `#17352e` (brand dark green). If a logomark/icon exists, show icon + wordmark stacked or side by side.
- Font: matches the app's heading style — semibold, tight tracking.
- Size: wordmark approximately 28–32px, total logo block height ~40px.
- Below the logo: a light horizontal rule (`border-b border-slate-100`) at 50% width, centred, to visually separate the brand identity from the form.

### Page Heading

- "Log in to Kontax" / "Create your account"
- Font: 22px semibold, `text-slate-900`, tight letter-spacing.
- Margin below: 24px.

### Form Fields

Each field follows this structure:
```
Label text
┌────────────────────────────────────────────┐
│ Placeholder text                           │
└────────────────────────────────────────────┘
[Error message if applicable]
```

- Label: 13px, `font-medium`, `text-slate-700`, margin-bottom 6px.
- Input: `w-full`, `h-11` (44px), `rounded-xl`, `border border-[#d8ddd6]`, `bg-white`, `px-4`, `text-sm text-slate-900`. Focus ring: `ring-2 ring-[#4158f4]/30 border-[#4158f4]`.
- Error state: `border-red-400`, focus ring red. Error message below: `text-red-500 text-xs mt-1`.
- Spacing between fields: 16px.

**Name field (register only):** labelled "Your name (optional)". Appears above the email field. Placeholder: "e.g. Alex Chen". `type="text"`.

**Email field:** labelled "Email address". `type="email"`. Autocomplete: `email`. Placeholder: "you@example.com".

**Password field:** labelled "Password". `type="password"`. Autocomplete: `current-password` (login) / `new-password` (register).
- Show/hide toggle: a small eye icon button on the right edge of the input, inside the field. `text-slate-400`, hover `text-slate-600`. Clicking toggles between `type="password"` and `type="text"`. Accessible: `aria-label="Show password"` / `"Hide password"`.
- On register: a password strength indicator appears below the field once the user starts typing. A simple three-segment bar: grey/grey/grey = empty, red/grey/grey = weak, amber/amber/grey = fair, green/green/green = strong. A short label beside it: "Weak" / "Fair" / "Strong". Strength based on: length ≥ 8, includes numbers, includes symbols.
- Minimum password requirement: 8 characters. Error if shorter: "Password must be at least 8 characters".

### Primary CTA Button

- "Log in" / "Create account"
- Full width (`w-full`), `h-12` (48px), `rounded-xl`, `bg-[#4158f4] text-white font-semibold text-sm`.
- Hover: `bg-[#3347d8]` (slightly darker blue). Active: `bg-[#2a3abf]`.
- Disabled state: `opacity-50 cursor-not-allowed`. Disabled when: form is empty, or saving is in progress.
- Loading state: spinner icon (18px, white) centred, label hidden. The spinner is a simple CSS animation (rotating arc, no third-party library needed). Duration: as long as the request takes.
- Margin-top: 24px (from last field).

### Switch Link

Below the CTA, centred text in `text-sm text-slate-500`:
- Login page: "Don't have an account? [Create one →]" — the link part is `text-[#4158f4] font-medium hover:underline`. Navigates to `/register`.
- Register page: "Already have an account? [Log in →]" — same styling. Navigates to `/login`.

No other links on the page in v1. A future "Forgot password?" link will live between the password field and the CTA button — leave a natural vertical gap there so it can be inserted without shifting the layout.

---

## Error States

### Login Errors

**Wrong password or email not found:**
A red message below the CTA button (not below the individual fields): "Incorrect email or password. Please try again." — a single error covers both cases intentionally (do not reveal which credential was wrong, for security). The message box:
```
┌──────────────────────────────────────────────────────┐
│  ⚠  Incorrect email or password. Please try again.  │
└──────────────────────────────────────────────────────┘
```
Style: `bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm`. A small warning icon `⚠` at the start. Appears with a subtle fade-in.

**Account locked / Too many attempts (future-ready):**
Same style box but with the message: "Too many attempts. Please wait a few minutes before trying again."

### Register Errors

**Email already registered:**
Shown below the email field (field-level error): "An account with this email already exists. [Log in instead →]" — the link portion navigates to `/login` with the email pre-filled.

**Weak password:**
Shown below the password field: "Password must be at least 8 characters."

**Server error:**
Below the CTA: "Something went wrong. Please try again." with a "Retry" affordance — clicking the CTA re-submits.

---

## Loading State

When the form is submitted:
1. CTA transitions to spinner (no label change — spinner replaces text).
2. All form inputs are disabled (`pointer-events: none`, `opacity: 0.7`).
3. The switch link below is also disabled during submission.
4. If the request takes > 3 seconds, do not show additional messaging — the spinner is sufficient.
5. On success: redirect immediately. On failure: re-enable form, show error, button returns to idle state.

---

## Mobile Layout (< 768px)

The mobile experience is nearly identical, as the card is already small on desktop.

```
┌──────────────────────────────┐
│                              │ ← dark background fills screen
│   [Logo / wordmark]          │
│                              │
│   Log in to Kontax           │
│                              │
│   Email address              │
│   [                       ]  │
│                              │
│   Password         [show]    │
│   [                       ]  │
│                              │
│   [        Log in         ]  │
│                              │
│   Don't have an account?     │
│   Create one →               │
│                              │
└──────────────────────────────┘
```

- The card fills 90% of the screen width with `margin: 0 auto` and a small horizontal padding.
- Card border-radius reduces to 1rem on screens < 390px.
- The card is no longer floating — it merges visually with the background on very small screens. The card background (`#ffffff`) is distinct from the dark page background, but the card shadow can be reduced to `0 4px 20px rgba(0,0,0,0.12)`.
- Keyboard-aware scroll: when a field is focused and the keyboard appears, the viewport scrolls to keep the focused field and the CTA button visible. Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` on focus events for fields near the bottom of the form.
- The "show/hide password" toggle remains fully tappable at its 44×44px minimum touch target size.
- The background blurred-content hint is removed on mobile (performance concern, and it's hidden behind the keyboard anyway).

---

## Accessibility

- All inputs have associated `<label>` elements (not just `placeholder` text).
- Error messages are linked to their field via `aria-describedby`.
- The form error box (wrong password etc.) uses `role="alert"` so screen readers announce it immediately.
- CTA button uses `aria-busy="true"` during loading state.
- Focus management: after a form submission error, focus is moved to the error message (or the first erroneous field).
- Colour contrast: all text on the white card meets WCAG AA. The background can be any contrast level since no text lives on it.

---

## Future Additions

### Forgot Password (v1.1)

A "Forgot password?" text link will be inserted between the password field and the CTA button. Space for it is reserved as a `16px` gap between the password input and the CTA — no layout reflow needed to add it.

### OAuth / Social Login (Phase 11+)

When Google / Apple sign-in is added:
- Social login buttons appear above the email field, separated by an "or" divider.
- The "or" divider: a horizontal line with "or" centred in a `bg-white` pill, using `text-slate-400 text-xs`.
- The card height will grow by ~120px. The vertical centering uses `min-height: 100vh` + flexbox, so it accommodates the growth without a layout change.

### Email Verification (Phase 11+)

When email verification is required on register, after form submission the page transitions to a "Check your inbox" state within the same card:

```
[Envelope icon, large, centered]
Check your email
We sent a link to you@example.com.
[Resend email] link
```

The card does not navigate away — it transitions content in place (fade transition). This avoids confusion about whether the form submitted successfully.

### Two-Factor Authentication (Phase 14+)

A second-step screen will appear after successful login credential entry. Same card, content replaces the form with a 6-digit OTP input. Design the card as a general "step container" now: the logo + heading + content + CTA structure should accommodate any step without modification.
