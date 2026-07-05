# Design-mock consistency audit — handoff #28 (pre-build)

> **RESOLVED in handoff #29 (2026-07-05) — verified by diff.** All five actions
> landed: (1) DB03 mobile overlay adopts DB06 metrics (42px/r11 tile + new
> `.nrico.red`, 15/13.5/12 text, 11px "New", 20px title, blue back) with the
> desktop-dropdown compact density now *documented* as deliberate; (2) DB04
> search is an in-place header mode with trailing blue "Cancel" — icon-only
> back removed; (3) DB06 gained a **Scale & ownership** note (444px ≈1.14×
> presentation scale; DB04 owns row/avatar metrics at 40px, DB03 owns
> notification density, 02-contact-detail owns field content); (4) DB06 A5 now
> states the single overlay lead rule (blue back chevron + title; search =
> the one documented "Cancel" variant; ✕ never closes a full-screen overlay);
> (5) all eight pre-DB06 desktop docs carry a fixed "Superseded — don't build
> mobile chrome from this doc" banner. §3/§4 below are retained for provenance;
> the build proceeds from DB06 + DB03/DB04.

Date: 2026-07-05 · Scope: every design doc in the Claude Design bundle, audited
against **P46-DB06** (the mobile-consistency spec) + the locked brand tokens.
Method: three parallel audit passes (design tokens · mobile chrome · shared
components/overlays) over the HTML/CSS/JSX sources.

> **Verdict: DB06 itself and the nine token-driven brief files are clean and
> mutually consistent — the drift lives in (a) the two sibling P46 briefs that
> will be built next (DB03, DB04) which disagree with DB06 in small but real
> ways, (b) a size ambiguity DB06's enlarged presentation phones created, and
> (c) the older desktop-first docs, which contradict DB06's mobile chrome
> wholesale and should be marked superseded rather than fixed.**

---

## 1. What is CLEAN (verified — no action)

- **Token discipline in the brief files:** `scrubber.css`, `photo-model.css`,
  `aging.css`, `row.css`, `interface.css`, `connection.css`, `projection.css`,
  `enforcement.css`, `export.css` have **byte-identical `:root` palettes** to
  canonical `db06.css`. No near-duplicate hexes anywhere in the token files.
- **Rule 5 (no mobile Overview):** clean across *every* doc — no Overview tab,
  no `?tab=overview` wordmark link anywhere.
- **Bottom nav in the mobile-PWA primitives** (`mob-kit.jsx`): exactly the four
  canonical tabs, right order.
- **P42 banner brief:** every banner hex matches canonical exactly; its
  priority table is a consistent subset of DB06's stack (it omits
  impersonation/email-verify/security by scope — the build component must still
  carry all five ranks).
- **Auth flows** (`Login & Register`, `Account Recovery & 2FA`): labelled
  text-link back-steps, no app chrome, notice-only errors — conform to DB06's
  auth rules. **P46-DB01** (scrubber) fully conforms.
- **DB02 (photo model):** its fallback-chain diagrams use the exact canonical
  avatar gradient/initials tokens. (Ironically more faithful than
  `Contact Detail.html` — see §3.)

## 2. MUST-RECONCILE before build — sibling briefs vs DB06

These are the findings that matter most: DB03/DB04 are being built against, and
they drift from DB06 on the same components.

### 2a. P46-DB03 (notification aging) vs DB06 — same components, drifted
| Component | DB06 canonical | DB03 renders | |
|---|---|---|---|
| Mobile notif icon tile | `.mnico` **42px / r11**, has `.red` variant | `.nrico` **34px / r9** (the *desktop rail* tile), **no `.red`** | fix in DB03 mobile overlay |
| Row text | 15 / 13.5 / 12 (mono time) | 13 / 12 / 11 (mono ✓) | one step small on mobile |
| Unread dot | 9px right | 8px right (gap 11 vs 13) | 1–2px drift |
| Section label | 11px, "New" | 10px, "Fresh" | align size + copy |
| Overlay title / back | 20px · **blue** back | 17px · wash/ink2 chevron (icon-only) | align; back must be labelled per A2 |

### 2b. P46-DB04 (list row) vs DB06
- **Search-mode header uses an icon-only back** — violates DB06's
  labelled-back rule. Either label it or define search as an in-place header
  mode (recommend the latter; matches the interactive search overlay in DB06).

### 2c. The avatar-size ambiguity (decide once, write it down)
Three values coexist: **40px** (DB04 cozy row — the ratified as-built), **42px**
(`Contacts List.html`), **50px** (DB06's enlarged presentation phones).
DB06's phones are deliberately oversized for legibility (444px frames), so its
50px is *presentation scale, not spec*. **Recommendation: 40px cozy is
normative** (per DB04, which supersedes the old list brief); add one line to
DB06 stating its phone mocks are ~1.14× presentation scale and DB04 owns row
metrics. Same logic resolves the DB03 text-size deltas (§2a) — decide whether
those are dropdown-density (intentional) or drift, and state it.

## 3. Older docs that CONTRADICT DB06 — supersede, don't implement

The desktop-first workspace docs pre-date DB06 and get mobile chrome wrong in
the same ways. None should be used as a mobile reference:

- **`Contacts List.html` (`cx-app.jsx:258-274`) — the worst single finding:**
  mobile bottom nav is **5 tabs: People · Favorites · Archived · Duplicates ·
  More** (no Activity/Sync/Settings). Directly contradicts the canonical 4-tab
  nav. Also: mobile header drops the bell, has no filter.
- **`Contact Detail.html` — biggest component drift:** its own **8-color tint
  palette matches none of DB06's four named tints** (a contact renders a
  different color here than in the list); hero 72px vs 88px, tinted-initials
  hero with **no photo/gradient path**; star badge `#f1b32c` vs amber
  `#bf8526`; action row 44px/r9/transparent/5-labelled-buttons vs DB06's
  50px/r14/wash/3-tiles; icon-only grey back (no-op); editing bg `#f3f5ff` vs
  `#edf0fe`; missing the collapsed-header 32px avatar; mobile uses an accordion
  where DB06 drew tabs.
- **`Notifications.html`:** security banner + danger buttons use **Tailwind red
  `#dc2626`/`#fef2f2`/`#991b1b`** instead of brand `--red #b5472f`/`--redWash`;
  unread dot 5px on the LEFT vs canonical 9px on the RIGHT; mobile sheet at
  z-90 without the canonical back-led overlay chrome; mounts a standalone
  security banner rather than the shared stack.
- **`Settings.html`:** hardcoded danger reds `#9a3a23`/`#8f3320`; mobile is a
  bare hamburger (no Section/Detail header, drawer says "Close").
- **`Sync Connections.html`, `Merge Duplicates.html`, `Activity Log &
  Source.html`, `Import Export.html`:** all hamburger-drawer shells — no 4-tab
  nav, HOME-style header on reached-into surfaces; sy-modal sheet r20 no
  grabber (canonical r24 + grabber); "Favourites" (British) label drift in
  activity sidebar.
- **`Sharing UI.html`:** icon-only backs ×2, no bottom nav on its phone frames.
- **Mobile-PWA layer (`mob-kit.jsx` shared primitives)** — three one-line fixes
  would cascade everywhere: `SubHeader` back is icon-only (add label);
  `PlainHeader`/`SmHeader` lack the bell (Section = title **+ bell**);
  `MobHeader` lacks the filter glyph. Plus the **Activity `PlainHeader` swap**
  (`mob-activity.jsx`) — the exact thing DB06 names and bans.
- **Search/notif overlay spec (P24B-DB18):** overlays correctly cover the nav,
  but search leads with the input + "Cancel" and notifications lead with title
  + icon-only ✕ — DB06 says full-screen overlays **lead with back**. DB06's own
  interactive mocks use back+Cancel, so pick one contract and state it.

## 4. Parallel token vocabulary (marketing vs app)

`kontax.css` + `db01/marketing-shell.css` re-name the same values
(`--accent`=`--blue`, `--body`=`--ink2`, `--green-t`=`--greenSoft`) and carry
one genuinely different hairline (`--hairline #edf0ea` vs `--line2 #e9ece7`).
Blue-hover `#3347d8` is used app-wide but tokenized only in `kontax.css` —
promote to a named token in the app set. Not a blocker; note for the build's
token file.

## 5. Recommended actions (in order)

1. **Reconcile DB03 + DB04 to DB06** (§2a/2b) — one designer pass; these are
   active build references.
2. **Lock the normative sizes** (§2c): avatar 40px cozy; add the
   presentation-scale note to DB06; state dropdown-vs-mobile density for
   notification text.
3. **Pick the overlay lead affordance** (back vs Cancel/✕) and state it in
   DB06 A5.
4. **Stamp the older docs superseded for mobile chrome** — one banner line at
   the top of each §3 doc pointing at DB06 (don't redraw them; the build
   implements DB06 against the real codebase, and the real codebase already
   has the correct 4-tab nav).
5. **Build carries:** the shared-primitive fixes (SubHeader label, header bell,
   filter glyph, Activity header hold) map 1:1 onto the real
   `mobile-header.tsx`/`app-shell.tsx` work already in the DB06 build plan;
   `#dc2626`→`--red` and the Contact-Detail tint palette are *mock-only* bugs —
   verify the real app's `AVATAR_TINTS` (`contacts-workspace-table.tsx:92-110`)
   is the single source when building.

## Appendix — audit coverage
Passes: tokens (all CSS files + inline styles) · mobile chrome (17 docs incl.
JSX shells) · components/overlays (notifications, rows, avatars, sheets,
banners, sync, photo model, contact detail). Not exhaustively re-read:
`Merge Surfaces Spec.html`, `Search Experience Spec.html` internals (two
sub-audits hit limits); their surfaces were covered indirectly via the shared
primitives they mount. Marketing-site docs audited for tokens only (own design
system, out of mobile scope).
