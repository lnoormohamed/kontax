# P34B-02 — Preferences settings UI shell

## Purpose

Add a "Preferences" section to the settings area so users have a place to view
and save their personal UI preferences. This ticket delivers the shell only —
the heading, description, form wrapper, save button, and "Reset to defaults"
link. Individual preference controls are slotted in by P34B-03 through P34B-07.

## Background

Phase 34B adds five user preferences (sort, view mode, date format, name
display order, week start). All five will live in a single Preferences form so
users can review and adjust them in one place, then save in one action. The
shell must be in place before any preference control ticket can be built.

Decide during implementation whether to add Preferences as a new section
within the existing `/settings/account` page (simplest — one fewer route) or
as a dedicated `/settings/preferences` sub-page (cleaner separation). Check
where Account settings currently live and follow the existing sub-page pattern
if one already exists; otherwise add a section to `/settings/account`.

## Scope

**In scope**
- Section heading: "Preferences".
- Brief description below the heading: "Customise how Kontax looks and behaves."
- A `<form>` wrapper that will contain preference controls from later tickets.
- A primary "Save preferences" button. On click, calls `updatePreferences`
  server action with the current form values.
- A "Reset to defaults" text link/button. On click, calls `updatePreferences`
  with `DEFAULT_PREFERENCES` and reloads the form.
- Success toast on successful save ("Preferences saved").
- Error state if save fails (inline error message near the save button).
- Load current values from `session.user.preferences` (available after P34B-01).

**Out of scope**
- The actual preference controls (P34B-03 through P34B-07).
- Any change to navigation links — add a nav link to Preferences only after
  deciding the route in this ticket (and update the settings sidebar/nav).

## Design / Implementation Spec

### Route decision

Check `src/app/settings/` for existing sub-page structure. If sub-pages exist
as `settings/account/page.tsx`, `settings/sync/page.tsx`, etc., create
`settings/preferences/page.tsx` and add a nav item. If the settings area is a
single page with sections, add a `<PreferencesSection>` component to it.

### Form state

Use a client component (`"use client"`) for the form. Initialise local state
from `session.user.preferences` passed as a prop from the server component.
On save, call the `updatePreferences` server action via `useTransition` (or
`useFormState` if using React 19 form actions).

```tsx
// Shell structure — preference controls slot into {children} or named sections
<section>
  <h2>Preferences</h2>
  <p>Customise how Kontax looks and behaves.</p>
  <form action={handleSave}>
    {/* P34B-03 through P34B-07 slot in here */}
    <div>
      <Button type="submit">Save preferences</Button>
      <button type="button" onClick={handleReset}>Reset to defaults</button>
    </div>
  </form>
</section>
```

### Save flow
1. User edits controls, clicks "Save preferences".
2. Form calls `updatePreferences(patch)`.
3. On success: show toast "Preferences saved". Update local state to reflect
   the saved values.
4. On error: show inline error message "Failed to save preferences. Try again."

### Reset flow
1. User clicks "Reset to defaults".
2. Call `updatePreferences(DEFAULT_PREFERENCES)`.
3. Re-initialise form state from `DEFAULT_PREFERENCES`.
4. Show toast "Preferences reset to defaults".

## Acceptance Criteria
- A "Preferences" section or sub-page exists in the settings area.
- The section renders the heading, description, an empty form, save button, and
  reset link with no preference controls (they come in later tickets).
- Clicking "Save preferences" on the empty shell calls `updatePreferences` and
  shows the success toast.
- Clicking "Reset to defaults" calls `updatePreferences(DEFAULT_PREFERENCES)`
  and shows the toast.
- Form loads with values from `session.user.preferences` (verified by manually
  editing the DB and reloading the page).
- If `updatePreferences` throws, an inline error message is shown (not a toast).

## Risks / Open Questions
- **Route vs. section decision**: decide before starting implementation. Check
  whether the existing settings navigation supports sub-pages or sections; match
  the existing pattern to avoid nav debt.
- `useTransition` vs. React 19 form actions: check what the rest of the settings
  pages use and be consistent.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (P26-12): add "Preferences" to help index
- [ ] External · developers — /developers (P29-07): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [ ] Internal · engineering — docs/: none required
