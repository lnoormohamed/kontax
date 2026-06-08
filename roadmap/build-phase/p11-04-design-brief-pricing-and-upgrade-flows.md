# P11-04 Design Brief: Pricing Page and Upgrade Flows

## Purpose
This ticket produces a complete design brief that gives the designer everything they need to design the pricing page, upgrade prompt surfaces, plan comparison modal, family invite overview screen, and downgrade warning flow. The brief defines content hierarchy, interaction states, and tone for each surface. It does not contain final pricing numbers — those are commercial decisions made outside of this ticket.

## Background
Kontax currently has no pricing page. Users on the Free plan encounter plan-gated features as opaque errors ("vCard export is available on Plus and Pro plans") with no clear path to upgrade. The settings page shows plan and usage information but has no link to a pricing comparison or upgrade flow.

Phase 11 introduces four tiers. Before the upgrade flows can be built (likely Phase 12 or a billing sub-phase), the designer must produce mockups that engineering can implement. This brief is the handoff document from engineering and product to design.

The brief covers five surfaces:
1. Pricing page (full comparison, standalone route).
2. Inline upgrade prompt (contextual, shown when a user hits a gate).
3. Plan comparison modal (two-tier focused, triggered from upgrade prompts).
4. Family invite overview (entry point overview, detail deferred to Phase 13).
5. Downgrade warning (pre-confirmation screen when a user downgrades).

This document also contains tone guidance that applies across all surfaces.

## Scope
### In scope
- Content, hierarchy, interaction states, and copy direction for each of the five surfaces.
- Feature row groupings for the pricing table.
- Recommended plan highlight logic.
- Monthly/annual billing toggle behavior.
- Upgrade prompt trigger conditions and copy direction.
- Plan comparison modal content and trigger conditions.
- Family invite overview screen flow.
- Downgrade warning content (feature/data impact list).
- Tone and voice guidance.

### Out of scope
- Final pricing numbers — all monetary values remain as `[PRICE]` placeholder.
- Engineering implementation of the upgrade flow (Stripe Checkout, customer portal, webhook handling).
- Family and Teams group management UI — detail is Phase 13 and 14.
- Payment method management UI.
- Invoice and billing history UI.

---

## Design / Implementation Spec

### Tone and Voice Guidance

Kontax's pricing communication must feel like a tool talking to a person who values their data and their time, not a SaaS marketing funnel.

**Principles:**
- **Transparent, not pushy.** Every upgrade prompt tells the user exactly what they get and what they give up. We do not obscure the Free tier's capabilities to make it feel inadequate.
- **Honest about limits.** If a user hits a limit, the prompt says plainly why and what changes on each plan. No vague "unlock more features" language.
- **Family and Teams solve coordination problems.** Family and Teams are not positioned as "more of the same." They solve specific coordination problems: a household that wants a shared address book, or a team that needs one organised contact library. The copy should name those problems directly.
- **Data portability is a right.** Every pricing surface where cancellation or downgrade is mentioned must reassure the user that their contacts are always exportable, even on a canceled account.

**Voice:**
- Calm, direct, informative. Short sentences.
- No exclamation marks in plan feature lists.
- No "unlimited power" or superlative marketing language.
- Feature labels match in-app labels exactly (e.g., "CardDAV sync accounts" not "sync connections").

---

### Surface 1: Pricing Page

**Route:** `/pricing`

**Purpose:** Stand-alone page a user reaches from the settings plan section, an in-app upgrade prompt, or the marketing site. Must work for logged-out visitors (marketing context) and logged-in users (upgrade context). When logged in, the user's current plan is highlighted differently from the recommended plan.

#### Layout: Four-Column Comparison

Desktop layout: four columns, one per plan (Free, Pro, Family, Teams). Mobile layout: single column, plans selectable via a tab strip or scroll-snapping carousel.

Column order from left to right: Free, Pro (recommended), Family, Teams. Pro is the anchor — it is the most likely upgrade target for individual users.

**Column header contents:**
- Plan name (bold, large)
- One-line positioning statement (see copy direction below)
- Monthly price (prominent, e.g., `[PRICE]/month`) with annual equivalent below if annual billing selected
- CTA button (see CTA states below)
- Free trial or money-back mention if applicable (placeholder text for now)

**Positioning statements:**
- Free: "For individuals getting started."
- Pro: "For people who take their contacts seriously."
- Family: "One shared address book for your whole household."
- Teams: "One organised contact library for your team."

**CTA button states:**
- Current plan (logged in): "Current plan" — disabled/inert, different visual treatment (outline vs filled).
- Upgrade available: "Upgrade to [Plan]" — primary CTA.
- Downgrade path: "Switch to [Plan]" — secondary style with a note "see what changes".
- Logged out: "Get started" for Free, "Start free trial" for Pro/Family/Teams (placeholder — final copy TBD).

#### Feature Rows

Rows are grouped into categories. Each row has a label and four cells (one per plan), each showing either a checkmark, a cross, or a specific value.

**Category: Contacts**
- Contact library limit
- Per-contact history

**Category: Import and Export**
- Monthly import jobs
- Export formats

**Category: Sync**
- CardDAV sync accounts
- Device app passwords

**Category: Merge**
- Duplicate detection
- Advanced merge (field-level selection, bulk accept)
- 30-day merge undo

**Category: Sharing**
- vCard share link (download link, no account required)
- Static contact sharing (Kontax-to-Kontax)
- Live contact sharing

**Category: Activity Log**
- Global activity feed
- Activity log retention

**Category: Collaboration (Family and Teams only rows)**
- Shared address books
- Group members
- Member roles and permissions
- Live sync within group
- Audit log retention

**Category: Support**
- Support level

**Row value display guidance:**
- Checkmark (green): feature is fully available at this tier.
- Cross (muted gray): feature is not available at this tier. Do not use a red X — it feels punitive. A muted gray dash or circle-minus is preferred.
- Specific value: e.g., "500 contacts", "3 per month", "5 accounts", "90 days".
- "Unlimited" for null/no-ceiling values — written in full, not as an infinity symbol.
- Family/Teams-only rows: show the value for those columns, show "—" for Free and Pro with a tooltip that says "This is a group plan feature."

#### Monthly / Annual Toggle

A toggle switch at the top of the pricing table switches between monthly and annual pricing. When annual is selected:
- Per-column price reflects the annual rate displayed as a monthly equivalent (e.g., "[PRICE]/month, billed annually").
- An "X months free" or "[Y]% saving" badge appears near the annual toggle. Content is a placeholder.
- The toggle state is preserved in the URL (`?billing=annual` or `?billing=monthly`) so the page is shareable.

#### Recommended Plan Highlight

The Pro column has a "Most popular" or "Recommended" badge. It has a slightly elevated visual treatment (e.g., subtle shadow lift, primary border color) to draw the eye without visually dominating the page.

When the user is logged in and their current plan is identified:
- If on Free: Pro column is highlighted as recommended.
- If on Pro: no recommendation badge (they are already there).
- If on Family or Teams: no recommendation badge.

The recommendation logic should not hard-code "Pro is always recommended" — it should be data-driven from the user's current plan. For Phase 11, the simple logic above is sufficient.

#### Empty States and Edge Cases
- Logged-in user whose subscription is CANCELED: show a banner at the top of the pricing page: "Your account is currently canceled and read-only. Reactivate any plan to resume editing your contacts."
- Logged-in user in GRACE state: show a banner: "Your billing needs attention. Update your payment method to avoid losing write access."
- Logged-in user in TRIALING state: show a banner noting when the trial ends.

---

### Surface 2: Inline Upgrade Prompt

**Purpose:** Shown in-context when a user performs an action that is gated on their current plan. The goal is to explain the limit clearly and show the path forward without redirecting the user away from what they were doing.

**Trigger conditions and copy direction:**

| Gate hit | Prompt headline | Prompt body |
|---|---|---|
| Contact limit (Free, 500) | "You've reached your contact limit" | "The Free plan stores up to 500 contacts. Pro, Family, and Teams plans have no limit." |
| Import limit (Free, 3/month) | "You've used your 3 imports for this month" | "Imports reset at the start of each calendar month. Pro and above have no monthly limit." |
| vCard export | "vCard export is a paid feature" | "Export to vCard format on Pro, Family, or Teams. CSV export is always available on any plan." |
| CardDAV sync | "CardDAV sync is a paid feature" | "Connect your contacts to external apps and devices on Pro, Family, or Teams." |
| Sync account limit (Pro, 5) | "You've reached your sync account limit" | "Pro and Family plans support 5 sync accounts. Teams plans support more." |
| Advanced merge | "Advanced merge is a paid feature" | "Field-level selection, bulk accept, and merge undo are available on Pro, Family, and Teams." |
| Activity log feed | "Activity log is a paid feature" | "View the full history of changes to your contacts on Pro, Family, and Teams." |
| Live sharing | "Live sharing requires a paid plan" | "Both you and the person you're sharing with must be on Pro, Family, or Teams for live updates." |
| Static sharing | "Contact sharing is a paid feature" | "Share contacts directly with other Kontax users on Pro, Family, and Teams." |

**Prompt visual design direction:**
- Compact inline banner or tooltip, not a full-page modal.
- Two actions: "See plans" (opens the plan comparison modal or links to `/pricing`) and "Dismiss".
- On dismissal, the prompt does not reappear for that user-session for the same gate. It does reappear in future sessions.
- The prompt should not block the user from reading the page — only from the specific action. If the gate was hit from a button click, the button visually reverts to its idle state.

---

### Surface 3: Plan Comparison Modal

**Purpose:** A focused two-plan comparison that gives a user enough information to decide without navigating to the full pricing page. Triggered from inline upgrade prompts.

**Trigger logic:** The modal shows the user's current plan (left column) and the cheapest plan that unlocks the feature they tried to use (right column). Examples:
- Free user trying to export vCard → shows Free vs Pro.
- Free user trying to create a shared address book → shows Free vs Family.
- Pro user trying to expand member slots → shows Pro vs Teams.

If the cheapest unlocking plan is the same as the user's current plan, the modal is not shown (this should not occur if upgrade prompts are triggered correctly).

**Modal contents:**
- Two-column comparison showing only the rows relevant to the feature the user tried to use, plus the five most differentiating features between the two plans.
- Header: "[Current plan] vs [Target plan]"
- Sub-header: "To [description of action], you need [Target plan]."
- CTA: "Upgrade to [Target plan]" — primary.
- Secondary link: "See full comparison" — links to `/pricing`.
- Dismiss: "Maybe later" — closes modal, no upgrade initiated.

**Modal is not a pricing page.** It does not show all feature rows. It shows 5–8 rows maximum. The designer should choose the rows that are most likely to tip the decision for each pair.

---

### Surface 4: Family Invite Overview

**Purpose:** An overview screen that introduces the Family plan's shared address book concept and leads the family owner through starting the group. Detailed group management UI is Phase 13 — this screen is the entry point summary only.

**When is this shown:** After a user upgrades to the Family plan (during the post-upgrade onboarding flow) or when a Family subscriber navigates to a "Manage Family" link in settings (which shows a "coming soon" state until Phase 13 ships).

**Screen contents:**
- Heading: "Your family address book"
- Body (2–3 sentences): Explain what the family address book is and what it is not. "The family address book is a shared contact list that all your family members can view and edit. Each person also keeps their own private library. Changes to shared contacts update for everyone in real time."
- Visual: placeholder illustration of two people's libraries merging into one shared book (no final art needed for the brief — annotate with "illustration: family shared book concept").
- Invite section: "Invite family members" — an email input and "Send invite" button. Status list showing pending and accepted members with their slot count ("3 of 6 slots used"). For Phase 11, this section shows a "coming soon" state if Phase 13 has not shipped.
- Footer note: "Family members join your plan at no extra cost. If the Family subscription ends, each member returns to the Free plan."

---

### Surface 5: Downgrade Warning

**Purpose:** Shown when a user initiates a downgrade (e.g., from Pro to Free, from Family to Pro, from Teams to Pro). The goal is to make the impact of the downgrade transparent so the user makes an informed decision — not to scare them into staying.

**Trigger:** When the user clicks "Switch to [lower plan]" from the settings plan section or the pricing page.

**Screen structure:**
- Heading: "Before you switch to [Target plan]"
- Sub-heading: "Here's what will change when your current billing period ends:"

**Impact list for Pro to Free:**
- "Sync accounts over 1 will be paused. You can reactivate them if you upgrade again."
- "App passwords over 1 will be revoked. Devices using those passwords will lose sync access."
- "Live contact shares you've sent will be converted to static snapshots."
- "Your activity log will stop recording new events. Existing events will be removed on the next nightly cleanup."
- "Advanced merge features (field-level selection, bulk accept, undo) will no longer be available."
- "vCard export will no longer be available. CSV export remains available on any plan."

**Impact list for Family to Pro (owner):**
- "Your family group will be dissolved when your current billing period ends."
- "Family members will return to the Free plan."
- "The shared family address book will be archived. You'll be able to export it before it becomes read-only."
- "Contacts that were only in the shared book will be moved to your personal library as archived contacts."

**Impact list for Teams to Pro:**
- "Your team will have 30 days to export shared address books before they are archived."
- "All team members will lose write access to shared books after the grace period."
- "Members without their own Kontax subscription will return to Free at the end of the grace period."
- "Audit log data will be retained for 90 days from the downgrade date, then pruned."

**Impact list — what is NOT affected (reassurance row):**
- "Your personal contacts are not affected."
- "Your contacts are always exportable, even after cancellation."

**CTA buttons:**
- Primary: "Confirm switch to [Target plan]" — initiates the downgrade with Stripe.
- Secondary: "Keep my [Current plan]" — dismisses the screen, no action taken.

**Visual design direction:**
- Impact items use a warning icon (amber) not a danger icon (red). These are changes, not catastrophes.
- The reassurance row ("what is NOT affected") uses a checkmark (green) to visually separate it from the change items.
- Do not use a modal for the downgrade warning — use a full-screen or near-full-screen step in the billing flow. The user should feel like they have space to read and decide.

---

### Feature Row Copy Reference for Pricing Table

The following copy is the canonical text for feature labels in the pricing table. Engineering must use the same labels in in-app gates and error messages for consistency.

| Category | Row label | Free | Pro | Family | Teams |
|---|---|---|---|---|---|
| Contacts | Contact library | 500 contacts | Unlimited | Unlimited per member | Unlimited per member |
| Contacts | Per-contact history | Last 10 events | Unlimited | Unlimited | Unlimited |
| Import | Monthly imports | 3 per month | Unlimited | Unlimited | Unlimited |
| Export | Export formats | vCard, CSV | All formats | All formats | All formats |
| Sync | CardDAV sync accounts | 1 account | 5 accounts | 5 per member | 5 per member |
| Sync | Device app passwords | 1 password | 5 passwords | 5 per member | 5 per member |
| Merge | Duplicate detection | — | — | — | — |
| Merge | Advanced merge | — | — | — | — |
| Merge | Merge undo (30 days) | — | — | — | — |
| Sharing | vCard share link | Expires in 7 days | No expiry, revocable | No expiry, revocable | No expiry, revocable |
| Sharing | Static contact sharing | — | — | — | — |
| Sharing | Live contact sharing | — | — | — | — |
| Activity | Activity feed | — | 90 days | 365 days | Unlimited |
| Collaboration | Shared address books | — | — | 1 shared book | Multiple books |
| Collaboration | Group members | — | — | Up to 6 | Up to 25 |
| Collaboration | Member roles | — | — | Owner and members | Admin and member roles per book |
| Collaboration | Audit log | — | — | 1-year retention | Unlimited retention |
| Support | Support | Community | Priority | Priority | Priority + account manager |

Note: "—" in the table means not available. The design should render this as a muted dash or empty cell, not a red X.

---

### Responsive Behavior

**Mobile (< 768px):**
- Pricing page shows one plan at a time in a card. The user swipes or taps to see other plans.
- A plan comparison strip at the bottom shows all four plan names as tabs. Active plan is highlighted.
- Feature rows collapse by category. Categories expand on tap. Default: first two categories expanded.
- Monthly/annual toggle moves to the top of the first card.

**Tablet (768px–1199px):**
- Two plans visible at once. Navigation arrows to scroll.
- Full feature rows visible (no category collapse).

**Desktop (≥ 1200px):**
- All four plans in a single horizontal comparison table as described above.

---

### Accessibility Requirements (for design brief)

- All plan comparison tables must be real HTML `<table>` elements (not CSS grids) for screen reader compatibility.
- Toggle switches (monthly/annual) must have visible labels and keyboard operability.
- Upgrade CTAs must have descriptive accessible names (e.g., `aria-label="Upgrade to Pro plan"` not just "Upgrade").
- Color alone must not be the only indicator for "available" vs "not available" — use checkmarks and dashes with appropriate contrast ratios.
- The downgrade warning must be reachable by keyboard and must trap focus when it is a modal or overlay.

---

## Acceptance Criteria
- The brief is reviewed and signed off by the designer before mockup work begins.
- The pricing page layout is specified: four columns, feature rows grouped by category, recommended highlight, monthly/annual toggle.
- All five surfaces have content, CTA states, and copy direction defined.
- Feature row labels in the brief match the copy used in in-app gate error messages (P11-03).
- Pricing numbers are explicitly marked as `[PRICE]` placeholder throughout — no actual numbers are in the brief.
- The Family invite overview screen includes a "coming soon" state for group management (Phase 13 placeholder).
- The downgrade warning impact lists are complete for all three downgrade paths: Pro-to-Free, Family-to-Pro, Teams-to-Pro.
- Tone guidance section is present and approved.
- Mobile, tablet, and desktop responsive behavior is specified.
- Accessibility requirements are listed.

## Risks and Open Questions
- Pricing numbers being absent from the brief means the designer will size columns based on placeholder text. The final numbers may affect layout (e.g., a 3-digit price vs a 2-digit price changes visual weight). The designer should design with the largest plausible value in mind and confirm when numbers are available.
- The "Teams expand beyond 25" feature is mentioned in P11-01 but the commercial process is not yet defined. The Teams column in the pricing table should note "Up to 25 members, contact us for larger teams" as placeholder copy. The designer should create a "contact sales" CTA state for the Teams column.
- The Family invite flow is marked "coming soon" for Phase 11. If Phase 13 slips, the Family upgrade CTA needs a graceful post-upgrade state that acknowledges the feature is coming. The brief should include a holding state screen for this scenario.
- The plan comparison modal logic (which two plans to show) requires the front-end to know which specific gate was triggered. The engineering gate error messages must include a machine-readable gate identifier (e.g., `gateId: "live_sharing"`) so the modal can select the correct pair of plans to compare. This is a coordination requirement with P11-03.

## Outcome
The designer has a complete, unambiguous brief covering all five upgrade and pricing surfaces, with content hierarchy, copy direction, tone guidance, and interaction states defined, ready for mockup work to begin.
