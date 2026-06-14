# P34B-08 — Wire sort & view-mode preferences

## Purpose

Make `preferences.defaultSort` and `preferences.defaultViewMode` take effect in
the contacts list by using them as the fallback when the `sort` and `view` URL
params are absent. URL params always take precedence — this ticket changes
nothing for users who bookmark URLs or set params manually.

## Background

`src/app/contacts/page.tsx` currently resolves sort and view mode like:
```typescript
const selectedSort = (searchParams.sort as WorkspaceSort) ?? "name";
const selectedView = (searchParams.view as ViewMode) ?? "compact";
```
The `?? "name"` and `?? "compact"` hardcodes should become `?? preferences.defaultSort ?? "name"`
and `?? preferences.defaultViewMode ?? "compact"` so that a user who set
`defaultSort: "updated"` in Preferences sees that as the default without a URL
param.

Depends on P34B-01 (session.user.preferences available) and P34B-03/P34B-04
(preferences are saveable).

## Scope

**In scope**
- In `src/app/contacts/page.tsx` (server component), read
  `session.user.preferences` and use it as the middle fallback for `sort` and
  `view` resolution:
  ```typescript
  const prefs = session.user.preferences;
  const selectedSort = (searchParams.sort as WorkspaceSort)
    ?? prefs.defaultSort
    ?? "name";
  const selectedView = (searchParams.view as ViewMode)
    ?? prefs.defaultViewMode
    ?? "compact";
  ```
- Ensure the URL param takes precedence (the existing `??` chain already
  handles this correctly if the param is truthy).
- Verify that `WorkspaceSort` includes `"updated"` as a valid value (or add it
  if absent).

**Out of scope**
- Changing the URL on first load to reflect the preference (do not push a param
  into the URL — let it remain clean).
- localStorage fallback interaction — if a client-side view toggle stores a
  value in localStorage, that is a separate concern; do not mix the two here.
- Mobile contacts overlay if it has its own default — check and note in code
  comments whether it needs the same change.

## Design / Implementation Spec

### Precedence order

```
URL param → user preference → hardcoded default
```

This is intentional: a user who clicks the sort toggle (which sets a URL param)
overrides their preference for that session. If they navigate to `/contacts`
with no params, the preference applies.

### Session access

The contacts page is a server component and already calls `getServerSession()`.
Extend the session read:
```typescript
const session = await getServerSession(authOptions);
const prefs = session?.user?.preferences ?? DEFAULT_PREFERENCES;
```

### Type guards

`searchParams.sort` is `string | string[] | undefined`. The existing cast
`as WorkspaceSort` is only safe if the value is in the allowed set. Add a
runtime guard if one doesn't already exist:
```typescript
const VALID_SORTS = ["name", "updated"] as const;
const rawSort = Array.isArray(searchParams.sort)
  ? searchParams.sort[0]
  : searchParams.sort;
const selectedSort = (VALID_SORTS.includes(rawSort as WorkspaceSort)
  ? rawSort as WorkspaceSort
  : undefined)
  ?? prefs.defaultSort
  ?? "name";
```

## Acceptance Criteria
- A user with `defaultSort: "updated"` who navigates to `/contacts` (no params)
  sees the list sorted by last modified.
- A user with `defaultSort: "updated"` who navigates to `/contacts?sort=name`
  sees the list sorted by name (URL param wins).
- A user with no preference set (or `DEFAULT_PREFERENCES`) sees the list sorted
  by name (existing behaviour unchanged).
- Same behaviour for view mode: `defaultViewMode: "cozy"` + no URL param →
  cozy view; URL param `?view=compact` → compact view regardless of preference.
- No TypeScript errors introduced; `WorkspaceSort` type is accurate.

## Risks / Open Questions
- If `"updated"` is not currently a valid `WorkspaceSort` value, the sort logic
  downstream must handle it. Verify the full sort switch/case before shipping.
- If the contacts page has multiple entry points (mobile overlay route), each
  must be updated consistently. Check `src/app/api/contacts/` for any route
  that also applies sort/view defaults.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): covered by P34B-02 Preferences help
- [ ] External · developers — /developers (P29-07): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [x] Internal · engineering — docs/: note URL > preference > hardcoded default
      precedence in the contacts page architecture doc (if one exists)
