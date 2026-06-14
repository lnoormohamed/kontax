# P34B-03 — Preference: default contact sort

## Purpose

Add a "Default contact sort" control to the Preferences form so users can
choose whether the contacts list defaults to alphabetical order or most-recently
modified, without having to change the URL on every session.

## Background

The contacts list currently hardcodes `sort=name` as its default. Users who
prefer `sort=updated` (newest modified first) must either bookmark a URL with
the param or re-select on every visit. This is the first new preference control
to slot into the P34B-02 shell. The wiring to the contacts list happens in
P34B-08 — this ticket is UI + persistence only.

## Scope

**In scope**
- Add a "Default contact sort" labelled radio group to the Preferences form
  (inside the P34B-02 shell).
- Two options: "Name A–Z" (value: `"name"`) and "Last modified" (value:
  `"updated"`).
- Reads initial value from `preferences.defaultSort` (falls back to `"name"`
  via `DEFAULT_PREFERENCES`).
- On form save (P34B-02 save button), includes `defaultSort` in the patch
  passed to `updatePreferences`.

**Out of scope**
- Wiring the preference to `contacts/page.tsx` — see P34B-08.
- Any other sort options (e.g. first name, last name separately) — not in scope
  for this phase.

## Design / Implementation Spec

### Control

```tsx
<fieldset>
  <legend>Default contact sort</legend>
  <label>
    <input
      type="radio"
      name="defaultSort"
      value="name"
      checked={prefs.defaultSort === "name"}
      onChange={() => setPref("defaultSort", "name")}
    />
    Name A–Z
  </label>
  <label>
    <input
      type="radio"
      name="defaultSort"
      value="updated"
      checked={prefs.defaultSort === "updated"}
      onChange={() => setPref("defaultSort", "updated")}
    />
    Last modified
  </label>
</fieldset>
```

Style to match existing radio group patterns in the settings area. The control
slots in as the first item in the Preferences form (above view mode).

### State wiring

The parent Preferences form component (from P34B-02) manages a local
`prefs` state object. This control reads and writes `prefs.defaultSort`. No
separate local state inside the control.

## Acceptance Criteria
- "Default contact sort" radio group appears in the Preferences form with
  two options: "Name A–Z" and "Last modified".
- Selecting "Last modified" and saving persists `"updated"` to
  `User.preferences.defaultSort`.
- Reloading the Preferences page shows the saved selection pre-selected.
- "Reset to defaults" resets the control to "Name A–Z".
- TypeScript: the `value` type is `"name" | "updated"` — no string literals
  or untyped values.

## Risks / Open Questions
- Wiring (P34B-08) must land before the preference has any visible effect in
  the contacts list. This ticket is safe to ship before P34B-08 — the control
  will save and load correctly even without the contacts-list wire-up.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): covered by P34B-02 Preferences help
- [ ] External · developers — /developers (P29-07): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [ ] Internal · engineering — docs/: none required
