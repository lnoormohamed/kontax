# P46-DB06 Mobile Consistency Audit — design review & revision direction (round 1)

Reviewer: engineering · Date: 2026-07-05 · Deliverable reviewed:
`P46-DB06 Mobile Consistency Audit.html` (+ `db06.css`) from the Claude Design
handoff.

> **Verdict: strong structure, right coverage on paper — but the screen users
> live in most (contact detail) is rubber-stamped rather than designed, several
> in-scope screens exist only as table rows, and the phone mockups read small.
> One more pass gets it to buildable.** Details and specific direction below.

---

## What's working (keep this — don't rebuild it)

So the revision doesn't over-rotate, these parts are good and should survive:

- **The Part A → Part B spine** (A1 header system → A2 back → A3 banners →
  A4 conformance table → A5 overlay taxonomy → A6 scope → B Overview removal →
  deliverable summary) is exactly the right skeleton.
- **A1's "one primitive, three variants"** (Home / Section / Detail) is the
  correct call, and the three side-by-side phone mocks communicate it well.
- **The A4 conformance table is genuinely complete** — every route, incl. all 13
  settings subpages, sync + connections, auth flow, and account-state, each with
  header variant / back target / banners / nav tab / gap. This is the checklist
  we asked for; keep it.
- **The before → after gap mocks** for `/shares` and `/settings/*` are the
  clearest thing in the doc — that pattern is what the rest should follow.
- **A5 overlay taxonomy** (4 types + the surface-mapping table) and **Part B's
  relocation table + wordmark-re-point / health-in-People mock** are on point.

Nothing below asks you to throw any of that away — it's additive.

---

## Priority 1 — Contact detail is the real gap (blocking)

This is the specific thing that felt missing. Contact detail is the screen
users spend the most time on, and right now the deliverable **defers it instead
of designing it**:

- In A1 the "Detail" variant is mocked as **"New contact"** (the create form) —
  not the contact *detail* screen.
- In A4, `/contacts/[id]` is a single table row: *"Bespoke scroll-hide +
  edit-state header **blessed** as the sanctioned Detail exception · conforms."*
- There is **no mockup of contact detail anywhere** in the document, and its
  tabs, hero, and editing state are never shown or aligned.

"Blessed as a sanctioned exception, conforms" is a pass, not a design. For the
highest-traffic screen that's not good enough. **Please add a dedicated contact
detail section** with real mobile mockups covering:

1. **Header, both states** — the scroll-collapsed compact bar *and* the expanded
   top of the screen. Show how the labelled back reads (`router.back()` → list,
   per A2), where the name sits, and the edit / more-menu actions. Decide
   visibly: does the bespoke scroll-hide header genuinely stay an exception, or
   does it fold into the Detail variant with scroll-hide as a documented option?
   Show the answer, don't assert it.
2. **The Details / Sharing / History tab bar** — this is core to the "tabs
   shouldn't feel like pages" work. Show the tab-strip styling aligned to the
   rest of mobile (active/inactive, where it sits under the header). The Back
   behaviour itself already shipped (P46-05) — you're aligning the *look*, not
   re-deciding the nav.
3. **The hero / photo block** — how the avatar/photo, name, and primary actions
   render at the top, consistent with the P46-DB02/DB04 photo work.
4. **Editing state** — the current bespoke blue editing background: show it,
   and reconcile it with the canonical system (keep it, or replace it).

Boundary to hold: align the **frame** (header/tabs/hero/actions), not the field
*content* layout — that stays owned by `02-contact-detail.md`. But the frame
must be *drawn*, not table-referenced.

---

## Priority 2 — The mobile mockups read too small

Agreed. The phone frames (`.pf`) are 372px wide sitting inside 1760px canvas
frames, so each phone occupies ~20% of the width and the content (16px names,
46px avatars) reads cramped — and the list bodies only show 3–4 rows, which
undersells the very lists the audit is about. Direction:

- **Enlarge the primary phone mocks** — bump the frame to roughly **420–460px**
  wide and increase the body height so **6+ list rows** are visible. Where a row
  of four phones causes the shrink (the gap before/after set), drop to **two or
  three per row** so each phone is bigger, even if it means stacking vertically.
- **Legibility target:** a reviewer should be able to read every label without
  zooming. Names, secondary lines, tab labels, and back labels should all hold
  up at the larger size.
- **Kill the abstract overlay miniatures.** The A5 taxonomy currently uses
  ~82×104px grey placeholder "demo phones" with colored blocks. For surfaces we
  explicitly pulled into scope (notification panel, search, filters), that's too
  abstract — replace them with **real, full-size mobile mockups** (see P3).

---

## Priority 3 — Draw more of the in-scope screens (not just table rows)

The A4 table lists every screen, which is right for a checklist — but a
*consistency* brief has to *show* the alignment, and today only ~5 screens are
actually drawn (list, settings root, create, /shares, /settings/*, People). For
a reviewer (and the build) to trust it, add real mocks for at least:

- **Contact detail** (P1 above).
- **The notification panel** — full-screen overlay chrome (back-led, `z-[100]`),
  as a real mock, since it's the flagship of the A5 taxonomy. Content/aging is
  P46-DB03's; show the *chrome* here.
- **Search overlay** and **filter bottom sheet** — the two other surfaces we
  explicitly added; show them at full size with the dismiss affordance the
  taxonomy prescribes.
- **Sync + a connection sheet** — "connections" was a specific ask; the per-
  provider connection add/edit sheet is called out as "bespoke, off-pattern" in
  A4 but never shown. Draw the aligned version.
- **One auth screen** (e.g. `/login`) — auth was pulled into scope; a single
  centered-card mock anchors "shared primitives, no app chrome" better than the
  table row alone.
- **The banner stack** — A3 is a ranked list; add one phone mock showing 2–3
  banners actually stacked above content + bottom nav, so the ordering and the
  safe-area clearance are visible.

You don't need to draw all ~30 routes — but every *distinct pattern* (detail,
overlay, sheet, sync/connection, auth, banners) should have one real mock.

### The full missing-screens checklist

For completeness, here is **every in-scope screen not currently drawn**, checked
against the A4 census. "Drawn today" (6): contacts list, settings root, create,
`/shares` before/after, one `/settings/*` subpage, People-with-health.

**Contacts & workspace — draw each**
- [ ] `/contacts` Activity tab (show it holding the *one* Home header — it's a
      named gap: the mid-screen header swap)
- [ ] `/contacts/[id]` contact detail — *P1, biggest gap*
- [ ] `/import-export`
- [ ] `/merge-suggestions/[id]`
- [ ] `/merge/manual`

**Sync & connections — draw each**
- [ ] `/sync`
- [ ] Connection add / edit / detail sheet (the "connections" ask)

**Settings subpages — draw the distinct-content ones only** (the shared header
pattern is already proven by the Notifications mock, so don't redraw all 13 —
but these have materially different bodies):
- [ ] Family · Teams (+ Teams/audit) · Books · Devices · Security · Public card
      (profile/card)
- Preferences / Developer / Import-presets / Export-presets can ride the proven
  pattern unless their body differs enough to warrant a mock.

**Account-state & onboarding — draw each**
- [ ] `/welcome/[plan]` · `/verify-email` · `/account-pending-deletion` ·
      `/account-deleted` · `/help`

**Auth flow — one representative + note the rest**
- [ ] `/login` (the representative). Confirm `/register`,
      `/login/verify-2fa`, `/forgot-password`, `/reset-password` share the same
      primitives — one mock covers the pattern; the step-back cases
      (verify-2fa / forgot) just need their back affordance shown.

**Overlays / sheets / menus — one real mock per taxonomy type** (replace the
abstract minis; don't draw all twelve components):
- [ ] Full-screen: **notification panel** *and* **search overlay** (both are
      explicitly in scope, so draw both)
- [ ] Bottom sheet: **filter sheet** (representative; sort + quick-add share it)
- [ ] Dropdown: **more-menu** (representative; user-menu shares it)
- [ ] Modal: **confirm** (representative; password / downgrade / plan /
      labels share it). Note the security-alert drawer as the one distinct
      affordance.

---

## Priority 4 — Show the key states, not just resting screens

A *consistency* audit is exactly the document where inconsistency hides in the
**states**, not the default screens — and right now the deliverable is almost
entirely happy-path: one resting mock per pattern. That's the biggest structural
gap after contact detail. Please add the important states. To keep it scoped —
**not every state on every screen**, but each of these states shown at least
once on the pattern where it matters most:

- **Empty states** — no contacts, no search results, no shared contacts, no
  duplicates, empty activity, no connections yet. These drift the most and none
  are shown.
- **Loading / skeleton** — the windowed-list skeleton (P38), sync-in-progress.
- **Error / offline** — failed load, sync error, connection-failed, and the
  offline write-gated state (Phase 42).
- **Search active** — header with search expanded → results → no-results.
- **Selection / bulk-edit** — the multi-select checkboxes + action bar (P28); it
  replaces the header, so it's a real consistency case.
- **Scrolled / collapsed header** — contact detail's scroll-hide header is *the*
  bespoke thing this audit is taming; show its collapsed state (ties to P1).
- **Banner-present** — a real screen with the offline/billing banner pushing
  content down, so the A3 stack is shown in situ, not just as a ranked list.
- **Overlay-open + editing + long-content overflow** — notification panel /
  filter sheet / menu open; contact-detail edit mode; and truncation on long
  names and long header titles.
- **Notification aging** — the muted / "passed" states from P46-DB03, on the
  notification panel mock.

A compact **states matrix** at the top of this section — pattern (list / detail
/ sheet / overlay / banner) × which of {default, empty, loading, error-offline,
active-selected, scrolled, banner-present} you're drawing — would make the
coverage legible at a glance and keep it from ballooning.

> Note: this is partly a gap in the original brief, which asked for one mock per
> pattern and didn't call out states — so this is a genuine scope addition, not
> a miss on your part. Flagging it now so round 2 covers pages **and** states.

## Smaller notes / polish

- **The lede undersells the doc.** It says the system is "navigation, headers,
  back behaviour, and banners" but the doc also delivers the overlay taxonomy
  (A5) and the settings/auth/account-state census. Add overlays + "every screen"
  to the opening sentence so the scope reads as broad as it actually is.
- **Cross-links are dead** (`href="#"`). Before final handoff, point them at the
  real briefs: `mobile-design-brief.md`, `P46-DB04`, `04-login-register.md`,
  `P46-DB03`.
- **`/help` back target** is "→ referrer" in A4 — referrer-based back is exactly
  the kind of unpredictable target A2 is trying to kill. Give it a fixed labelled
  target (Settings) or justify the exception.
- **Consistency of your own status chips:** `/contacts/[id]` is marked
  "conforms" while simultaneously being an unshown exception — once it's actually
  designed (P1) it should read "change" or "conforms" honestly against a drawn
  mock.

---

## Suggested v2 mockup inventory (the ask, in one list)

Real, enlarged (~420–460px) mobile mocks for:

1. Contacts list (Home header) — *have it, enlarge*
2. **Contact detail — header (both scroll states) + Details/Sharing/History
   tabs + hero + editing state** — *new, P1*
3. Settings root (Section) + a settings subpage before/after — *have it, enlarge*
4. Create/edit (Detail) — *have it, enlarge*
5. /shares before → after — *have it, enlarge*
6. **Notification panel** (full-screen overlay chrome) — *new, replace mini*
7. **Search overlay** + **Filter bottom sheet** — *new, replace minis*
8. **Sync + connection sheet** — *new*
9. **One auth screen** (login) — *new*
10. **Banner stack** on a real screen — *new*

Plus the **key states** (Priority 4) — empty / loading / error-offline / search-
active / selection / scrolled / banner-present — shown once each on the pattern
where they matter, ideally with a small states matrix.

Keep A4 (the full table), A5 (the taxonomy rules), A6 (scope), and Part B as-is
— they're solid. The revision is mostly: **design contact detail for real, make
the phones bigger, draw the patterns you're currently only tabling, and show the
key states — not just the resting screens.**
