# P34B-05 — Preference: date display format

## Purpose

Add a "Date display format" control to the Preferences form so users can choose
how calendar dates (birthday, significant dates, Added, Modified) are rendered
in the UI. This preference is display-only and must never affect data storage,
sync, import, or export.

## Background

Kontax currently renders all dates in `DD MMM YYYY` format (e.g. "14 Jun 2026")
regardless of the user's locale or preference. European users may prefer this
format, but North American users expect `MM/DD/YYYY` and developers often prefer
ISO 8601. The preference controls rendering only — vCard/CardDAV sync always
uses ISO 8601 as required by RFC 6350, and import/export parsers are similarly
locale-independent.

The wiring (replacing all inline date rendering with `formatDate(...)`) happens
in P34B-09; this ticket is the UI control and persistence only.

## Scope

**In scope**
- Add a "Date display format" labelled control to the Preferences form.
- Three options with examples:
  - `"DD MMM YYYY"` — displayed as "14 Jun 2026 (Day Month Year)"
  - `"MM/DD/YYYY"` — displayed as "06/14/2026 (Month/Day/Year)"
  - `"YYYY-MM-DD"` — displayed as "2026-06-14 (ISO)"
- Use a dropdown (`<select>`) or radio group — dropdown preferred if three or
  more options makes a radio group visually tall.
- Reads initial value from `preferences.dateFormat`.
- Included in the patch on save.
- A live preview line beneath the control showing today's date in the selected
  format (nice-to-have; skip if it adds implementation complexity).

**Out of scope**
- Applying the format to any UI surface — see P34B-09.
- Locale-detection or automatic default based on browser locale.
- Affecting vCard BDAY, sync output, import parsers, or export — these must
  always use ISO 8601 regardless of this preference.

## Design / Implementation Spec

### Control

```tsx
<div>
  <label htmlFor="dateFormat">Date display format</label>
  <select
    id="dateFormat"
    value={prefs.dateFormat}
    onChange={(e) => setPref("dateFormat", e.target.value as UserPreferences["dateFormat"])}
  >
    <option value="DD MMM YYYY">14 Jun 2026 (Day Month Year)</option>
    <option value="MM/DD/YYYY">06/14/2026 (Month/Day/Year)</option>
    <option value="YYYY-MM-DD">2026-06-14 (ISO)</option>
  </select>
</div>
```

### Safety note in code

Add a comment adjacent to the preference definition and in `src/lib/dates.ts`
(P34B-09):

```typescript
// DISPLAY ONLY — never pass this format to sync, import, or export code.
// vCard BDAY and CardDAV always use ISO 8601 (RFC 6350).
```

## Acceptance Criteria
- "Date display format" control appears in the Preferences form with three
  options.
- Selecting "06/14/2026 (Month/Day/Year)" and saving persists `"MM/DD/YYYY"`
  to `User.preferences.dateFormat`.
- Reloading the page shows the saved selection.
- "Reset to defaults" resets to "14 Jun 2026 (Day Month Year)".
- No date formatting in `src/server/`, sync routes, import routes, or export
  routes reads `preferences.dateFormat` — this is enforced by code review, not
  a runtime guard, but the comment makes intent clear.

## Risks / Open Questions
- P34B-09 is the critical dependency for this preference to have any visible
  effect. The control safely ships independently — it saves and loads but
  doesn't change any display until P34B-09 lands.
- If a third-party date library (e.g. `date-fns`, `dayjs`) is in use, P34B-09
  must use it for format conversion rather than rolling a custom formatter.
  Check the existing date handling in `src/` before starting P34B-09.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): covered by P34B-02 Preferences help
- [ ] External · developers — /developers (P29-07): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [x] Internal · engineering — docs/: add note that sync/export always use ISO 8601
      regardless of the date display preference
