# Design Brief: Login & Register Pages

**Routes:** `/login` · `/register`
**Phase:** P0 core surface
**Last updated:** 2026-06-10

> **Design status: LOCKED.** Final mock approved — light design system, single centred card, all decisions below are resolved. The current build (dark navy theme) needs replacing; the locked spec below is what gets built.

---

## Purpose

The login and register pages are the gateway to Kontax. They handle two actions: authenticating an existing user and creating a new account. Both routes share one visual template — a centred card on a light branded background — and feel like a natural extension of the in-app design system rather than a separate world.

No OAuth or SSO in v1. Credential-based only. No email verification on register in v1 — users land directly in the app after submitting.

---

## Layout

Single centred card. No two-column hero. No marketing copy on the auth pages — that lives on the public landing page (`/`).

```
┌──────────────────── light green background ────────────────────┐
│                                                                 │
│              ┌────────────────────────────┐                    │
│              │  [K]  Kontax               │  ← brand mark      │
│              │  ─────────────             │  ← rule            │
│              │  Log in to Kontax          │  ← heading         │
│              │  Pick up right where…      │  ← sub             │
│              │                            │                    │
│              │  [social slot — off by default]                 │
│              │                            │                    │
│              │  Your name (register only) │                    │
│              │  Email address             │                    │
│              │  Password         [show]   │                    │
│              │  [strength meter]  (reg)   │                    │
│              │            Forgot password?│  ← login only      │
│              │  [     Log in / Create   ] │  ← CTA             │
│              │  Terms line (register)     │                    │
│              │                            │                    │
│              │  Don't have an account?    │  ← switch          │
│              └────────────────────────────┘                    │
│                  © Kontax · …                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Card:** `max-width: 440px`, `width: 100%`, `padding: 40px`, `background: #ffffff`, `border-radius: 24px`, `border: 1px solid rgba(216,221,214,0.7)`, `box-shadow: 0 18px 50px rgba(29,40,35,0.12), 0 2px 8px rgba(29,40,35,0.06)`.

**Vertical centering:** flexbox `align-items: center; justify-content: center; min-height: 100dvh`. On viewports shorter than 600px, switch to `justify-content: flex-start; padding-top: 32px` to allow scrolling.

---

## Background

- **Base colour:** `#eef1ec` — light green-tinted neutral.
- **Radial gradients (layered):**
  - `radial-gradient(ellipse 70% 55% at 50% 36%, rgba(23,53,46,0.10) 0%, rgba(23,53,46,0) 70%)` — warm green glow behind the card.
  - `radial-gradient(ellipse 90% 70% at 50% 110%, rgba(23,53,46,0.07) 0%, rgba(23,53,46,0) 60%)` — subtle footer warmth.
- **Grain texture overlay:** SVG fractalNoise at 0.05 opacity, stitched, `opacity: 0.4` — adds tactility without distraction.
- Background is `position: fixed; inset: 0` — no scroll on the bg itself.

---

## Brand Mark

Centred at the top of the card.

```
[K]  Kontax
```

- **"K" tile:** `34×34px`, `border-radius: 10px`, `background: #17352e`, `color: #dff0e7`, `font-size: 19px`, `font-weight: 700`.
- **Wordmark:** `font-size: 25px`, `font-weight: 600`, `letter-spacing: -0.018em`, `color: #17352e`.
- **Gap between tile and word:** `10px`.

Below the brand mark: a `56px`-wide, `1px` hairline rule (`background: #d8ddd6`), `margin: 20px auto 22px`.

---

## Headings & Sub-text

- **Heading:** `font-size: 22px`, `font-weight: 600`, `letter-spacing: -0.015em`, `color: #1d2823`, centred.
  - Login: *"Log in to Kontax"*
  - Register: *"Create your account"*
- **Sub-text:** `font-size: 14px`, `color: #5c655e`, centred, `margin-top: 7px`.
  - Login: *"Pick up right where you left off."*
  - Register: *"Your contacts, organized and yours."*

---

## Form Fields

Fields are stacked vertically with `gap: 16px`.

### Field anatomy

```
Label text
┌────────────────────────────────────────────┐
│ Placeholder text                           │
└────────────────────────────────────────────┘
Error message (if applicable)
```

- **Label:** `font-size: 13px`, `font-weight: 500`, `color: #3f4842`, `margin-bottom: 7px`.
- **Input:** `width: 100%`, `height: 44px`, `border-radius: 12px`, `border: 1px solid #d8ddd6`, `background: #fff`, `padding: 0 16px`, `font-size: 14px`, `color: #1d2823`. Placeholder: `#aab1a9`.
- **Focus:** `border-color: #4158f4`, `box-shadow: 0 0 0 3px rgba(65,88,244,0.28)`.
- **Error state:** `border-color: #b5472f`, focus ring: `0 0 0 3px rgba(181,71,47,0.22)`.
- **Error message:** `font-size: 12.5px`, `color: #8f3320`, `margin-top: 7px`, `role="alert"`, linked via `aria-describedby`.

### Name field (register only — required)

- Label: *"Your name"* — no "(optional)", this field is **required**.
- Placeholder: *"e.g. Alex Chen"*. `autocomplete="name"`.
- Validation error: *"Please enter your name."* — shown below the field.
- Appears above the email field.

### Email field

- Label: *"Email address"*. `type="email"`, `autocomplete="email"`.
- Placeholder: *"you@example.com"*.
- Register error (email taken): *"An account with this email already exists. [Log in instead →]"* — the link navigates to `/login` with email pre-filled.

### Password field

- Label: *"Password"*. `autocomplete="current-password"` (login) / `"new-password"` (register).
- Placeholder: *"Enter your password"* (login) / *"At least 8 characters"* (register).
- Show/hide toggle: eye icon button, `38×38px`, `border-radius: 9px`, right edge of input. `color: #8b938c` at rest, hover fills `#f2f4f0`. Accessible: `aria-label="Show password"` / `"Hide password"`.

### Password strength meter (register only)

Appears below the password field once typing starts:

- Three equal-width bar segments, `height: 4px`, `border-radius: 2px`, `gap: 5px`.
- Colours by level:
  - **Weak** (length < 8 or score ≤ 1): active segments `#b5472f` (red).
  - **Fair** (length ≥ 8, score 2): active segments `#bf8526` (amber).
  - **Strong** (length ≥ 8, score 3): active segments `#2f8f63` (green).
  - Inactive segment: `#e7eae4`.
- Score = points for: length ≥ 8 (+1), contains digit (+1), contains symbol (+1).
- Label beside bars: `font-size: 12px`, `font-weight: 600`, coloured to match level.
- `aria-live="polite"` — screen reader announces changes.

### Forgot password (login only — always visible)

Right-aligned below the password field, `margin-top: -4px`:

```
                              Forgot password?
```

- `font-size: 13px`, `font-weight: 500`, `color: #5c655e`. Hover → `color: #4158f4`.
- Points to the password-reset flow (Phase 11). Space is always reserved — no layout shift when the reset route ships.

---

## CTA Button

- `width: 100%`, `height: 48px`, `border-radius: 12px`.
- **Background:** `#4158f4`. Hover: `#3347d8`. Active: `#2a3abf`, `transform: translateY(1px)`.
- **Text:** white, `font-size: 14.5px`, `font-weight: 600`.
- **Disabled:** `opacity: 0.5`, `cursor: not-allowed`. Disabled when: required fields empty, or submitting.
- **Loading state:** white spinner (18px rotating arc, `animation: spin 0.7s linear infinite`). Text hidden during spin. `aria-busy="true"`.
- **Focus:** `outline: 2px solid #4158f4`, `outline-offset: 2px`.
- `margin-top: 8px` from last field.

---

## Terms Line (register only)

Sits directly below the CTA button:

> "By creating an account, you agree to our [Terms] and [Privacy Policy]."

- `font-size: 12px`, `color: #8b938c`, centred, `margin-top: 10px`.
- Links: `color: #4158f4`, hover `text-decoration: underline`. Point to `/terms` and `/privacy`.

---

## Error Alert Box

Shown below the form (below the CTA + terms on register, below the CTA on login) when a form-level error occurs:

```
┌─────────────────────────────────────────────────────┐
│  ⚠  Incorrect email or password. Please try again.  │
└─────────────────────────────────────────────────────┘
```

- `background: #f7e9e4`, `border: 1px solid #ecd0c7`, `border-radius: 11px`, `padding: 11px 14px`.
- Text: `font-size: 13.5px`, `color: #8f3320`, `line-height: 1.4`.
- Warning icon: `color: #b5472f`, `flex-shrink: 0`, `margin-top: 1px`.
- `role="alert"`, `tabIndex={-1}` — focus is moved here on appearance so screen readers announce immediately.
- `margin-top: 16px`.

### Login errors
- **Wrong credentials:** *"Incorrect email or password. Please try again."* — never reveal which credential was wrong.
- **Too many attempts (future):** *"Too many attempts. Please wait a few minutes before trying again."*

### Register errors
- **Email taken:** field-level, below email input (see Email field above).
- **Name empty:** field-level, below name input: *"Please enter your name."*
- **Weak password:** field-level, below password: *"Password must be at least 8 characters."*
- **Server error:** form-level alert: *"Something went wrong. Please try again."*

---

## Mode Switch

Below the card form, centred, `font-size: 14px`, `color: #5c655e`:

- Login → *"Don't have an account? [Create one →]"*
- Register → *"Already have an account? [Log in →]"*

Links: `color: #4158f4`, `font-weight: 500`, hover `text-decoration: underline`. Disabled during submission.

---

## Success State

When submission succeeds, the card body is replaced (no page navigation — content swaps in place):

```
      ┌──────────────────────┐
      │  [✓ green circle]    │
      │  Welcome back        │  ← or "You're all set"
      │  Taking you to your  │
      │  contacts…           │
      └──────────────────────┘
```

- **Check circle:** `56×56px`, `border-radius: 50%`, `background: #e7efe9`, checkmark `stroke: #17352e`, `stroke-width: 2.4`.
- **Heading:** 22px semibold (same as form heading).
- **Sub:** 14px secondary.
  - Login: *"Taking you to your contacts…"*
  - Register: *"Your Kontax account is ready."*
- A *"← Back to the form"* text link is included (for prototype navigation only — in production the redirect is immediate).

---

## Social Sign-in Slot (reserved — off by default)

When social login ships (Phase 11+), two buttons appear above the email field separated from the credential fields by an "or" divider:

```
  [ G  Continue with Google  ]
  [    Continue with Apple   ]
          ─── or ───
  [email field]
```

- **Social buttons:** `width: 100%`, `height: 44px`, `border-radius: 12px`, `border: 1px solid #d8ddd6`, `background: #fff`, `font-size: 14px`, `font-weight: 500`, `color: #1d2823`. Hover: `background: #f2f4f0`. `gap: 10px` between buttons.
- **"or" divider:** horizontal `#e9ece7` lines with *"or"* centred in a white pill, `font-size: 12px`, `color: #8b938c`.
- The card accommodates ~120px of additional height via the flexbox centred layout — no layout rework needed.
- **This slot is designed and specced now so no retrofit is required when social auth ships.** The prototype preview toggle ("Reserve social sign-in") shows the full layout.

---

## Page Footer

Below the card, `font-size: 12px`, `color: #8b938c`, centred:

> *"© Kontax · Your contacts, organized and yours."*

---

## Mobile (< 480px)

- Card padding reduces to `30px 24px`. Border-radius reduces to `18px`. Shadow softens.
- On screens < 390px, radius reduces further to `16px`.
- Viewport padding: `24px 16px`.
- All touch targets ≥ 44×44px (show/hide toggle, CTA, switch link).
- When the keyboard opens, `scrollIntoView({ behavior: 'smooth', block: 'center' })` on field focus keeps the active field and CTA visible.

---

## Accessibility

- All inputs have explicit `<label>` elements (not just placeholder text).
- Error messages linked via `aria-describedby`.
- Form-level error box uses `role="alert"` + `tabIndex={-1}`, receives focus on appearance.
- `aria-busy="true"` on CTA and `<form>` during submission.
- `aria-live="polite"` on strength meter.
- Colour contrast: all text on the white card meets WCAG AA.
- Keyboard navigation: Tab order is name → email → password → show/hide → forgot → CTA → switch.

---

## Intentional design decisions (for the brief record)

- **No confirm-password field.** The live strength meter + show/hide toggle together replace it. This is deliberate — not an oversight.
- **Name is required on register.** Used to personalise the workspace immediately. Can be changed in Settings after signup.
- **CTA is always blue (`#4158f4`).** The brand green is reserved for the Kontax identity (logo, headings). A green CTA would look like a ghost/secondary button and weaken the hierarchy.
- **Forgot password is always present.** Even before the reset route ships, the link renders (points to `#` as a placeholder). The space is never "reserved for later" — it's always there.

---

## Future Additions

### Password Reset (Phase 11)
The "Forgot password?" link connects to a reset flow. Same card shell — content replaces the form. Sequence: email input → "Check your inbox" state → new-password form.

### Email Verification (Phase 11+)
After register, if verification is required, the card transitions to a "Check your email" state in place:
- Envelope icon, large, centred.
- *"We sent a link to [email]."*
- Resend link.

### Two-Factor Authentication (Phase 14+)
A second step after login credential entry. Same card, form content replaced by a 6-digit OTP input. The card structure (brand mark → heading → content → CTA) accommodates any step without change.
