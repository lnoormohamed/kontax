# Phase 34B — User Preferences

> Adds a persistent per-user preferences layer — default sort, view mode, date
> format, name display order, and week-start day — so repeat users stop fighting
> the app's defaults on every session.

## Phase status
Pre-plan

## Phase objective
Give users fine-grained control over how Kontax looks and behaves. Preferences
are stored server-side in a new `preferences` JSON column on `User`, surfaced
through a Preferences settings section, and wired into the contacts list and
contact detail UI so they take effect automatically. The feature is entirely
display-side — it never touches storage, sync, import, or export.

## Background
Today every user starts each session with hardcoded defaults (`sort=name`,
`view=compact`, date format `DD MMM YYYY`, name order `first-last`). Power
users who want `sort=updated` or ISO date display have no way to persist that
choice. Preferences were noted as a gap during P33 planning and deferred here.

The data model is a single `Json` column rather than many nullable columns so
that new preference keys can be added without schema migrations. The TypeScript
`UserPreferences` type and `DEFAULT_PREFERENCES` constant act as the schema
contract.

## Success criteria
- A user can open Settings → Preferences, change any preference, save, and see
  the change reflected immediately without modifying a URL.
- Preferences survive logout/login and across devices.
- URL params (e.g. `?sort=updated`) still override preferences — user intent
  in the URL always wins.
- Date format preference never leaks into sync, import, or export output.

## Exit criteria
- `prisma/schema.prisma` has the `preferences` column; `db push` ran cleanly.
- `session.user.preferences` is populated in every authenticated request.
- The five preference controls all render, save, and reload correctly.
- Sort, view-mode, date format, name display order, and week-start are all
  wired to the relevant UI surfaces.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34B-01 — User preferences schema & helpers](p34b-01-user-preferences-schema.md)
> - [P34B-02 — Preferences settings UI shell](p34b-02-preferences-settings-ui.md)
> - [P34B-03 — Preference: default contact sort](p34b-03-pref-default-sort.md)
> - [P34B-04 — Preference: default view mode](p34b-04-pref-default-view-mode.md)
> - [P34B-05 — Preference: date display format](p34b-05-pref-date-format.md)
> - [P34B-06 — Preference: name display order](p34b-06-pref-name-display-order.md)
> - [P34B-07 — Preference: week starts on](p34b-07-pref-week-start.md)
> - [P34B-08 — Wire sort & view-mode preferences](p34b-08-wire-sort-view-mode.md)
> - [P34B-09 — Wire date-format preference](p34b-09-wire-date-format.md)
> - [P34B-10 — Wire name-display-order preference](p34b-10-wire-name-display-order.md)

### P34B-01 — User preferences schema & helpers
Add `preferences Json? @default("{}")` to `User` in Prisma. Define
`UserPreferences` TypeScript type and `DEFAULT_PREFERENCES` constant. Add
`getPreferences(userId)` and `updatePreferences(userId, patch)` helpers.
Expose merged preferences on `session.user.preferences`.

### P34B-02 — Preferences settings UI shell
Add a "Preferences" section to `/settings/account` (or a new sub-page). Shell
contains the section heading, description, a save button, and a "Reset to
defaults" link. Individual controls slot in via P34B-03 through P34B-07.

### P34B-03 — Preference: default contact sort
Radio group: "Name A–Z" / "Last modified". Saves to `preferences.defaultSort`.

### P34B-04 — Preference: default view mode
Segmented control or radio: "Compact" / "Cozy". Saves to
`preferences.defaultViewMode`.

### P34B-05 — Preference: date display format
Dropdown or radio: three format options. Saves to `preferences.dateFormat`.
Display-only — never affects sync/import/export.

### P34B-06 — Preference: name display order
Radio: "First Last" / "Last, First". Saves to `preferences.nameDisplayOrder`.
Only applies when both `firstName` and `lastName` exist.

### P34B-07 — Preference: week starts on
Toggle or radio: "Monday" / "Sunday". Saves to `preferences.weekStartsOn`.
Wires to DatePicker components in the contact edit form.

### P34B-08 — Wire sort & view-mode preferences
`contacts/page.tsx`: use `preferences.defaultSort` and
`preferences.defaultViewMode` as fallback when URL params `sort`/`view` are
absent. URL params always take precedence.

### P34B-09 — Wire date-format preference
Create `src/lib/dates.ts` with `formatDate(isoString, format)`. Replace all
inline date formatting in contact detail fields, activity log, and history tab.
Never call in sync/export/import paths.

### P34B-10 — Wire name-display-order preference
Create `getDisplayName(contact, prefs)` helper. Apply in contact list rows,
contact detail header, and search results. Company-only or single-name contacts
use existing logic unchanged.

## Documentation (per roadmap/documentation-policy.md)
- [x] External · users — in-app Help: "Preferences" section (what each setting does)
- [ ] External · developers — /developers: no API surface changes
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [ ] Internal · engineering — docs/: note `UserPreferences` type and merge convention
