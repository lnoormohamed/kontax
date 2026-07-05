# P46-DB06 Mobile Consistency Audit — design review & revision direction (round 2)

Reviewer: engineering · Date: 2026-07-05 · Deliverable reviewed:
`P46-DB06 Mobile Consistency Audit.html` (+ `db06.css`), handoff #25.

> **Big step up — round 1 is substantially addressed.** Contact detail is now
> drawn (with a fate decision), the states matrix + real empty/loading/offline/
> selection states are in, the notification / search / sync / connection / login
> / dropdown / modal patterns are all drawn, and the phones grew to 444px.
> **Three things now block: it needs to be partly interactive, several mocks
> clip their content, and the overlay/sheet mocks (the filter especially) don't
> render right — the scrim only dims the body and the sheet runs into the phone's
> rounded corner.** All fixable; specifics with the CSS causes below.

---

## What's now resolved (round 1 → round 2)

- **Contact detail is drawn** — header, hero, tabs, plus an explicit "fate
  decision" panel. This was the #1 blocker; good.
- **States** — the A7 states matrix + real mocks for empty (contacts / search /
  connections), loading skeleton, offline write-gated with the banner in situ,
  and selection/bulk-edit. Exactly what round 1 asked for.
- **Patterns drawn** — notification panel, search, filter, sort, sync,
  connection detail, login, more-menu, confirm modal — the abstract minis are
  now real screens.
- **Phones enlarged** — `.pf` 372 → 444px, body 560 → 640. Better.

Keep all of it. The round-2 notes are about **rendering quality and
interactivity**, not structure.

---

## Priority 1 — Make the key surfaces interactive

Right now every overlay is shown as a *static* second phone sitting next to the
resting one. For the surfaces whose whole point is *open → dismiss* behaviour,
that under-sells the spec and makes the sheets look broken (see P3). The design
canvas supports JS — please make a handful of **hero interactions live** so the
taxonomy's dismiss rules can actually be felt:

- **Filter / sort** — tap the filter/sort control → sheet slides up over a
  dimmed full screen → swipe-down / backdrop-tap dismisses it.
- **Notification panel** — tap the bell → full-screen overlay in → back closes.
- **Search** — tap search → overlay + field focus → Cancel closes.
- **Contact detail tabs** — tapping Details / Sharing / History switches the
  panel (proves "tabs aren't pages").
- **Selection** — tapping a row's checkbox toggles the bulk-edit bar.

You don't need every screen interactive — one live instance per interaction
type is enough, with the rest staying static reference. This doubles as the
proof that the open/dismiss contract in A5 actually holds.

---

## Priority 2 — Content is being clipped (the "cut off" problem)

Confirmed, and it's a single root cause: the phone body is a **fixed height with
`overflow:hidden`** — `.mbody{overflow:hidden}` + `.pf .mbody{height:640px}`
(`db06.css:616,1060`). Any mock whose content is taller than 640px is silently
cut at the bottom, with no scroll and no indication. It bites the content-heavy
screens most:

- **Connection detail** — header row + 4 key/value rows + "Sync now" +
  "Disconnect" almost certainly exceeds 640 and clips the Disconnect button.
- **Sync** — 3 connection rows + "Add a connection" runs long.
- **Contact detail** — hero + tabs + field sections will clip.

Fix options (either is fine):
- Let each mock's phone **size to its content** — `min-height` instead of a
  hard `height`, and drop `overflow:hidden` on the mocks that are meant to show
  a full screen; or
- Keep fixed heights but use the `xtall` (760px) variant where needed and
  **verify every mock — nothing important below the fold.** Do a pass at 100%
  zoom and check each phone's last element is fully visible above the nav.

A reviewer should never have to wonder whether a button got cut or the screen
just ends there.

---

## Priority 3 — The overlay/sheet mocks don't render right (filter is the worst)

This is what you're seeing "toward the bottom." Three separate bugs, all in the
sheet/dropdown/modal mocks:

1. **The scrim only dims the body — not the header or the nav.**
   `.msheetscrim{position:absolute;inset:0}` sits *inside* `.mbody`
   (`db06.css:1349`), so the dimmed backdrop stops at the body edges. The header
   above and the bottom nav below stay bright, with the sheet/menu floating in a
   dimmed middle band. That directly contradicts the doc's own A5 rule ("render
   **above** the fixed bottom nav, `z-index` > nav"). **Fix:** mount the scrim +
   sheet over the whole `.mscreen` (cover header *and* nav), so the sheet layers
   above the nav and the entire screen behind is dimmed.

2. **The filter/sort sheet runs into the phone's rounded corner.** The filter
   and sort phones have **no bottom nav element** and no safe-area spacer, so the
   sheet sits flush at the bottom of `.mbody`, which is the rounded bottom of
   `.pf` (`border-radius:42px; overflow:hidden`). The "Show 48 contacts" apply
   button's bottom corners get clipped by the phone's radius. **Fix:** either
   keep the nav visible under the scrim (sheets sit *above* the nav, not instead
   of it) or add a home-indicator / safe-area inset so the sheet's footer clears
   the rounded corner.

3. **The dimmed background behind the sheet is too sparse.** Only two dimmed
   rows sit behind the filter/sort sheet, leaving a large empty white gap
   between the header and the sheet — which reads as a broken/half-loaded
   screen. **Fix:** fill the background list (6+ rows) so the sheet clearly
   overlays a real, full screen.

Once P1 makes these interactive, 1–3 mostly resolve themselves — a real
slide-up sheet over a real full-screen scrim won't have any of these artefacts.

---

## Priority 4 — Consistency & sizing polish

- **Make the "is the nav visible?" rule explicit and apply it consistently.**
  Right now some overlay mocks show the bottom nav and some don't, with no stated
  logic. State it: **full-screen overlays** (notification, search) cover the nav
  → no nav; **sheets, dropdowns, modals** keep the nav in place but dimmed under
  a full-screen scrim. Then every mock should follow it — inconsistent nav
  presence reads as exactly the drift this brief exists to kill.
- **Phones still read a little small** three-up on the 1760px canvas. For the
  hero interaction rows (P1), consider **two phones per row** so the live
  surfaces are bigger and more legible; keep three-up only for the static
  reference grids.
- **The modal/dropdown share bug #1** — same body-only scrim; fix them together.

---

## Summary — the round-2 ask in one line

**Great progress on coverage.** Now: make a few surfaces **interactive**, stop
the fixed-height bodies from **clipping** content, and fix the **overlay
layering** so sheets (the filter above all) sit above a full-screen scrim and
clear the phone's rounded corner — not floating in a dimmed middle band. The
structure, the states, and Part B are all solid; don't touch them.
