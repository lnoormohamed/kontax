# 14 — Teams Plan Surfaces

**Surfaces:**
- **Onboarding / management** — `/settings/teams` (create team · members + roles · address books · per-book permissions · sync accounts · delete) + the Team entry on `/settings`
- **Audit log** — `/settings/teams/audit` (filterable table + CSV export)
- **Invite acceptance** — `/teams/join/[token]` + the invite email
- **Workspace** — team-book contacts in the People list with a **team badge**, the **All / Private / Shared** scope toggle, the sidebar **Shared books** list (each team book), and the **Save to → {team book}** target on Create
- **Contact detail (team)** — a **team-book chip** ("{Team} · {Book}") and shared change History with member attribution

**Priority:** P2 — the visual/IA layer over the shipped Phase 14 engine (P14-01→07).

> **Status: AS-BUILT (2026-06).** Phase 14 core is shipped; this brief documents real behaviour so hi-fi mockups match, then refine. It deliberately distinguishes **admin** (owner/admin) vs **member** views, and must accommodate a user who belongs to **both a Family group and a Team** without confusion. Teams should feel **professional and trust-inspiring** — slightly denser/more utilitarian than the personal Kontax brand, same locked light system: ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, surface `#f2f4f0`, brand green `#17352e`, CTA blue `#4158f4`, amber `#bf8526`, red `#b5472f`, Geist.

---

## Model recap (fixed vocabulary)

A **team** (Teams plan) has **multiple address books** and up to **25 members**. Roles: **Owner** (one; transfers only) · **Admin** (manage members, books, permissions, sync) · **Member** (per-book access). Per-book permission per member: **Edit / View / None** (default Edit; managers always Edit; None hides the book). A team contact is a `Contact` linked into a book via `GroupContact`, owned (nominally) by the team owner, edit-gated by per-book permission. Books can be **archived** (read-only, hidden by default). Every team-book change is recorded with **TEAM_MEMBER** attribution ("[Member] · [Team] · [Book]").

---

## ADMIN VIEW (owner/admin)

### 1. Settings entry
On `/settings`, the Teams plan card → **Set up team** / **Manage team** (`/settings/teams`).

### 2. Create team (empty state)
Name + optional description → creates the team (owner = creator) and a first book ("Team contacts"). Non-Teams plan reaching the route sees an upgrade card.

### 3. Manage team (the management page)
Currently a single scrolling page; **the target is a tabbed layout**: **Members · Address Books · Sync Accounts · Audit Log**. Sections:

**a) Members** — count "{n} of 25". Per row: name/email · joined date · status word (Owner / Admin / Member / Pending / Declined). Actions: **Make admin / Make member** (only owner promotes to admin), **Resend** (pending), **Remove/Revoke**. Owner row has no actions.

**b) Address Books** — list each book (name · description · "archived" tag). Actions: **Archive/Restore**, **Delete** (soft-archives its contacts). A create row (name + description → Add book).

**c) Book permissions** — a **matrix**: members (rows) × books (columns), each cell an **Edit / View / None** control (currently per-member inline toggle groups — a matrix table is the design upgrade). Owners/admins shown as full-access, non-editable.

**d) Sync accounts** — link an admin's connected CardDAV account → a team book; list current links ("{account} → {book}") with **Unlink**; pointer to `/sync` to connect a new account.

**e) Audit log** — link to `/settings/teams/audit`.

**f) Delete team (danger)** — reveal-then-confirm; deletes books + their contacts for everyone; members keep private contacts.

> **Owner transfer** is **not built** (subscription is `userId`-anchored — billing sign-off needed). Leave room for a "Make owner" action on admin rows.

### 4. Audit log — `/settings/teams/audit`
Filter bar: **member · book · event type · date range** (+ Clear). Table: **When · Member · Event (+field count) · Contact · Book**, "Load older" pagination, **Export CSV** button. Unlimited retention. Design the row for scannability and a future inline diff expander.

---

## MEMBER VIEW

### 5. Member team settings
`/settings/teams` (non-admin): read card — team name, "Run by {owner}", **your role** ("Admin" / "Member · can edit" / "Member · view only"), and **Leave team** (red, immediate — removes team access only, private contacts untouched).

### 6. Invite acceptance — `/teams/join/[token]`
"Team invitation · Join {team}" + "{owner} invited you…", **Accept & join** (blue) / **Decline**. Invalid/expired → calm message. Logged-out → routed through login/register with `?next=` return; pending invite links on registration.

---

## WORKSPACE (admin + member)

- **Team contacts** appear in the People list alongside private + family contacts, distinguished by the **team badge** in the inline `ContactBadgeCluster` (team glyph). The **scope toggle** is **All / Private / Shared**; the sidebar **Shared books** section lists the family book and each accessible team book (→ `?book=<id>` filtered view). Books a member is **None** on never appear.
- **Create** shows a **Save to → Private / {Family} / {Team book…}** target (only books the member can edit).
- **Contact detail** for a team contact shows the **team-book chip** ("{Team} · {Book}") and the full attributed History.
- A user in **both** a Family group and a Team sees: Private · Family book · each Team book — the sidebar "Shared books" list + the badge glyphs must keep these visually distinct. **Strong hierarchy is required from the start.**

---

## States to design
- Admin: no team / one book / many books (5+) / archived books / members at every role + pending/declined.
- Permission matrix: dense layout for 25 members × N books; None-hidden books.
- Member: edit vs view-only vs None-on-some-books; view-only must show disabled affordances, not hidden-then-failing.
- Audit: empty, filtered, large (paginated), CSV.
- Combined Family + Team user (the four-scope case).
- Destructive: delete team, delete book, remove member, leave team.

## Open questions for the designer
- Best layout for the **per-book permission matrix** at 25×N (sticky headers? collapsible?).
- Workspace **hierarchy** for the four-scope user (Private / Family / Team A / Team B) — sections vs nested sidebar vs tabs.
- Mobile treatment of the management page tabs + the matrix.
- Owner-transfer UI (deferred) — sketch so it's ready when billing is confirmed.
- Inline **diff expander** in the audit row (timestamp · member avatar · summary · expand).
