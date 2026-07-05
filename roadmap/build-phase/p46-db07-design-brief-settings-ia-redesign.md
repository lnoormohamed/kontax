# P46-DB07 — Design brief: settings IA redesign (regroup everything, one nav, consistent depth)

Status: **Design converged (handoff #31, 2026-07-05) — ready for build tickets** · Priority: P1 · Depends: —

> Design mocked in Claude Design; one review round
> (`design-briefs/p46-db07-review-round-1.md`, resolved by diff-verification).
> Locked: eight groups; nested URL scheme with a complete 301 redirect table
> (`#plan-billing` → `/settings/billing`; `/sync` + `/import-export` stay
> workspace-level, linked from the Data & sync index; `/shares` moves to
> `/settings/sharing/shared`); seats owned by Plan & billing (Teams read-only);
> mobile index keeps the account card + sign-out shortcut (home = Security);
> Webhooks marked future. Build sequence T1–T6 per the design (T1 nav-config
> unification first — P46-09 pattern). Build-note: T6 routes Merge review via
> the real duplicates surfaces, not the design's placeholder `/duplicates`.
Phase: [Phase 46](phase-46-alphabet-scrubber.md)
Scope: **both breakpoints** — the IA is structural; mobile *chrome* (headers,
backs, sheets) stays governed by [P46-DB06](p46-db06-design-brief-mobile-consistency-audit.md).
Relates: [06-settings.md](../design-briefs/06-settings.md) (original settings brief — this supersedes its IA)

> User ask (2026-07-05): the settings section "looks a little messy — we might
> need to rethink where everything goes." Verified: it's not just visual — the
> IA has grown by accretion across ~10 phases and now has **14 concrete
> structural smells** (inventoried below). This brief redesigns the settings
> **information architecture**: what the groups are, one depth rule, one nav
> definition for both breakpoints, and a home for every orphan.

## Current state (verified 2026-07-05 — full inventory)

**Root `/settings`** = the mobile nav card list *plus* one giant anchor
section, `#plan-billing` (billing, plan comparison, group shortcut, session
card). Everything else is a subpage — **except Plan & billing, which has no
subpage at all**.

**13 subpages:** account (profile + username + email + password + data
export), notifications (toggles + digest + reminder lead-time), preferences
(phonetic names + display + interface), devices (CardDAV details + app
passwords + setup guides), security (connected accounts + 2FA + sessions +
delete account), books (view-mostly hub + permission history), profile/card
(public card + analytics), developer (API tokens, plan-gated), family (~470
lines), teams (~825 lines), teams/audit, import-presets, export-presets.

**Two navs that disagree** (`settings-sidebar.tsx` vs
`mobile-settings-nav.tsx`):
- **Desktop-only:** Preferences · Books · Developer · Merge review.
- **Mobile-only:** Shared with me · Import presets · Export presets ·
  Plan & billing row.
- So **Preferences, Books and Developer are unreachable on mobile**, and
  **Shared with me is unreachable on desktop** — the user hit the Preferences
  gap directly.

## The 14 IA smells (from the inventory — the brief must resolve or
explicitly accept each)

1. Import/export **split**: presets inside `/settings`, the feature outside at
   `/import-export`, circular links between them.
2. **Nav asymmetry by breakpoint** (above) — two hand-maintained structures,
   same drift class the banner stack had pre-P46-09.
3. **Plan-gated routing inconsistency**: Family/Teams rows land on
   `/settings#plan-billing` (anchor) when no group, `/settings/family|teams`
   (subpage) when set up — same row, two depths.
4. **Account vs Security boundary unclear**: email/password on Account;
   2FA/sessions/delete on Security — both are authentication.
5. **Uneven siblings**: Teams (~825 lines, books + seats + billing + audit)
   sits at the same nav level as Family (~470) and Import presets (~100).
6. **Books fragmentation**: `/settings/books` is view-mostly; real shared-book
   CRUD lives inside Family and Teams pages.
7. **Preferences scattered**: reminder lead-time (a preference) lives on
   Notifications; display/interface/phonetic on Preferences.
8. **Devices scope**: CardDAV + app passwords in settings; the sync accounts
   they serve at `/sync` outside.
9. **Public card orphan-ish**: `/settings/profile/card` reachable only via
   nav; account's "Public card" section links one-way.
10. **Plan & billing has no page** — the only major area that is an anchor.
11. **Naming drift**: "Security & session" (desktop) vs "Security" (mobile).
12. **Shared with me**: mobile-only entry (added by DB06 Part B) — desktop has
    no path to `/shares` from settings.
13. **Merge review**: desktop-only "Jump to" entry.
14. **Root page dual-purpose**: on mobile the root is a nav list; on desktop
    it *is* the billing page — the same URL means two different things.

## Decisions to make

### 1. The groups (the core decision)
Propose and lock a small set of top-level groups every entry maps into.
Straw-man to react to (not the answer):
- **Account** — profile, email, password, public card
- **Security** — 2FA, sessions, connected accounts, app passwords, delete
  account (danger zone last)
- **Preferences** — display, interface, phonetic names (reminder lead-time
  STAYS on Notifications — rule: a channel and its tuning live together)
- **Notifications** — category toggles, digest
- **Data & sync** — sync connections, import & export **with presets
  reunited**, books, devices/CardDAV setup
- **Sharing & groups** — shared with me, public card sharing?, family, teams
- **Plan & billing** — a real subpage (kill the anchor)
- **Developer** — stays, plan-gated
Every one of the 14 smells gets resolved by, or explicitly accepted in, the
chosen grouping.

### 1b. Per-setting relocation map (engineering-proposed 2026-07-05 — ratify or amend)
Individual settings that are in the wrong place regardless of which grouping
wins:

| Setting | Today | Proposed | Why |
| --- | --- | --- | --- |
| Password change | Account | **Security** | Auth is split (password vs 2FA/sessions); Account = identity, Security = sign-in |
| Sign-out + session card | bottom of root `#plan-billing` (!) | **Security** (sessions) | Sign-out under billing is the clearest misplacement in the app |
| Username | Account "Public card" section | **Public card page** | The username *is* the card handle; Account keeps a link row |
| Data export | Account | **Data & sync** (import/export surface) | P45 built the export system — "download your data" belongs beside it |
| Group-membership shortcut card | root billing section | **Sharing & groups** | Navigation card, not a billing control |
| Sync-provider rows in "Connected accounts" | Security | **/sync only** | Security lists sign-in methods; sync status is /sync's — currently duplicated |
| Merge review | settings nav (desktop "Jump to") | **out of settings** | Contacts-workspace tool, reachable from Duplicates; not a setting |

Judgment calls for the designer:
- **App passwords**: task-coherence (keep on the connect-a-device page) vs
  credential taxonomy (Security). Lean: keep the task page; move the
  *revocation list* to Security beside sessions; cross-link.
- **Reminder lead-time**: stays with its toggle on Notifications (rule above).
- **Books "Permission history"**: overlaps the Teams audit log — scope to
  personal books or become a pointer to the audit surface.

Explicitly fine where they are: phonetic names, display/interface prefs,
calendar feed (with reminders), product-updates toggle.

### 2. One depth rule
Everything is a **subpage** (or a section *of* one); `#plan-billing` dies.
Plan-gated rows always land on the feature's own page, which handles its
upsell state itself (Family/Teams/Developer already do exactly this).

### 3. One nav definition, both breakpoints
A single source of truth (one config consumed by the desktop sidebar and the
mobile card list — the P46-09 banner-stack move applied to navigation).
**Completeness rule: every subpage is reachable from the nav on BOTH
breakpoints** (fixes Preferences/Books/Developer on mobile, Shared-with-me on
desktop). Breakpoint-specific *presentation* is fine; breakpoint-specific
*content* is not.

### 4. Feature-boundary calls
- Presets: fold into the import/export surface (or a "presets" tab of it) —
  one home.
- Books: decide hub-owns-CRUD vs hub-is-index-pointing-to-owners; stop the
  triplication.
- Devices: rename/rescope (it's really "Connect a device / CardDAV") and
  decide its relationship to `/sync`.
- Teams: decide whether its sub-surfaces (books, permissions, audit) become
  child pages instead of one 825-line page.

### 5. Entry-point rule (user decision 2026-07-05, already applied to code)
Returning-user CTAs land on the **contact list**, never Overview — the
marketing "Open Kontax" CTAs are re-pointed to `/contacts` (done). The brief
records this as the standing rule for all future entry points; desktop
in-app wordmark → Overview stays (Overview remains a desktop surface).

## Deliverable
A brief in `roadmap/design-briefs/` (e.g. `p46-db07-settings-ia.md`)
containing: the locked group set with a **complete mapping table** (every
current page/section → its new home — nothing unmapped), the depth rule, the
single nav definition (with both breakpoints' rendering of it mocked — root
list on mobile, sidebar on desktop), the four feature-boundary decisions, the
per-smell disposition list (resolved-by / accepted-because), and mobile mocks
per DB06 chrome rules (Section header at root, labelled-back Detail on
subpages). Build tickets follow the DB06 pattern (nav unification first, then
moves).

## Out of scope
- Billing internals, plan pricing, Stripe surfaces (P19/P34F own those) — only
  *where billing lives* changes.
- Teams feature functionality (seats/permissions logic) — only its page
  structure.
- Mobile chrome rules — DB06 owns them; this brief slots into them.
