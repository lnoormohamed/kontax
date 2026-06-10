# Phase 17 — Contact Detail & Create Rebuild (locked designs 02 / 03)

## Objective
Build the two contact data surfaces to their **approved, locked designs** — the contact detail page (brief `02-contact-detail.md`, LOCKED) and the create-contact form (brief `03-create-edit-contact.md`). The current pages predate these designs: the detail page is a hybrid (half old dark theme, P10 source/history bolted on, no master-detail shell or tabs) and the create page is a light card/hero layout on off-palette colours, not the flat icon-column form.

## Build order
**Like Phase 16 (list rebuild), this is foundational and sequenced by dependency, not phase number.** Specifically: **P17-02 (contact detail rebuild) must land before Phase 12's P12-05** ("Share management UI on contact detail"), because P12-05 adds the **Sharing tab** onto the detail page. Building P12-05 onto today's hybrid detail and then rebuilding would duplicate the work — the same reasoning that put Phase 16 before Phases 10–15.

- **P17-01 (Create rebuild)** has no sharing dependency (the "Save to book" selector is Phase 13, hidden for now) — build it standalone, anytime.
- **P17-02 (Detail rebuild)** delivers the locked-02 shell + inline edit + Details/History tabs + left-rail (source badge, last-edited, metadata) using already-shipped P10 features. The **Sharing tab** is a placeholder here; its content is filled by P12-05 (live/static), then extended by Phases 13 (family) and 14 (teams). The *full* 02 isn't "done" until after Phase 14, but its non-sharing core lands here.

## Design source
- `roadmap/design-briefs/02-contact-detail.md` (LOCKED) + `03-create-edit-contact.md`.
- Locked light system: ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, green `#17352e`, blue `#4158f4`, Geist.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P17-01 | Done | P1 | P8 (contact model), 03 brief |
| P17-02 | Not Started | P0 | P10 (source/history), 02 brief; **blocks P12-05** |

---

## P17-01 — Rebuild the Create Contact form (`/contacts/new`) to brief 03
- Status: `Done`
- Priority: `P1`
- Dependencies: contact model; design brief `03-create-edit-contact.md`
- Delivered:
  - New `create-contact-form.tsx` client component on the locked light palette: **flat single-column icon-column form** (no cards/hero), **Person/Organisation toggle** (org swaps to a primary Company field; `fullName` derives from name parts or company), live-initials avatar.
  - **Progressive disclosure** — core fields always visible (name, company/title, email, phone, address, birthday, notes); one global **Show more** reveals prefix/suffix/middle, phonetic first/last/company, nickname, websites, related people, significant dates, custom fields.
  - **Multi-value** email/phone/website rows (label select + input + remove + Add), serialized to the existing `createContact` contract (primary → `email`/`phone`/`website`, 2nd → `secondary*`, rest → newline `additional*`); related/dates/custom serialized as `label|value` lines.
  - **Sticky action bar** — Cancel · live title · **Save** (blue, disabled until a name or company is entered). On success the action redirects to the new contact's detail.
  - Removed the off-palette page (`#667eea`/`#e3e8f2`/`#f7f9fe`) and the marketing hero + right-rail helper. tsc + lint + build green.
- Wrapped in the persistent shell: extracted a reusable **`AppShell`** (`app-shell.tsx` — top header with wordmark + search + Create + bell + user menu, and the left sidebar nav) and rendered the create form inside it, so `/contacts/new` keeps the global header + sidebar (the missing-chrome fix). `AppShell` is reusable for P17-02 (detail) and other secondary pages.
- Deviations (follow-ups, noted): native `<select>` label pills instead of custom dropdown menus; no phone country-code selector; single structured address (not multi-address yet); no unsaved-changes modal / save-error toast. The home page still uses its own integrated shell in `contact-dashboard`; migrating it onto `AppShell` to remove the duplication is a P17-02 cleanup.
- Implementation Notes:
  - Replace the current card/hero page with the locked **flat, single-column icon-column form** (groups cued by the left icon, not section cards).
  - **Person / Organisation toggle** (org mode swaps name fields for a primary Company field).
  - **Progressive disclosure:** core fields always visible (name, company/title, email, phone, address, birthday, notes); one global **"Show more"** reveals extended fields (prefix/suffix/middle, phonetic first/last/company, nickname, websites, related people, significant dates, custom fields).
  - **Multi-value rows** for email/phone (label pill + input + remove + "Add"); serialize to the existing `createContact` contract (primary → `email`/`phone`, second → `secondary*`, rest → newline-joined `additional*`).
  - **Sticky action bar**: Cancel (left) · "New contact" title · **Save** (blue, disabled until a name or company is entered). Validation on save; on success redirect to the new contact's detail.
  - **Locked palette only** — remove the off-palette `#667eea` / `#e3e8f2` / `#f7f9fe` etc.
  - **No edit mode, no delete** here (editing is inline on the detail page per brief 02). "Save to book" selector is Phase 13 — omit/hide.
- Acceptance Criteria:
  - `/contacts/new` matches brief 03 in the locked light system; create flow works end to end (all existing fields preserved).
  - Save disabled until required name/company; validation errors shown on save.
- Risks / Open Questions:
  - The persistent app-shell wrap (sidebar) is shared with the detail rebuild — extract a reusable shell in P17-02 and adopt it here, or ship the focused form first and wrap later.

---

## P17-02 — Rebuild the Contact Detail page (`/contacts/[id]`) to locked brief 02
- Status: `Not Started`
- Priority: `P0` — **blocks Phase 12 P12-05**
- Dependencies: P10 (source tracking, per-contact history); design brief `02-contact-detail.md` (LOCKED)
- Implementation Notes:
  - **Master–detail shell**: render inside the persistent global sidebar/header (extract a reusable `AppShell` from the list's `contact-dashboard` chrome); the detail fills the content area. No standalone window.
  - **Left rail (320px):** avatar + favourite, name, title·company, birthday, the governed **badge cluster** (sharing → emergency → source, in that order), quick actions, and the metadata block (Added / Modified / UID / **Last edited by** + **Source badge**, both already built in P10).
  - **Right pane tabs: Details · Sharing · History.**
    - **Details:** inline-edit (no separate edit mode, auto-save on blur) across the section groups (Identity, Contact methods, Work, Personal, Notes, Sync).
    - **History:** the existing `ContactHistory` feed (P10-04).
    - **Sharing:** placeholder/empty-state now (count badge when shared); content delivered by P12-05 (live/static), extended by Phases 13/14.
  - **Header:** back-to-Contacts + name + **Share · Archive · ⋯** (Delete permanently in the ⋯ menu — archive-first). No standalone red Delete.
  - Restyle off-theme parts to the locked light system.
- Acceptance Criteria:
  - `/contacts/[id]` matches locked brief 02 (shell, left rail, three tabs, inline edit, archive-first header) on already-shipped data.
  - The Sharing tab exists as a gated placeholder ready for P12-05 to fill.
- Risks / Open Questions:
  - Inline-edit + auto-save-on-blur wiring across all field groups is the largest piece; reuse the existing field/server-action plumbing.
  - Extracting the reusable `AppShell` touches the list page — verify the list still renders unchanged.
