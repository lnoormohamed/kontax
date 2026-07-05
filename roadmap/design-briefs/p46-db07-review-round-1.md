# P46-DB07 Settings IA Redesign — design review (round 1)

Reviewer: engineering · Date: 2026-07-05 · Deliverable: handoff #30,
`p46-db07/P46-DB07 Settings IA Redesign.html` (+ db07.css).

> **Verdict: very close — the strongest first-round deliverable of the series.
> All eight brief decisions are made, the mapping table is genuinely complete
> (13 subpages + anchor + 2 orphans verified, splits named), all 14 smells have
> dispositions, the relocations are ratified with sensible judgment calls, and
> the prototype hygiene issues from earlier rounds don't recur (tokens
> identical to canonical, no clipping, auto-stacked frames, DB06 chrome
> correctly used in the mocks). Four adjustments before build — one of them the
> only real blocker.**

## What passes (no action)
- Eight groups with the boundary rule ("Account is who you are, Security is
  how you sign in, Data & sync is how information moves") — ratifies the
  engineering relocation map exactly.
- Complete mapping table — nothing unmapped; the one thing *leaving* settings
  (Merge review) called out.
- Judgment calls all decided well: app passwords **SPLIT** (task page stays,
  revocation list mirrors to Security) — matches our lean; reminder lead-time
  **KEEP**; Books permission history → **pointer** to Teams audit.
- One depth rule + gated-row rule ("a row's destination never depends on plan
  state — only its content does") — crisply stated.
- One nav config with the "no desktopOnly/mobileOnly flags" invariant; both
  renders shown; completeness invariant explicit.
- 14/14 smell dispositions (13 resolved, smell 7 accepted with the
  channel-and-tuning reason). T1–T6 build sequence follows the DB06 pattern.

## Adjustments needed

### 1. Pin the URL scheme (the blocker — P1)
The doc mixes three URL stories and the build can't proceed on "vibes":
- Config routes are group-flat (`/settings/data`, `/settings/sharing`,
  `/settings/billing`) — but the depth diagram shows **nested**
  `/settings/sharing/family`, and the mapping table says "Account › Public
  card page" (nested under account?) while today's URL is
  `/settings/profile/card`.
- The 5a render labels "Sync connections → `/settings/data`" yet the Devices
  boundary card says **`/sync` owns live status**, and presets "fold into the
  import/export surface at `/import-export`" — i.e. those two stay
  workspace-level surfaces *linked from* the Data & sync index.
Add one **URL table (old → new, with redirects)** and state the rule: do
subpage URLs actually move (nested under their group) or do only the nav
groupings change (URLs stay flat)? And pin explicitly that `/sync` and
`/import-export` remain where they are, reached from the index. This decides
T2–T5's real shape (redirect map, breadcrumbs, deep links from books/family
pages).

### 2. Seats ownership (P2)
"Seats" appears on the **Plan & billing** group card, while the Teams split
lists child pages Books · Permissions · Audit — no Seats — and the mapping row
for Teams still mentions seats. One owner, stated: recommend Plan & billing
owns seat count/purchase; Teams shows read-only usage with a link.

### 3. Mobile root: account card + sign-out reachability (P3)
Today's mobile settings root leads with the account identity card
(avatar/name/plan); the new root mock is a bare card list. Decide: keep the
account card at the top of the index (recommended — it's the identity anchor
and the plan glance). And with sign-out moving to Security, mobile sign-out
becomes Settings → Security → bottom; decide whether the index also carries a
sign-out row (common pattern) or Security-only is acceptable.

### 4. "Webhooks" doesn't exist (P4)
The Developer group card lists API tokens **and Webhooks** — the app has no
webhooks. Mark it "future" or drop it; the mapping table's honesty is the
document's core asset.

## Minor (fix in passing)
- 5a's desktop render shows a top-nav ("Overview / Contacts / Settings") that
  isn't the app's actual header chrome — label it illustrative or match the
  real shell, so T1 isn't read as proposing a new desktop header.
- Legend: two entries both start "green —" (copy dup).
- Smell 13 is claimed by both T1 and T6 — harmless, but credit it once.

## Build-carry notes (not design changes)
- T1's config-unification maps 1:1 onto the P46-09 pattern
  (`app-banner-stack` precedent) — same PR shape.
- The old `#plan-billing` deep links exist in code (Family/Teams "nogroup"
  rows) and possibly in emails — the redirect map from adjustment 1 must cover
  the anchor URL itself (`/settings#plan-billing` → `/settings/billing`).
