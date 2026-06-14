# P34B-06 — Preference: name display order

## Purpose

Add a "Contact name display" control to the Preferences form so users can
choose whether contact names are shown as "First Last" or "Last, First" in the
contacts list, contact detail header, and search results.

## Background

Contact name display order is a cultural preference: Western users expect "John
Smith" while many East Asian and formal contexts expect "Smith, John". Kontax
currently always renders `fullName` as stored, which is `firstName + " " +
lastName`. Introducing a display-order preference lets each user see names the
way they find natural. Storage is unaffected — `firstName` and `lastName`
remain separate fields in the DB.

The wiring (applying the preference to all display-name derivations) happens in
P34B-10; this ticket is UI control and persistence only.

## Scope

**In scope**
- Add a "Contact name display" labelled radio group to the Preferences form.
- Two options with examples:
  - "First Last" (value: `"first-last"`) — e.g. "John Smith"
  - "Last, First" (value: `"last-first"`) — e.g. "Smith, John"
- Reads initial value from `preferences.nameDisplayOrder`.
- Included in the patch on save.

**Out of scope**
- Applying the preference to any UI surface — see P34B-10.
- Contacts that have only one name part, company-only contacts, or contacts with
  neither name part — these are always unchanged regardless of this preference.
- Storage, sync, import, or export — display only.

## Design / Implementation Spec

### Control

```tsx
<fieldset>
  <legend>Contact name display</legend>
  <label>
    <input
      type="radio"
      name="nameDisplayOrder"
      value="first-last"
      checked={prefs.nameDisplayOrder === "first-last"}
      onChange={() => setPref("nameDisplayOrder", "first-last")}
    />
    First Last <span>(e.g. John Smith)</span>
  </label>
  <label>
    <input
      type="radio"
      name="nameDisplayOrder"
      value="last-first"
      checked={prefs.nameDisplayOrder === "last-first"}
      onChange={() => setPref("nameDisplayOrder", "last-first")}
    />
    Last, First <span>(e.g. Smith, John)</span>
  </label>
</fieldset>
```

The example text (in a `<span>` or secondary style) helps users immediately
understand the effect without needing to save and navigate to the contacts list.

### Scope of effect (documented for P34B-10)

This preference only changes the display name when **both** `firstName` and
`lastName` are non-empty. Single-part names, company-only contacts, and contacts
where `fullName` is derived differently continue to render as before.

## Acceptance Criteria
- "Contact name display" radio group appears in the Preferences form with two
  labelled options including examples.
- Selecting "Last, First" and saving persists `"last-first"` to
  `User.preferences.nameDisplayOrder`.
- Reloading the page shows the saved selection.
- "Reset to defaults" resets to "First Last".

## Risks / Open Questions
- P34B-10 is the dependency for any visible effect. This control is safe to
  ship before P34B-10.
- If `fullName` is stored denormalized (as a single string without separate
  `firstName`/`lastName`), P34B-10 cannot reliably reverse the order. Check
  the Prisma schema — if `firstName` and `lastName` are separate columns, this
  is straightforward; if not, P34B-10 may need to fall back to regex splitting.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): covered by P34B-02 Preferences help
- [ ] External · developers — /developers (P29-07): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [ ] Internal · engineering — docs/: none required
