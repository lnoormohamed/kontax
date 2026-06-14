# P34B-04 — Preference: default view mode

## Purpose

Add a "Default view mode" control to the Preferences form so users can choose
between Compact and Cozy contact list density as a persistent preference rather
than resetting it on every session.

## Background

The contacts list supports two display densities: Compact (smaller rows, more
contacts visible) and Cozy (larger rows, more whitespace). The active mode is
currently driven by the `view` URL param, defaulting to `"compact"`. Users who
prefer Cozy have no way to persist that choice. This control saves
`preferences.defaultViewMode`; wiring to the list is in P34B-08.

## Scope

**In scope**
- Add a "Default view mode" labelled control to the Preferences form.
- Two options: "Compact" (value: `"compact"`) and "Cozy" (value: `"cozy"`).
- Use a segmented control (button group) if the design system has one; otherwise
  a radio group. Match the style of the in-list toggle if one exists.
- Reads initial value from `preferences.defaultViewMode`.
- Included in the patch on save.

**Out of scope**
- Wiring to the contacts list — see P34B-08.
- Adding new density modes (e.g. "Comfortable") — not in scope.

## Design / Implementation Spec

### Control

Prefer a segmented button group over a radio group for this control — it maps
well to a two-way toggle and is visually compact:

```tsx
<div>
  <label>Default view mode</label>
  <div role="group">
    <button
      type="button"
      aria-pressed={prefs.defaultViewMode === "compact"}
      onClick={() => setPref("defaultViewMode", "compact")}
    >
      Compact
    </button>
    <button
      type="button"
      aria-pressed={prefs.defaultViewMode === "cozy"}
      onClick={() => setPref("defaultViewMode", "cozy")}
    >
      Cozy
    </button>
  </div>
</div>
```

If the design system lacks a segmented control, fall back to a radio group
matching the P34B-03 pattern.

### State wiring

Managed by the parent Preferences form; this control reads and writes
`prefs.defaultViewMode`. No local state inside the control.

## Acceptance Criteria
- "Default view mode" control appears in the Preferences form with "Compact"
  and "Cozy" options.
- Selecting "Cozy" and saving persists `"cozy"` to
  `User.preferences.defaultViewMode`.
- Reloading the page shows the saved selection active.
- "Reset to defaults" resets the control to "Compact".
- The active option is visually distinguishable from the inactive option
  (selected state styling).

## Risks / Open Questions
- If the in-list view-mode toggle stores a value in localStorage as well as the
  URL param, P34B-08 must decide the precedence order: URL > localStorage >
  preference. Resolve this in P34B-08, not here.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): covered by P34B-02 Preferences help
- [ ] External · developers — /developers (P29-07): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [ ] Internal · engineering — docs/: none required
