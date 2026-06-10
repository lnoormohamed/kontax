# 06 — Settings

**Route:** `/settings`
**Priority:** P1 — reached from the sidebar avatar/name link and from the header. Not a daily-use screen but critical for trust: it is where users verify their plan, manage data, and control app behaviour.

> **Freshness (2026-06-10) — ready to send (plans+billing batch).** The **"Plan and limits"** section was rebuilt in **P11-06** for the four tiers (Free/Pro/Family/Teams): current-plan name + per-tier feature summary, live **usage bars** (contacts / imports / sync accounts / device passwords, with "Unlimited" + amber/red thresholds), an **Upgrade / View plans** link to `/pricing`, and a **group-membership** block for Family/Teams with a "Manage group · coming soon" placeholder (groups arrive in Phases 13–14). Pairs with **brief 11 — Pricing & Upgrade Flows**; send the two together. Design language: the locked light system (ink `#1d2823`, green `#17352e`, blue `#4158f4`, hairline `#d8ddd6`, Geist) — align any remaining sub-sections that still read older/darker.

---

## Purpose

The Settings page is a lightweight account management centre. It surfaces the information a user needs to understand what they are on (plan), who they are (profile), how the app behaves (preferences), and what risks exist (danger zone). It deliberately avoids becoming a sprawling preferences panel — the current product has very few tuneable settings, and the layout should make that feel like calm simplicity rather than a half-finished page.

The page is single-column, centred at max-width 720px. There is no sidebar navigation. All sections are stacked cards. A user should be able to scan the entire page in under ten seconds and reach any action in two taps/clicks.

Future phases (9–14) will add device connections, family group management, team management, activity-log retention display, and billing portal access. Each of these has a reserved placeholder card on this page today, so the layout does not need to shift structurally when those features ship — the placeholder cards become real cards.

---

## Layout

### Overall structure

```
┌────────────────────────────────────────────────────────┐
│  HEADER (sticky, shared global header)                 │
├────────────────────────────────────────────────────────┤
│  ← Back to contacts                                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PROFILE CARD                                    │  │
│  │  Avatar · Name · Email · Plan badge              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PLAN CARD                                       │  │
│  │  Plan name · Lifecycle badge · Usage bars        │  │
│  │  Upgrade CTA (Free only)                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PREFERENCES CARD                                │  │
│  │  Toggle list                                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  QUICK LINKS CARD                                │  │
│  │  → Sync connections                              │  │
│  │  → Import / Export                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  CONNECTED DEVICES (placeholder, Phase 9)        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  FAMILY GROUP (placeholder, Phase 13)            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  TEAM (placeholder, Phase 14)                    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  DANGER ZONE CARD                                │  │
│  │  Sign out · Delete account                       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

The page body has a horizontal padding of 24px on each side on desktop. On screens ≥ 1280px the card column is centred with `max-width: 720px` and `margin: 0 auto`. On tablet (768–1279px) the same single column is used, full width up to 720px.

The cards use `rounded-[2rem] border border-[#d8ddd6] bg-white` consistent with the rest of the app. Card internal padding: 24px top/bottom, 28px left/right. Vertical gap between cards: 16px.

---

## Back link

At the very top of the page content area (below the sticky header), before the first card, sits a back link:

```
← Back to contacts
```

- Text: "Back to contacts"
- Chevron: `←` rendered with a small `ChevronLeft` icon (16px, slate-400)
- Colour: slate-500, 14px, regular weight
- Hover: slate-700, underline
- Padding-bottom: 20px before the first card
- On mobile: same position, same style

This is the only navigation element on the page. There is no sidebar, no tab strip.

---

## Key Components

### 1. Profile Card

```
┌─────────────────────────────────────────────────────┐
│  ┌────────┐                                         │
│  │  L N   │  Liaqat Noormohamed            [Edit]  │
│  │ 72×72  │  liaqat@example.com                    │
│  └────────┘  ● Pro                                  │
└─────────────────────────────────────────────────────┘
```

**Avatar initials circle**
- 72×72px circle, background: brand green (#17352e), text: white, font: 24px semibold
- Initials derived from display name (first + last). If single name, use first two characters.
- No photo upload in current scope (placeholder for future). Circle is not a button.

**Name**
- 18px semibold, tight tracking, color: slate-900
- Displays the stored display name
- Inline editing: clicking the name or the [Edit] pencil icon to the right turns the name into an input field in place. The input inherits the same font/size. Two buttons appear below it: Save (blue, `#4158f4`) and Cancel (text link). On Save, name updates immediately with an optimistic UI change; if the request fails, a subtle inline error appears and the name reverts.
- The [Edit] button is a small pencil icon (16px, slate-400). It is visually quiet at rest and highlights to slate-700 on hover. It does NOT appear as a labelled button — icon only, with a tooltip ("Edit name") on hover.

**Email**
- 14px regular, slate-500
- Not editable from this screen (email change is a more complex flow involving re-verification — reserved for future)

**Plan badge**
- Rendered as a small pill badge to the right of or below the email: "Free", "Pro", "Family", "Team"
- Background and text follow the lifecycle palette (see Plan Card section)
- Clicking the badge scrolls down to the Plan Card (smooth scroll, not a link)

---

### 2. Plan Card

```
┌─────────────────────────────────────────────────────┐
│  Plan                                               │
│                                                     │
│  Pro Plan                        ● Active           │
│                                                     │
│  Contacts                                           │
│  ████████████████░░░░  840 / 1,000                  │
│                                                     │
│  Imports this month                                 │
│  ████░░░░░░░░░░░░░░░░  2 / 10                       │
│                                                     │
│  [Manage billing →]                                 │
└─────────────────────────────────────────────────────┘
```

**Card header**
- Section label: "Plan" — 11px uppercase, tracking-widest, slate-400 — consistent with label style across the app.

**Plan name**
- 20px semibold, slate-900. E.g. "Free Plan", "Pro Plan", "Family Plan", "Team Plan".

**Lifecycle state badge**
- Displayed inline to the right of the plan name, or on a second line on narrow viewports.
- States and their colours:
  - `Active` — green background (#dcfce7), green text (#166534)
  - `Grace period` — amber background (#fef3c7), amber text (#92400e). Subtitle: "Your plan expired. Access continues for 7 more days."
  - `Locked` — red background (#fee2e2), red text (#991b1b). Subtitle: "Your account is locked. Renew to regain access."
  - `Trial` — blue background (#dbeafe), blue text (#1e40af). Subtitle: "X days remaining in your trial."
- The badge is a pill: 6px vertical padding, 10px horizontal padding, 12px text, medium weight.

**Usage bars**

Each usage bar row:
- Row label: 12px uppercase tracking-wider slate-400 (e.g. "Contacts", "Imports this month")
- Progress bar: full width of the card content area, 6px height, `rounded-full`. Track: slate-100. Fill: brand green (#17352e) normally. Amber (#f59e0b) when >80% used. Red (#ef4444) when at limit.
- Counts label: 13px regular slate-600, right-aligned. Format: "840 / 1,000". At limit: "1,000 / 1,000" in red.
- Vertical gap between bar rows: 12px.

**Upgrade CTA (Free plan only)**
- Appears below the usage bars.
- Button: full width, `#4158f4` background, white text, 15px semibold, rounded-xl, 44px height.
- Label: "Upgrade to Pro"
- Subtext above button (12px slate-500): "Get unlimited contacts, more imports, and priority sync."
- On Pro/Family/Team: the button is replaced by a quieter text link: "Manage billing →" (slate-500, 14px). Clicking opens the billing portal in a new tab.
- On Grace/Locked: the button changes to "Renew plan" with amber or red left border accent.

**Billing portal link (Phase 11)**
- Phase 11 adds a Stripe billing portal. The "Manage billing →" link is already present in the design as a placeholder. It becomes functional when billing is wired up.

---

### 3. Preferences Card

```
┌─────────────────────────────────────────────────────┐
│  Preferences                                        │
│                                                     │
│  Phonetic name auto-fill             ┌──┐           │
│  Automatically fill Pinyin readings  │ ●│           │
│  and name readings for new contacts. └──┘           │
│                                                     │
│  [future toggles appear here]                       │
└─────────────────────────────────────────────────────┘
```

**Card header:** "Preferences" — same uppercase label style.

**Toggle list**
Each toggle row:
- Left side: label (14px semibold, slate-800) on line 1, description (13px regular, slate-500) on line 2.
- Right side: iOS-style toggle switch. Width: 44px, height: 24px. Active state: green (#17352e) track, white thumb. Inactive: slate-200 track, white thumb. Focus ring: 2px offset, brand green.
- Row has 16px top/bottom padding. Rows are separated by a 1px slate-100 divider.
- Hover background on the row: slate-50 (subtle, full-row highlight).
- The toggle is the only interactive element in the row. Clicking anywhere in the row activates/deactivates the toggle (not just the toggle element itself).

**Current toggles:**
1. "Phonetic name auto-fill" — description: "Automatically suggest Pinyin readings and phonetic name fields when adding contacts with CJK characters."

**Reserved toggle slots (future)**
- The card is designed to accommodate 3–6 toggles. When only one exists, the card looks intentionally minimal — add a `min-height` or simply let it be short. Do not pad with fake rows.
- Future toggles expected: dark mode override, notification preferences (when push is added), default sort order.

---

### 4. Quick Links Card

```
┌─────────────────────────────────────────────────────┐
│  Data                                               │
│                                                     │
│  Sync connections              ↗                   │
│  Manage CardDAV sync accounts                      │
│  ───────────────────────────────────────────────── │
│  Import & Export               ↗                   │
│  Import CSV files or export your contacts          │
└─────────────────────────────────────────────────────┘
```

Two rows, each is a navigation link styled as a quiet list item:
- Row: full width, 48px min-height, 16px left/right padding.
- Left: label (14px semibold slate-800), description (13px regular slate-500).
- Right: `↗` arrow icon (16px, slate-400). On hover, the arrow turns slate-700 and the row background goes to slate-50.
- The rows are separated by a 1px slate-100 horizontal rule.
- The card uses the same rounded card chrome as the others.

---

### 5. Placeholder Cards (Phase 9, 13, 14)

These three cards appear between the Quick Links card and the Danger Zone card. They communicate future functionality without pretending it exists.

**Visual treatment:**
- Same card chrome (rounded-[2rem], border, white bg).
- Interior: a single row with a lock icon (18px, slate-300) on the left, label text (14px semibold, slate-400) in the middle, "Coming soon" pill badge (slate-100 bg, slate-400 text, 11px) on the right.
- No hover state. Cursor: default (not pointer).
- Optionally: a one-line description in slate-400, 13px, below the title.

**Cards:**

"Connected Devices & App Passwords"
- Description: "Connect your iPhone, Android, or desktop apps via CardDAV."
- Phase: 9

"Family Group"
- Description: "Share a contacts address book with family members."
- Phase: 13

"Team"
- Description: "Collaborate on contacts with your team."
- Phase: 14

**Phase 10/11 — Activity log retention**
- This does not get its own card. Instead, within the Plan Card, below the usage bars, add a quiet footnote:
  - 12px slate-400: "Activity log retained for 30 days on Free · 1 year on Pro"
  - This line is conditionally updated per plan tier when Phase 10 ships. The space for it is reserved in the Plan Card layout now.

---

### 6. Danger Zone Card

```
┌─────────────────────────────────────────────────────┐
│  Account                                            │
│                                                     │
│  [Sign out]                                         │
│                                                     │
│  Delete account                                     │
│  Permanently deletes your account and all data.    │
│  This cannot be undone.                [Delete →]  │
└─────────────────────────────────────────────────────┘
```

**Card header:** "Account" (not "Danger Zone" — no need to be dramatic in the label itself; the visual treatment of the delete action carries the weight).

**Sign out button**
- Full-width button, ghost style: white background, border `#d8ddd6`, 14px semibold, slate-700 text, 44px height, rounded-xl.
- Hover: border slate-400, background slate-50.
- Clicking signs the user out immediately (no confirmation dialog needed — it is reversible).

**Delete account row**
- Below the sign out button, separated by a 16px gap.
- Left text block: "Delete account" (14px semibold, slate-800), below it: "Permanently deletes your account and all contact data. This cannot be undone." (13px, slate-500).
- Right: a small "Delete →" text button (13px, red-600, no background). On hover: underline.
- Clicking "Delete →" opens a confirmation modal (not inline):
  - Modal title: "Delete your account?"
  - Body: "This will permanently delete your account, all contacts, and sync connections. This cannot be undone."
  - Input field: "Type DELETE to confirm" — the primary action button remains disabled until the field value equals "DELETE" (case-sensitive).
  - Two buttons: "Yes, delete my account" (red background, white text, #dc2626) and "Cancel" (ghost, slate-700).
  - The modal has a subtle red left border accent or a red warning icon at the top.
- This is the most destructive action in the app. The two-step confirmation (button → modal → type DELETE) is intentional.

---

## States

**Loading state**
- Each card renders a skeleton version while user data is fetching.
- Avatar circle: grey circle placeholder.
- Name/email: two skeleton bars (60% width, 40% width) of the appropriate heights.
- Usage bars: full-width grey placeholder bars.
- Toggle: grey pill placeholder.
- Skeletons use `animate-pulse` (Tailwind), color slate-100/slate-200.

**Error state**
- If profile data fails to load: an inline error banner below the back link. Text: "Couldn't load your settings. Try refreshing." with a Retry link.
- Individual card errors (e.g. plan data fails): show the card chrome with an inline message: "Unable to load plan details." in slate-500, 14px, centered vertically.

**Plan at limit (contacts)**
- Usage bar fill is red. Count label is red and bold.
- Below the bar: 13px amber-700 text: "You've reached your contact limit. Upgrade to add more contacts."
- The upgrade CTA button (if Free) gets an amber border and bolder label: "Upgrade now to continue adding contacts".

**Name edit — saving**
- While saving: input is disabled, spinner appears next to Save button.
- On success: input collapses back to display mode, a green check icon fades in/out briefly.
- On failure: input stays open, a red inline error message appears below it: "Couldn't save name. Try again."

**New user (just registered)**
- Plan card shows Trial badge if applicable.
- All cards still render. The placeholder cards are visible from day one.

---

## Mobile Layout (< 768px)

- No layout changes needed: the page is already single-column.
- Cards go full width (no horizontal margin beyond 16px safe area).
- Card internal padding reduces to 20px sides.
- Avatar size stays 72px.
- Usage bars remain full-width.
- Inline name editing: the input takes full width of the card; Save/Cancel buttons stack below it.
- The delete confirmation modal: uses a bottom sheet instead of a centred dialog. Full-width, slides up from the bottom. Same content, slightly larger tap targets (48px button height).
- Back link stays at top.
- Placeholder cards: same treatment, no changes needed.

---

## Future Additions

The following surfaces are planned in the roadmap and must be accommodated without structural redesign:

1. **Phase 9 — App Passwords / Device Connections:** The placeholder card becomes a real card with a list of connected devices and a "Generate app password" action. The card will need space for a list of 2–5 device rows, each with device name, last seen, and a revoke button. The current card chrome can accommodate this by simply gaining content.

2. **Phase 10/11 — Activity Log Retention:** A single line of explanatory text in the Plan Card (already reserved above). No new card needed.

3. **Phase 11 — Billing Portal:** The "Manage billing →" link in the Plan Card already exists as a placeholder. It becomes a functional link to the Stripe billing portal.

4. **Phase 13 — Family Group:** Placeholder card becomes a full card. It will need: group name, member count, member avatars (up to 5 shown), a "Manage group" link, and a "Leave group" danger action. The card expands in-place.

5. **Phase 14 — Team:** Similar to Family Group. Placeholder becomes a real card: team name, member count, role badge (Owner / Member / Admin), "Manage team" link.

6. **Future — Profile photo:** The avatar circle can accept a photo. Clicking the circle would open a file picker. Design now: add a subtle camera icon overlay on hover (opacity-0 at rest, opacity-60 on hover) so the affordance is structurally present without being prominent when photos don't exist.

7. **Future — Email change:** Below the email in the Profile Card, a small "Change email →" text link can appear. This leads to a separate confirmation flow. Reserve horizontal space for it now (it fits naturally below the email line).
