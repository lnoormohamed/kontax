# P30-DB11 — Design Brief: Public Contact Card Page & Visibility Settings

## Purpose

This brief specifies the design for the public contact card — every Kontax user's permanent public URL at `/u/{username}`. It covers the card page layout, the visibility controls in settings, the "Add to Kontax" flow, the username claim UI, and the card analytics summary. Each public card is an organic acquisition touchpoint: a stranger who receives someone's Kontax card URL sees a polished page and has a clear path to creating their own account.

## Background

The public contact card is Kontax's "digital business card" feature — an always-available shareable profile. Unlike the Phase 12 vCard share links (ephemeral, per-contact), the public card is permanent, user-controlled, and lives at a memorable URL. It is the product's primary virality mechanism.

The locked design language applies: ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, surface `#f2f4f0`, brand green `#17352e`, CTA blue `#4158f4`, Geist.

---

## Scope

### In scope

1. Public card page (`/u/{username}`) — layout, field display, avatar, "Add to Kontax" CTA
2. Visibility controls settings panel
3. Username claim UI (in settings and during onboarding)
4. Card analytics summary in settings
5. Share tools: copy link, QR code, email signature snippet

### Out of scope

- Public card OG image (P30-05 — separate ticket)
- Card analytics detailed breakdown (P30-06 — separate ticket with schema)

---

## Design / Implementation Spec

### 1. Public Card Page (`/u/{username}`)

**Layout:**

```
┌────────────────────────────────────────────┐
│  NAV (minimal — [K] Kontax + [Log in])     │
├────────────────────────────────────────────┤
│                                            │
│          [Avatar — 96px circle]            │
│                                            │
│          Jane Smith                        │  ← 28px 700
│          Product Manager at Acme Corp      │  ← 15px secondary
│                                            │
│  ─────────────────────────────────────     │  ← hairline divider
│                                            │
│  📧  jane@acme.com                [Copy]  │
│  📱  +1 415 555 0100              [Copy]  │
│  🌐  acme.com                     [Open]  │
│  💼  linkedin.com/in/janesmith    [Open]  │
│                                            │
│  ─────────────────────────────────────     │
│                                            │
│  [Add Jane to Kontax]                      │  ← blue button
│                                            │
│  ─────────────────────────────────────     │
│                                            │
│  Shared via Kontax · kontax.app            │  ← footer attribution
└────────────────────────────────────────────┘
```

**Card container:** white, `max-width: 440px`, centred, `padding: 48px 32px`, `border-radius: 20px`, `border: 1px solid #d8ddd6`, `box-shadow: 0 16px 48px rgba(29,40,35,0.08)`. Outer background: `#f4f6f2` (same as the feature cards section on the landing page).

**Avatar:** 96px circle. If a photo is set: the photo (cropped square to circle). If no photo: a coloured initial tile using the same name-hash tint system as the contact list.

**Name:** `font-size: 28px`, `font-weight: 700`, `letter-spacing: -0.015em`, `color: #1d2823`, centred.

**Subtitle:** job title + company on one line if both present; just job title or company if only one. `font-size: 15px`, `color: #5c655e`, centred.

**Field rows:**
- Icon: 16px Lucide icon, `color: #8b938c`
- Value: `font-size: 14px`, `color: #1d2823`
- Action: `[Copy]` or `[Open]` text button, `font-size: 13px`, `color: #4158f4`
- Row height: 48px, divider `1px solid #e9ece7` between rows

**"Add Jane to Kontax" CTA:**
- For non-logged-in users: full-width blue button, 48px, links to `/register?prefill={token}` or triggers vCard download
- For logged-in Kontax users: same button but "Save to Kontax" label, one-tap save
- The button is the page's primary conversion mechanism

**Footer attribution:** "Shared via Kontax · [kontax.app](https://kontax.app)" — `font-size: 12px`, `color: #8b938c`, centred, `margin-top: 24px`.

---

### 2. Visibility Controls (`/settings/profile/card`)

```
Public card
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your public card is live at kontax.app/u/janesmith
[Copy link]  [View card →]

Who can see your card?
● Anyone with the link (default)
○ No one (card is hidden)

Fields visible on your card
─────────────────────────────────────────────
☑ Name           (always shown, cannot hide)
☑ Photo          (always shown if uploaded)
☐ Email address
☑ Phone number
☐ Company
☑ Job title
☐ Website
☐ LinkedIn
☐ Twitter / X

[Save changes]
```

**Section styling:** same as other settings sections. Toggle rows: `height: 44px`. Always-on fields (name, photo) have a grey checkbox with tooltip "Always shown — cannot be hidden."

---

### 3. Username Claim (`/settings/profile`)

In the profile settings section, a "Public card URL" field:

```
Public card URL
kontax.app/u/ [janesmith              ] [Save]
               ↑ 3–30 chars, letters, numbers, hyphens
```

- Available: green check + "kontax.app/u/janesmith is available"
- Taken: red × + "This username is taken. Try janesmith2."
- Reserved: "This username is reserved."
- Input: real-time availability check (debounced 400ms)

During onboarding (P26-04), step 4 can include a "Claim your card URL" micro-step with the same input.

---

### 4. Card Analytics Summary (`/settings/profile/card`)

Below the visibility controls:

```
Your card's performance
────────────────────────────────
👁  247 views total
📅  38 views in the last 30 days
➕  12 "Add to Kontax" clicks
```

Three stat lines, `font-size: 14px`, `color: #5c655e`. Counts pulled from `User.publicCardViews` and `PublicCardView` table (P30-06).

---

### 5. Share Tools

In `/settings/profile/card`, after the card URL:

```
Share your card

[Copy link]         [QR code]       [Email signature]
```

**Copy link:** copies the full card URL.

**QR code:** same modal as P28-06 but for the card URL (not a vCard share link).

**Email signature:** opens a modal with an HTML snippet:

```html
<!-- Kontax contact card -->
<a href="https://kontax.app/u/janesmith"
   style="font-family: sans-serif; font-size: 13px; color: #1d2823;">
  Jane Smith · Product Manager
  <br>
  <span style="font-size: 11px; color: #8b938c;">kontax.app/u/janesmith</span>
</a>
```

Copy button copies the HTML. Instructions: "Paste this into your email client's signature settings."

---

## Acceptance Criteria

- Designer can produce the public card page, visibility settings, username claim, analytics summary, and share tools without a follow-up meeting.
- All field row variants (email with Copy, website with Open, phone with Copy) are specified.
- Both CTA variants (non-logged-in / logged-in Kontax user) are specified with their different labels.
- Visibility toggle states (always-on, checked, unchecked) are fully specified.
- Username availability states (available, taken, reserved) are specified with colour indicators.
- Mobile: card is full-width, no rounded container; field rows stack; CTA is full-width.
