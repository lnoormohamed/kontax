# P34B-10 — Wire name-display-order preference

## Purpose

Apply `preferences.nameDisplayOrder` to every UI surface that renders a contact
display name, replacing the current ad-hoc derivations with a single
`getDisplayName(contact, prefs)` helper so that "Last, First" mode works
consistently across the contacts list, contact detail header, and search results.

## Background

Contact names are currently derived inline at each rendering site: most use
`contact.fullName` directly, some concatenate `firstName + " " + lastName`.
There is no central function, so a display-order preference would need to be
applied at every site individually, risking inconsistency. P34B-06 added the
control and persistence; this ticket centralises name derivation and applies the
preference.

The preference only applies when **both** `firstName` and `lastName` are set on
a contact. Company-only contacts, contacts with only one name part, and contacts
where name is stored only as a monolithic `fullName` (without `firstName` /
`lastName` split) continue to use existing logic.

## Scope

**In scope**
- Create `src/lib/display-name.ts` with:
  ```typescript
  import type { UserPreferences } from "~/types/preferences";

  type NameFields = {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    company?: string | null;
  };

  export function getDisplayName(
    contact: NameFields,
    prefs: Pick<UserPreferences, "nameDisplayOrder">,
  ): string {
    const first = contact.firstName?.trim();
    const last = contact.lastName?.trim();
    if (first && last) {
      return prefs.nameDisplayOrder === "last-first"
        ? `${last}, ${first}`
        : `${first} ${last}`;
    }
    // Single name part, fullName, or company fallback
    return contact.fullName?.trim()
      || contact.company?.trim()
      || "";
  }
  ```
- Replace ad-hoc display-name derivations at:
  - Contact list rows (`ContactRow` or `ContactAvatar` name rendering in
    `contacts-workspace-table.tsx`)
  - Contact detail header (hero name in `contacts/[id]/page.tsx`)
  - Search results name display (`search-results.tsx`)
- Pass `preferences.nameDisplayOrder` from the nearest server component as a
  prop. Do not call `getPreferences` from client components.

**Out of scope**
- Company-only contacts — unaffected.
- Contacts with no `firstName`/`lastName` split — fall back to `fullName`.
- Storage, sync, import, or export — display only.
- Sorting — sort order is by stored name, not display name.

## Design / Implementation Spec

### Prop threading

The contacts page server component reads `session.user.preferences` and passes
`nameDisplayOrder` down to child components:

```tsx
// contacts/page.tsx (server component)
const prefs = session.user.preferences;

// Child component call
<ContactsTable contacts={contacts} nameDisplayOrder={prefs.nameDisplayOrder} />
```

Within `ContactsTable`, thread `nameDisplayOrder` into each `ContactRow` and
use `getDisplayName(contact, { nameDisplayOrder })` wherever the contact name
is rendered.

### Finding all call sites

Before starting, grep for contact-name rendering patterns:
```bash
grep -rn "fullName\|firstName.*lastName\|lastName.*firstName" src/app/ --include="*.tsx" | grep -v "schema\|prisma\|type\|interface"
```
Review each hit; replace display-side derivations, leave data/model references.

### Sorting unaffected

The sort logic (P34B-08) orders contacts by the stored `fullName` field, not the
display name returned by `getDisplayName`. This is intentional and correct — do
not change sort keys.

## Acceptance Criteria
- A contact with `firstName="John"`, `lastName="Smith"` and `nameDisplayOrder:
  "last-first"` renders as "Smith, John" in: contacts list, contact detail
  header, and search results.
- Same contact with `nameDisplayOrder: "first-last"` (default) renders as
  "John Smith" — existing behaviour unchanged.
- A contact with only `firstName="Alice"` (no `lastName`) renders as "Alice"
  regardless of the preference.
- A company-only contact renders the company name regardless of the preference.
- `getDisplayName` is the sole source of display name derivation across all
  affected surfaces — no ad-hoc `firstName + " " + lastName` concatenations
  remain at those sites.

## Risks / Open Questions
- If the search results component receives pre-formatted `displayName` strings
  from the server (rather than `firstName`/`lastName` separately), the
  preference cannot be applied without changing the search query shape. Check
  what fields the search result type exposes before starting.
- `ContactRow` may be used in contexts beyond the contacts list (e.g. merge UI,
  share UI) — verify `nameDisplayOrder` prop addition doesn't break those
  usages.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): covered by P34B-02 Preferences help
- [ ] External · developers — /developers (P29-07): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [x] Internal · engineering — docs/: add `getDisplayName` to the utility
      functions index; note that sort is by stored name, not display name
