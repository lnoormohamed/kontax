# Kontax UX/UI Audit — June 2026

**Status:** Complete  
**Audit owner:** Codex + team  
**Date started:** 2026-06-27  
**Environment:** Production (`https://kontax.vexon.co`)  
**Method:** Browser-based breakpoint audit using a signed-in production account, plus unauthenticated HTML and component review where session redirects limited direct auth-page access

---

## Audit metadata

- **Product:** Kontax
- **Version / release tag:** Production snapshot as of 2026-06-27
- **Browsers tested so far:** In-app Chromium session
- **Accounts used:**
  - Existing account: `li@linoormohamed.com`
  - Fresh sign-up account: `li+kontax-uxaudit-20260627@linoormohamed.com`
- **Breakpoints tested so far:**
  - Mobile: `390x844`
  - Tablet: `768x1024`
  - Desktop: `1440x900`

## Goal

Identify usability issues, responsive layout problems, accessibility gaps,
design inconsistencies, and workflow friction across mobile, tablet, and
desktop for the public site, sign-up journey, and core signed-in
contact-management flows.

## Scope

### Included

- Public marketing pages
- Logged-in homepage behavior
- Register and login flows
- Core signed-in contact flows
- Mobile, tablet, and desktop responsive behavior

### Excluded in this pass

- Admin routes
- Real-device hardware validation
- Browser-permission and install prompts
- Post-signup email verification and mailbox-dependent flows

## Executive summary

Kontax already shows a lot of product maturity: the signed-in overview is
purposeful, the mobile dashboard has a clearer navigation model than expected,
and the app gives returning users fast access to their workspace. The main UX
risk emerging from the first pass is not a single broken flow, but density and
context switching across surfaces. The marketing homepage mixes signed-in and
signed-out states, the tablet overview still carries a desktop-weight left rail,
and the mobile people list places several competing actions inside each row.

Nothing in this completed first pass looks release-blocking, but there are
already several worthwhile improvements to schedule. The most important work is
not rescue; it is refinement of hierarchy, action density, and clarity across
mid-size and mobile surfaces.

## Biggest strengths

- Mobile overview uses a focused header and bottom navigation, which makes the
  signed-in dashboard easier to orient on small screens.
- Overview cards create strong entry points into meaningful work such as people,
  duplicates, and contact health.
- Returning-user homepage state does provide a direct path back into the app.

## Biggest risks so far

- Signed-in and signed-out homepage states are blended together, which weakens
  message clarity.
- Tablet keeps a very dense desktop-style left rail that competes with primary
  content.
- Mobile list rows and create flows still expose some interaction density and
  accessibility debt.
- Auth flows are mostly coherent, but forgot-password breaks the visual pattern
  established by login and register.
- Manual merge still feels desktop-first at the moment users need to find and
  compare a contact pair.

## Devices and breakpoints

| Label | Viewport | Status |
|---|---|---|
| Mobile standard | `390x844` | Complete |
| Tablet portrait | `768x1024` | Complete |
| Desktop wide | `1440x900` | Complete |

## Severity scale

| Severity | Meaning | Expected action |
|---|---|---|
| Critical | Blocks task completion or creates serious trust risk | Fix immediately |
| High | Strongly degrades task completion, clarity, or confidence | Prioritize in next sprint |
| Medium | Noticeable friction, inconsistency, or design debt | Schedule and batch |
| Low | Cosmetic, polish, or minor clarity issue | Fix opportunistically |

## Test matrix

| Area | Route / flow | Mobile | Tablet | Desktop | Notes |
|---|---|---|---|---|---|
| Marketing | `/` homepage | Done | Done | Done | Logged-in state reviewed across breakpoints |
| Marketing | `/features` | Done | Done | Done | No additional actionable issue logged |
| Marketing | `/pricing` | Done | Done | Done | No additional actionable issue logged |
| Marketing | `/security` | Done | Done | Done | No additional actionable issue logged |
| Marketing | `/changelog` | Done | Done | Done | No additional actionable issue logged |
| Auth | `/login` | Done | Done | Done | Unauthenticated HTML plus shared auth-card component reviewed |
| Auth | `/register` | Done | Done | Done | Unauthenticated HTML plus shared auth-card component reviewed |
| Auth | `/forgot-password` | Done | Done | Done | Unauthenticated HTML plus component/code review |
| App | `/contacts?tab=overview` | Done | Done | Done | First-pass review complete |
| App | `/contacts?tab=people` | Done | Done | Done | Mobile density issue logged; tablet/desktop otherwise stable |
| App | Search, filters, sort | Done | Done | Done | Browser and code-backed control review completed |
| App | `/contacts/new` | Done | Done | Done | Mobile phone-control issue logged; no extra breakpoint issue found |
| App | `/contacts/[id]` detail | Done | Done | Done | Mobile edit redundancy logged; no extra breakpoint issue found |
| App | Duplicates / merge review | Done | Done | Done | Mobile layout issue and non-search picker issue logged |
| App | Labels / lists / books | Done | Done | Done | Covered through workspace navigation and sidebar review |
| App | Import / export | Done | Done | Done | Export-tab context-mixing confirmed across responsive states |
| App | Sync | Done | Done | Done | Mobile history issue logged; larger breakpoints stable |
| App | Settings | Done | Done | Done | No additional actionable issue logged |

## Method

### What was evaluated so far

- Navigation clarity
- Content hierarchy
- Responsive layout behavior
- Interaction density
- Accessibility basics
- Logged-in versus logged-out state handling
- Clean-pass confirmation for remaining public and signed-in routes

### Evidence captured

- Route and breakpoint notes
- DOM snapshot review
- Flow reconnaissance across public and signed-in routes
- Shared-component and server-rendered HTML review for auth surfaces that
  redirect authenticated sessions

## Findings summary

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 7 |
| Low | 4 |

## Findings

| ID | Severity | Area | Route / flow | Device | Issue | Why it matters | Recommendation | Evidence | Ticket |
|---|---|---|---|---|---|---|---|---|---|
| UX-001 | Low | Marketing | `/` homepage | Mobile, Desktop | Signed-in homepage still ends with a generic `Get started free` acquisition CTA | Mixed signed-in and signed-out messaging weakens clarity and can make the page feel less tailored to returning users | Swap the lower CTA to a signed-in action such as `Open app`, or suppress acquisition messaging for authenticated sessions | Logged-in homepage review at `390x844` and `1440x900` on 2026-06-27 | Pending |
| UX-002 | Medium | App navigation | `/contacts?tab=overview` | Tablet | Tablet keeps the full desktop-style left rail, including a very long labels section, which competes heavily with the main overview content | Primary tasks become harder to scan because secondary navigation and metadata dominate the screen at a mid-size breakpoint | Collapse labels/books behind progressive disclosure on tablet, or shift to a lighter tablet nav model | Overview review at `768x1024` on 2026-06-27 | [P34U-01](../build-phase/p34u-01-tablet-overview-nav-density.md) |
| UX-003 | Medium | Contacts list | `/contacts?tab=people&filter=all&sort=name&view=compact` | Mobile | Each contact row exposes several competing actions around the primary row target | Dense rows increase cognitive load and raise the risk of accidental taps when users mainly want to open a contact | Reduce always-visible row actions on mobile and move secondary actions into swipe, long-press, or overflow patterns | People list review at `390x844` on 2026-06-27 | [P34U-02](../build-phase/p34u-02-mobile-people-row-action-hierarchy.md) |
| UX-004 | Medium | Create contact | `/contacts/new` | Mobile | Phone input flow exposes an icon-only globe control with a weak accessible name (`🌐`) | The control is unclear visually and underspecified for assistive technology, especially inside a critical form flow | Replace the icon-only affordance with a labelled country-code selector and a descriptive accessible name | Create-contact review at `390x844` on 2026-06-27 | [P34U-03](../build-phase/p34u-03-phone-country-selector-clarity.md) |
| UX-005 | Medium | Auth | `/forgot-password` | Mobile, Desktop | Forgot-password uses a noticeably different visual language from login/register | Breaking the shared auth pattern can make the reset path feel less connected and less trustworthy than the main auth entry points | Align card treatment, CTA color, and typographic rhythm with the login/register system | Unauthenticated HTML and code review on 2026-06-27 | Pending |
| UX-006 | Medium | Sync | `/sync?account=cmq446geh0001j5uhqoo4ps11` | Mobile | Sync history becomes a long repetitive stack with repeated labels like `Date`, `Direction`, `Changes`, and blank-feeling `Status` markers | The detail page becomes hard to scan quickly on mobile, especially for a support-heavy surface where users need fast diagnosis | Compress sync-history rows for mobile and make status/value groupings more compact and explicit | Sync detail review at `390x844` on 2026-06-27; mobile card refactor shipped in `0ad964e` and verified on production on 2026-06-28 | Verified |
| UX-007 | Low | Auth | `/forgot-password` | Desktop, Mobile | Reset-password metadata still uses the generic product description instead of reset-specific messaging | It weakens clarity in previews and search results for a recovery-focused page | Give the page its own description and sharing metadata aligned with password recovery | Unauthenticated HTML review on 2026-06-27 | Pending |
| UX-008 | Medium | Merge review | `/merge/manual` | Mobile | Manual merge picker uses a fixed three-column selector row with no mobile override | On small screens, the first step of manual merge is likely cramped before the user even reaches the actual review | Add a stacked mobile layout for the pair picker and keep the compare action separate from the field controls | Code review of `src/app/merge/manual/page.tsx` and `src/app/_components/merge-review.tsx` on 2026-06-27 | [P34U-04](../build-phase/p34u-04-manual-merge-searchable-pickers.md) |
| UX-009 | Low | Contact detail | `/contacts/[id]` | Mobile | Mobile contact detail exposes multiple simultaneous `Edit` affordances | Repeating the same primary action in the compact header, hero header, and FAB adds visual noise to an already dense detail surface | Choose one dominant edit entry point per state and remove redundant duplicates | Code review of `src/app/_components/mobile-contact-detail.tsx` on 2026-06-27 | Pending |
| UX-010 | Low | Import / export | `/import-export?tab=export` | Mobile, Tablet, Desktop | Export mode still shows import-oriented secondary modules like monthly import quota and import history | The page asks users to context-switch between export and unrelated import admin details during a focused export task | Hide or de-emphasize import-only secondary sections when the export tab is active, especially below the fold on smaller screens | Mobile export-tab review at `390x844` plus page code review on 2026-06-27 | Pending |
| UX-011 | Medium | Merge review | `/merge/manual` | Mobile, Desktop | Manual merge contact pickers present as giant native dropdowns labelled like search | Users must scan or scroll through a very long alphabetical list even though the control implies search, which is especially heavy in a dense contact database | Replace the native select pattern with real typeahead search and recent/suggested matches | Mobile merge-page review plus code review of `src/app/merge/manual/page.tsx` on 2026-06-27 | [P34U-04](../build-phase/p34u-04-manual-merge-searchable-pickers.md) |

## Detailed findings

### Finding `UX-001` — Signed-in homepage still uses an acquisition CTA

- **Severity:** Low
- **Area:** Marketing
- **Route / flow:** `/`
- **Device:** Mobile, Desktop
- **Steps to reproduce:**
  1. Visit the homepage while already authenticated.
  2. Confirm the hero shows a returning-user state such as `Welcome back, li.`
  3. Scroll to the lower page CTA section.
- **Observed behavior:** The footer CTA still promotes `Get started free` even
  though the page is already being rendered for a signed-in user.
- **Expected behavior:** Logged-in users should see a stronger return-to-product
  CTA or a more context-aware next step.
- **Why it matters:** The page mixes acquisition and retention states in one
  surface, which reduces clarity and makes the page feel less intentional.
- **Recommendation:** Replace the CTA with `Open Kontax`, `Go to contacts`, or
  another returning-user action whenever an authenticated session is present.
- **Evidence:** Logged-in homepage observations at `390x844` and `1440x900`.
- **Linked ticket:** Fixed in `0ad964e`; verified on production on 2026-06-28 at `390x844`

### Finding `UX-002` — Tablet overview inherits too much left-rail density

- **Severity:** Medium
- **Area:** App navigation
- **Route / flow:** `/contacts?tab=overview`
- **Device:** Tablet
- **Steps to reproduce:**
  1. Open the signed-in overview at `768x1024`.
  2. Review the left rail before interacting with the main overview cards.
  3. Compare how much visual weight the left rail carries versus the page body.
- **Observed behavior:** The tablet layout preserves the full left rail,
  including books, labels, counts, and many secondary items, making the page
  feel desktop-dense at a mid-size breakpoint.
- **Expected behavior:** Tablet should retain orientation without asking the
  user to visually parse the full desktop navigation model.
- **Why it matters:** The overview's primary purpose is to focus the next task,
  but the surrounding navigation competes for attention.
- **Recommendation:** Use collapsible sections, a lighter tablet nav, or a
  condensed summary treatment for labels and books.
- **Evidence:** Signed-in overview observations at `768x1024`.
- **Linked ticket:** [P34U-01](../build-phase/p34u-01-tablet-overview-nav-density.md)

### Finding `UX-003` — Mobile people rows carry too many simultaneous actions

- **Severity:** Medium
- **Area:** Contacts list
- **Route / flow:** `/contacts?tab=people&filter=all&sort=name&view=compact`
- **Device:** Mobile
- **Steps to reproduce:**
  1. Open the people list at `390x844`.
  2. Inspect a typical row in the compact list.
  3. Note the number of actionable controls surrounding the contact name.
- **Observed behavior:** Rows expose selection, favorite state, archive
  behavior, and the contact link in the same compact surface.
- **Expected behavior:** The main row tap target should dominate, with
  secondary actions revealed only when needed.
- **Why it matters:** On touch devices, dense interaction clusters make the list
  harder to scan and easier to mis-tap.
- **Recommendation:** Keep open-contact as the dominant action and progressively
  reveal secondary controls through swipe or overflow patterns.
- **Evidence:** People list observations at `390x844`.
- **Linked ticket:** [P34U-02](../build-phase/p34u-02-mobile-people-row-action-hierarchy.md)

### Finding `UX-004` — Mobile create-contact phone control is underlabelled

- **Severity:** Medium
- **Area:** Create contact
- **Route / flow:** `/contacts/new`
- **Device:** Mobile
- **Steps to reproduce:**
  1. Open the create-contact screen at `390x844`.
  2. Move to the phone field area.
  3. Inspect the country/region selector control preceding the phone input.
- **Observed behavior:** The control is represented by a globe icon and exposes
  a weak accessible name, making its purpose less obvious.
- **Expected behavior:** The phone entry flow should clearly communicate country
  code selection and expose a descriptive accessible label.
- **Why it matters:** This is a core form flow, and unclear controls create
  friction for both sighted users and assistive technology users.
- **Recommendation:** Add a visible label or helper text and provide a strong
  accessible name such as `Select country code`.
- **Evidence:** Create-contact observations at `390x844`.
- **Linked ticket:** [P34U-03](../build-phase/p34u-03-phone-country-selector-clarity.md)

### Finding `UX-005` — Forgot-password breaks the auth visual system

- **Severity:** Medium
- **Area:** Auth
- **Route / flow:** `/forgot-password`
- **Device:** Mobile, Desktop
- **Steps to reproduce:**
  1. Compare `/login` and `/register` against `/forgot-password`.
  2. Review card treatment, CTA color, spacing rhythm, and overall visual tone.
  3. Note the differences in how the recovery page is presented.
- **Observed behavior:** Login and register share one polished auth-card system,
  while forgot-password uses a different layout, different card proportions, and
  a different primary button color.
- **Expected behavior:** Password recovery should feel like part of the same
  trusted auth journey, not a separate sub-product.
- **Why it matters:** Recovery flows happen at moments of uncertainty. Visual
  inconsistency can subtly reduce confidence in the process.
- **Recommendation:** Rebuild forgot-password on the same auth-card foundation
  or align its layout, button styling, and typographic hierarchy with it.
- **Evidence:** Unauthenticated HTML for `/login`, `/register`, and
  `/forgot-password`, plus auth component review on 2026-06-27.
- **Linked ticket:** Pending

### Finding `UX-006` — Mobile sync history is too repetitive to scan quickly

- **Severity:** Medium
- **Area:** Sync
- **Route / flow:** `/sync?account=cmq446geh0001j5uhqoo4ps11`
- **Device:** Mobile
- **Steps to reproduce:**
  1. Open a sync-account detail page on mobile.
  2. Scroll to the sync-history section.
  3. Review how each history row is rendered and labelled.
- **Observed behavior:** Each entry repeats labels such as `Date`,
  `Direction`, `Changes`, and `Status` in a long stacked pattern, which makes
  the history read more like an expanded data dump than a compact activity log.
- **Expected behavior:** Mobile history should stay compact and scannable, with
  status, date, and change volume readable at a glance.
- **Why it matters:** Sync diagnosis is already cognitively heavy. The current
  layout adds reading overhead when users are likely troubleshooting.
- **Recommendation:** Collapse rows into tighter mobile cards or summary lines,
  and make status a clearly rendered value rather than a repeated label slot.
- **Evidence:** Sync detail observations at `390x844`.
- **Linked ticket:** Pending

### Finding `UX-007` — Forgot-password metadata is still generic

- **Severity:** Low
- **Area:** Auth
- **Route / flow:** `/forgot-password`
- **Device:** Desktop, Mobile
- **Steps to reproduce:**
  1. Fetch or inspect the unauthenticated forgot-password page HTML.
  2. Review the page title and description metadata.
- **Observed behavior:** The page title is reset-specific, but the description
  still uses the generic product marketing copy instead of password-recovery
  messaging.
- **Expected behavior:** Recovery pages should have metadata that clearly
  matches the task the user is performing.
- **Why it matters:** It slightly weakens clarity in previews, history, and any
  shared or indexed surface where this page can appear.
- **Recommendation:** Add a reset-specific description and matching sharing
  metadata.
- **Evidence:** Unauthenticated HTML response from `/forgot-password` on
  2026-06-27.
- **Linked ticket:** Pending

### Finding `UX-008` — Manual merge entry layout is still desktop-shaped

- **Severity:** Medium
- **Area:** Merge review
- **Route / flow:** `/merge/manual`
- **Device:** Mobile
- **Steps to reproduce:**
  1. Open the manual merge route on a small screen.
  2. Review the first step where two contacts are selected for comparison.
  3. Observe the layout used for the pair picker before the merge review loads.
- **Observed behavior:** The page uses `gridTemplateColumns: "1fr auto 1fr"` for
  the picker row, with no matching mobile override in the page component.
- **Expected behavior:** Mobile should stack or progressively disclose the
  contact selectors so the entry step stays readable and easy to operate.
- **Why it matters:** Even before users get to the actual merge review, the
  manual entry point risks feeling cramped and desktop-first.
- **Recommendation:** Add a mobile-specific stacked layout for the two selectors
  and keep the merge/compare action on its own row.
- **Evidence:** Code review of [page.tsx](/Users/lnoormohamed/ChatGPT/Kontax/src/app/merge/manual/page.tsx:184) and [merge-review.tsx](/Users/lnoormohamed/ChatGPT/Kontax/src/app/_components/merge-review.tsx:1586).
- **Linked ticket:** [P34U-04](../build-phase/p34u-04-manual-merge-searchable-pickers.md)

### Finding `UX-009` — Mobile contact detail repeats the same edit action

- **Severity:** Low
- **Area:** Contact detail
- **Route / flow:** `/contacts/[id]`
- **Device:** Mobile
- **Steps to reproduce:**
  1. Open an editable contact on mobile.
  2. Review the hero header, compact header behavior, and floating action area.
  3. Count how many ways the same edit sheet can be opened.
- **Observed behavior:** Edit is exposed from the hero header, the compact fixed
  header, and a floating bottom-right FAB.
- **Expected behavior:** One primary edit action should dominate, with only one
  backup affordance if necessary.
- **Why it matters:** Repetition adds noise to a detail page that already has
  tabs, action pills, labels, and more-actions overflow.
- **Recommendation:** Pick a single primary edit entry point per viewport state
  and remove redundant duplicates.
- **Evidence:** Code review of [mobile-contact-detail.tsx](/Users/lnoormohamed/ChatGPT/Kontax/src/app/_components/mobile-contact-detail.tsx:296).
- **Linked ticket:** Pending

### Finding `UX-010` — Export tab still carries import-only secondary content

- **Severity:** Low
- **Area:** Import / export
- **Route / flow:** `/import-export?tab=export`
- **Device:** Mobile, Tablet, Desktop
- **Steps to reproduce:**
  1. Open the import/export page on mobile with `?tab=export`.
  2. Review the content shown below the export controls.
  3. Note which supporting sections are still present.
- **Observed behavior:** Export mode still shows monthly import quota and import
  history below the export controls.
- **Expected behavior:** Export mode should keep the user focused on export,
  with import-only support content hidden, collapsed, or clearly subordinate
  when export is the active task.
- **Why it matters:** Context mixing makes a utility page feel busier than it
  needs to be and weakens task focus.
- **Recommendation:** Hide, collapse, or move import-only support content when
  export is the active tab, with the strongest suppression on mobile and
  tablet.
- **Evidence:** Mobile export-tab review at `390x844` and [page.tsx](/Users/lnoormohamed/ChatGPT/Kontax/src/app/import-export/page.tsx:137).
- **Linked ticket:** Pending

### Finding `UX-011` — Manual merge pickers imply search but behave like huge dropdowns

- **Severity:** Medium
- **Area:** Merge review
- **Route / flow:** `/merge/manual`
- **Device:** Mobile, Desktop
- **Steps to reproduce:**
  1. Open the manual merge route.
  2. Review the `Contact A` and `Contact B` selectors before choosing a pair.
  3. Inspect how contacts are located in each control.
- **Observed behavior:** The page uses native `<select>` elements whose default
  option says `Search contacts…`, but the controls actually expose very long
  static option lists rather than a real searchable chooser.
- **Expected behavior:** Users should be able to find a contact quickly through
  typeahead search, recent matches, or narrowed suggestions.
- **Why it matters:** On larger datasets, scanning hundreds of names is slow,
  and the `Search contacts…` label sets the wrong expectation about how the
  control behaves.
- **Recommendation:** Replace the native select with a real search-driven
  combobox or typeahead picker and optionally prefill likely duplicate pairs.
- **Evidence:** Mobile DOM snapshot of `/merge/manual` plus code review of
  [page.tsx](/Users/lnoormohamed/ChatGPT/Kontax/src/app/merge/manual/page.tsx:233).
- **Linked ticket:** [P34U-04](../build-phase/p34u-04-manual-merge-searchable-pickers.md)

## Quick wins

- Make homepage CTAs session-aware for authenticated users.
- Reduce always-visible mobile row actions in the people list.
- Improve the create-contact phone control label and affordance.
- Align forgot-password with the main auth visual system.
- Simplify export mode by suppressing import-only secondary content on mobile.
- Replace manual merge dropdowns with searchable contact pickers.

## Larger opportunities

- Rework the tablet navigation model instead of scaling the desktop left rail
  straight down.
- Review how much list-management and metadata should stay visible by default
  across mid-size breakpoints.
- Reformat sync diagnostics and history for mobile-first scanning.
- Give merge review a genuinely mobile first-run and entry layout.
- Rework manual merge selection so finding a pair does not depend on scrolling
  through long native lists.

## Recommended next steps

1. Re-test shipped fixes `P34U-01`, `P34U-03`, and `P34U-04` at their target
   breakpoints and capture the missing after artifacts.
2. Treat `UX-005`, `UX-007`, `UX-009`, and `UX-010` as the remaining open
   implementation backlog from this audit.
3. Handle `UX-001` as a low-priority marketing polish item once the product
   surfaces above are settled.
4. Run a short second-pass polish audit after the remaining open backlog items
   land.

## Current implementation snapshot

- Shipped to `staging`: `P34U-01`, `P34U-02`, `P34U-03`, `P34U-04`, `UX-006`
- Verified with artifacts: `P34U-02`
- Still open from the June 2026 audit: `UX-001`, `UX-005`, `UX-007`, `UX-009`,
  `UX-010`
