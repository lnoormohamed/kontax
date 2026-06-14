# P34-01 — Avatar fallback: company-only contacts

## Purpose

When a contact has no `fullName` but does have a `company`, derive initials and
the tint colour from the company string so the avatar shows meaningful characters
instead of an empty disc.

## Background

`getInitials` and `tintForName` are copy-pasted across seven files and all assume
a non-empty `fullName`. When `fullName` is blank (or null) but `company` is
populated — a common CRM pattern for corporate entities — the avatar renders as a
plain tinted disc with no text. This is visually broken and ships today in
production. The fix is purely in the helper functions; no new component is needed.

The seven files that contain their own copy of `getInitials` or `tintForName` and
that accept contact `fullName` as input:

- `src/app/_components/contacts-workspace-table.tsx` — `ContactAvatar` component
- `src/app/_components/search-results.tsx` — local `ContactAvatar` copy
- `src/app/contacts/[id]/page.tsx` — hero avatar + history inline avatar
- (The remaining `getInitials` copies in `settings/layout.tsx`,
  `settings/family/page.tsx`, `settings/teams/page.tsx`, `app-shell.tsx`,
  `settings-sidebar.tsx`, `settings/_components/mobile-settings-nav.tsx` all
  operate on user account names, not contact objects, and are out of scope.)

## Scope

**In scope**
- Update `getInitials(value)` in the four contact-avatar sites to accept an
  optional fallback string: `getInitials(primary, fallback?)`. When `primary` is
  blank/null, use `fallback`.
- Update `tintForName(value)` at the same sites to also accept a fallback, so the
  tint colour is derived from the company string rather than an empty string.
- Initials derivation for company: first character of each whitespace-separated
  word, maximum 2 characters, uppercased. Examples: `"Barclays" → "B"`,
  `"General Electric" → "GE"`, `"3M Company" → "3M"`.

**Out of scope**
- Extracting the helpers into a shared module (desirable, but a separate refactor
  that risks merge conflicts; track as a follow-on).
- The truly-empty case (both `fullName` and `company` blank) — see P34-02.
- Avatar changes for user-account initials (sidebar, settings, app shell).

## Design / Implementation Spec

### Helper signature change

At each of the four affected sites, update the local `getInitials` and
`tintForName` definitions:

```ts
// Before
const getInitials = (value: string) =>
  value
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// After — accepts primary + optional company fallback
const getInitials = (primary: string | null | undefined, fallback?: string | null) => {
  const src = primary?.trim() || fallback?.trim() || "";
  return src
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const tintForName = (primary: string | null | undefined, fallback?: string | null): [string, string] => {
  const src = primary?.trim() || fallback?.trim() || "?";
  // existing hash logic unchanged, operating on `src` instead of raw `value`
};
```

### Call sites

**`contacts-workspace-table.tsx`** — `ContactAvatar` receives a contact object
with `fullName` and `company`. Update the two calls:
```ts
const [bg, fg] = tintForName(contact.fullName, contact.company);
{getInitials(contact.fullName, contact.company)}
```

**`search-results.tsx`** — same pattern; the result object exposes `fullName` and
`company`.

**`contacts/[id]/page.tsx`** — two call sites:
1. Hero avatar at line ~548: `tintForName(contact.fullName, contact.company)` and
   `getInitials(contact.fullName, contact.company)` at ~574.
2. History inline avatar at line ~743: same update.

### No new component
Do not extract a shared component in this ticket. That refactor touches many more
files and deserves its own PR with focused review.

## Acceptance Criteria
- A contact with `fullName = null` and `company = "Barclays"` shows avatar
  initials `"B"` with a deterministic tint colour derived from `"Barclays"`.
- A contact with `fullName = ""` and `company = "General Electric"` shows `"GE"`.
- A contact with `fullName = "Jane Smith"` and `company = "Acme"` still shows
  `"JS"` (primary wins).
- The above hold in: contacts list table, search results overlay, contact detail
  hero, and contact detail history list.
- No regression on contacts with populated `fullName`.

## Risks / Open Questions
- The four "contact avatar" copies of `getInitials` must all be updated; missing
  one leaves an inconsistency. A search for `tintForName` in `src/` before merging
  is the checklist.
- If a company string starts with a number (`"3M"`) the current algorithm produces
  `"3"` — acceptable, document in code comments.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [ ] Internal · engineering — docs/: note in component map that avatar helpers
      are still inline (pending extraction)
