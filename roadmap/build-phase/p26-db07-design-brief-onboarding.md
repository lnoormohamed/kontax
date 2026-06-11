# P26-DB07 — Design Brief: Onboarding Flow, First-Run Empty States & Help System

## Purpose

This brief specifies the onboarding experience for new Kontax users: the first-run checklist shown after signup, contextual empty states that guide users toward their first meaningful actions, inline help tooltips, and the dedicated upgrade onboarding for Family and Teams. The goal is high activation — a user who completes their first meaningful action (add a contact, connect sync, invite a family member) within the first session is far more likely to return.

## Background

Kontax's value compounds with use: the more contacts a user has, and the more sync connections they set up, the more useful the app becomes. A new user who sees an empty contacts list with no guidance will churn immediately. Every empty state is an activation lever. The onboarding system converts blank screens into invitations.

The locked design language applies throughout: ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, surface `#f2f4f0`, brand green `#17352e`, CTA blue `#4158f4`, Geist.

---

## Scope

### In scope

1. First-run onboarding checklist (shown after signup/first login)
2. Per-surface empty states: contacts list, activity log, sync connections, shared contacts
3. Help tooltip component (`HelpTooltip`) style and behaviour
4. `/help` FAQ page structure and visual design
5. Family/Teams upgrade onboarding flow (triggered after Stripe checkout)

### Out of scope

- In-app walkthrough/tour overlays (deferred — checklist is the v1 approach)
- Welcome email (P20-04 handles verification; a separate welcome email is out of scope)

---

## Design / Implementation Spec

### 1. First-Run Onboarding Checklist

Shown in the contacts workspace after signup, as a persistent card above the contact list until all steps are complete or the user dismisses it.

```
┌──────────────────────────────────────────────────────────────┐
│  Welcome to Kontax 👋                    [×]                 │
│  Get started in a few steps                                  │
│                                                              │
│  ☑ Create your account           Done                        │
│  ○ Add your first contact         → Add contact              │
│  ○ Connect a sync account         → Connect device           │
│  ○ Explore your contacts          → Take a look              │
│                                                              │
│  ████████░░░░░░░░░░  Step 2 of 4                            │
└──────────────────────────────────────────────────────────────┘
```

**Card styling:** `background: #ffffff`, `border: 1px solid #d8ddd6`, `border-radius: 14px`, `padding: 20px 24px`, `margin-bottom: 16px`.

**Checklist item — complete:** tick circle `#1f8a5b`, label `#1d2823` 14px 600, "Done" badge `background: #e3efe7`, `color: #1c6b48`, `font-size: 11px`.

**Checklist item — active:** open circle `#d8ddd6`, label `#1d2823` 14px 500, CTA link `→ Action` in `color: #4158f4`, 14px 500. Arrow icon 14px.

**Progress bar:** `height: 6px`, `border-radius: 3px`, `background: #f2f4f0`. Fill: `background: #17352e`. Percentage width computed from completed steps. "Step N of 4" label right-aligned, `font-size: 12px`, `color: #8b938c`.

**Dismiss (×):** top-right, 32×32px. Clicking dismisses permanently (stored in `UserOnboardingState.dismissedAt`). Show a confirmation tooltip: "You can always find help at the bottom of the contacts page."

**Completion state:** when all 4 steps are complete, the card transitions to:
```
┌──────────────────────────────────────────────────────────────┐
│  ✓  You're all set!                                          │
│  Your contacts are ready. Here's what you can do next…      │
│  [Explore Pro features]   [Dismiss]                          │
└──────────────────────────────────────────────────────────────┘
```
Auto-dismisses after 5 seconds if no action taken.

---

### 2. Empty States

Each primary surface has a contextual empty state. All follow the same structure:
- Illustration: 48px icon in `#d8ddd6`, centred
- Headline: 18px 600 `#1d2823`
- Body: 14px `#5c655e`, max-width 320px centred
- Primary CTA: blue button
- Secondary: help link

**Contacts list (empty — no contacts):**
```
[person-plus icon, 48px, muted]
Your contacts will appear here
Import from Google or Apple, add one by one,
or connect a sync account to get started.

[Import contacts]   [Add manually]
Or [connect a sync account →]
```

**Activity log (empty):**
```
[activity icon]
No activity yet
Start by adding or importing contacts
— every change will be recorded here.

[Add your first contact →]
```

**Sync connections (empty — no connections):**
```
[refresh-cw icon]
Connect your first sync account
Kontax connects to your existing contacts services
via CardDAV, keeping everything in sync automatically.

[Connect an account →]
[Learn about CardDAV →]  ← links to /help#carddav
```

**Shared contacts (no incoming shares):**
```
[arrow-down-left icon]
Nothing shared with you yet
When someone shares a contact with you on Kontax,
it will appear here.

[Learn about sharing →]
```

---

### 3. HelpTooltip Component

A small `?` icon that shows a popover with explanatory text on hover/tap.

```
  Server URL  [?]   ← HelpTooltip trigger

  ┌────────────────────────────────────────┐
  │  Your CardDAV server URL looks like:   │
  │  https://contacts.icloud.com/          │
  │  Find it in your contacts app's        │
  │  account settings.                     │
  │  [Learn more →]                        │
  └────────────────────────────────────────┘
```

**Trigger:** `?` in a 18×18px circle, `border: 1px solid #d8ddd6`, `background: #f2f4f0`, `color: #8b938c`, `font-size: 11px`, `font-weight: 700`. Hover: `background: #e9ece7`, `color: #5c655e`.

**Popover:** `background: #1d2823`, `color: #ffffff`, `border-radius: 10px`, `padding: 12px 14px`, max-width 240px, `font-size: 13px`, `line-height: 1.5`. Arrow pointing to trigger (4px triangle). `[Learn more →]` link: `color: #dff0e7`, underline.

Appears on hover (desktop) and tap (mobile). Dismisses on outside click.

---

### 4. `/help` FAQ Page

A single-column content page. Route: `/help`. Accessible from the "?" icon in the app footer and from empty state help links.

```
┌──────────────────────────────────────────────────────────────┐
│  [K] Kontax                                         [Log in] │
├──────────────────────────────────────────────────────────────┤
│  Help & FAQ                                                  │
│                                                              │
│  [🔍 Search help…]                                           │
│                                                              │
│  CardDAV & Sync                                              │
│  ▸ What is CardDAV?                                          │
│  ▸ How do I connect iCloud?                                  │
│  ▸ How do I connect Nextcloud?                               │
│                                                              │
│  Import & Export                                             │
│  ▸ How do I import from Google Contacts?                     │
│  ▸ What CSV formats are supported?                           │
│                                                              │
│  Account & Security                                          │
│  ▸ How do I set up two-factor authentication?                │
│  ▸ What happens if I delete my account?                      │
│                                                              │
│  Plans & Billing                                             │
│  ▸ What's included in the free plan?                         │
│  ▸ How does Family sharing work?                             │
└──────────────────────────────────────────────────────────────┘
```

- Section headers: `font-size: 13px`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.06em`, `color: #8b938c`, `margin-bottom: 8px`.
- FAQ items: `font-size: 15px`, `color: #4158f4`, hover underline. Each is a `<details>` disclosure with the answer text in `color: #5c655e`, `font-size: 14px`, `line-height: 1.6`.
- Anchor IDs on each section (`#carddav`, `#import`, `#security`, `#billing`) for deep-linking from help tooltips and empty states.

---

### 5. Family/Teams Upgrade Onboarding

Triggered immediately after the Stripe webhook confirms a first Family or Teams subscription.

**Step 1 — Invite members:**
```
┌──────────────────────────────────────────────────────────────┐
│  🎉  Welcome to Kontax Family                                │
│  Let's get your family set up (Step 1 of 3)                  │
│                                                              │
│  Invite your family members                                  │
│  [email@example.com               ] [Send invite]            │
│  + Add another email                                         │
│                                                              │
│  [Continue →]   [Skip for now]                               │
└──────────────────────────────────────────────────────────────┘
```

**Step 2 — Set up shared address book (Family) / Create first book (Teams):**
```
┌──────────────────────────────────────────────────────────────┐
│  Set up your shared address book (Step 2 of 3)               │
│                                                              │
│  Shared book name: [Family Contacts           ]              │
│                                                              │
│  Who can edit?                                               │
│  ● Everyone (recommended)   ○ Admins only                    │
│                                                              │
│  [Continue →]   [Skip for now]                               │
└──────────────────────────────────────────────────────────────┘
```

**Step 3 — Done:**
```
┌──────────────────────────────────────────────────────────────┐
│  ✓  Your family group is ready!                              │
│  Invites sent · Shared book created · You're good to go.    │
│                                                              │
│  [Go to contacts →]                                          │
└──────────────────────────────────────────────────────────────┘
```

Progress indicator: "Step N of 3" above each step. Skip link available on steps 1 and 2. Progress stored in `UserOnboardingState`.

---

## Acceptance Criteria

- Designer can produce all onboarding screens without a follow-up meeting.
- The checklist card, all 4 empty state variants, and the HelpTooltip component are fully specified.
- The `/help` FAQ page section structure, anchor IDs, and disclosure pattern are specified.
- Both Family and Teams upgrade onboarding flows (3 steps each) are specified.
- Mobile variants: all components are single-column; checklist card collapses to 1-line items.
- Dismiss behaviour and completion states are specified for the checklist.
- `prefers-reduced-motion` consideration: progress bar fill animates; this should be a CSS transition that reduces motion when the media query matches.
