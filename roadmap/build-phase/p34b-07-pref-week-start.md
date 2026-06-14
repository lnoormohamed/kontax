# P34B-07 — Preference: week starts on

## Purpose

Add a "Week starts on" control to the Preferences form so users can choose
whether calendar grids in date pickers start on Monday (ISO standard) or Sunday
(North American convention). The preference wires directly to any `DatePicker`
component used in the contact edit form.

## Background

Kontax's contact edit form has at least one date picker (birthday field) and
potentially additional date pickers for significant dates. These date pickers
render a calendar grid. The week start day for that grid is currently hardcoded.
Users outside the default locale expect their calendar to start on the correct
day. This is the only preference in Phase 34B that has an immediate UI effect
in the same ticket — the date picker can be wired here rather than in a separate
wiring ticket, since the scope is narrow.

## Scope

**In scope**
- Add a "Week starts on" labelled toggle or radio group to the Preferences form.
- Two options: "Monday" (value: `1`) and "Sunday" (value: `0`), matching the
  JavaScript `Date.getDay()` / `date-fns` convention.
- Reads initial value from `preferences.weekStartsOn` (default: `1`).
- Included in the patch on save.
- Wire `weekStartsOn` to the `weekStartsOn` (or equivalent) prop of all
  `DatePicker` components in the contact edit form. Pass the preference value
  from the server component or context.

**Out of scope**
- Any calendar or scheduling feature beyond date picker grids.
- Week-number display or ISO week numbering.
- Relative date calculations — only the calendar grid start day.

## Design / Implementation Spec

### Control

```tsx
<fieldset>
  <legend>Week starts on</legend>
  <label>
    <input
      type="radio"
      name="weekStartsOn"
      value={1}
      checked={prefs.weekStartsOn === 1}
      onChange={() => setPref("weekStartsOn", 1)}
    />
    Monday
  </label>
  <label>
    <input
      type="radio"
      name="weekStartsOn"
      value={0}
      checked={prefs.weekStartsOn === 0}
      onChange={() => setPref("weekStartsOn", 0)}
    />
    Sunday
  </label>
</fieldset>
```

### DatePicker wiring

Identify all `DatePicker` (or calendar input) components used in:
- `src/app/contacts/[id]/edit/` (or wherever the contact edit form lives)
- Any significant-dates fields

Pass `weekStartsOn={preferences.weekStartsOn}` as a prop. If the date picker
library uses a different prop name, check the library docs (e.g. `react-day-picker`
uses `weekStartsOn`, `date-fns` `startOfWeek` accepts `{ weekStartsOn }`).

The preferences value must be passed from the server component to the client
component. If the edit form is already a client component, accept preferences
as a prop from its parent server component.

### Type note

`weekStartsOn` is `0 | 1`, not `number`. Ensure the prop type matches what the
date picker library expects — most accept `0 | 1 | 2 | 3 | 4 | 5 | 6`; passing
`0` or `1` is always safe.

## Acceptance Criteria
- "Week starts on" radio group appears in Preferences with "Monday" and "Sunday"
  options.
- Selecting "Sunday" and saving persists `0` to `User.preferences.weekStartsOn`.
- Reloading the page shows the saved selection.
- "Reset to defaults" resets to "Monday".
- With "Sunday" set, opening a birthday date picker shows Sunday as the first
  column of the calendar grid.
- With "Monday" set (default), Monday is the first column.

## Risks / Open Questions
- If the date picker library doesn't expose a `weekStartsOn` prop, this wiring
  may require patching the calendar render directly. Check before starting.
- If there are multiple date picker components, ensure all are updated — a
  grep for `DatePicker` (or the actual component name) in `src/` before merging
  is the checklist step.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): covered by P34B-02 Preferences help
- [ ] External · developers — /developers (P29-07): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [ ] Internal · engineering — docs/: none required
