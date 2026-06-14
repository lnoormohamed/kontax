# P34B-09 — Wire date-format preference

## Purpose

Replace all ad-hoc date formatting in the UI with a central `formatDate`
utility that respects `preferences.dateFormat`, so changing the preference
in settings immediately affects every date display in Kontax.

## Background

Dates are currently formatted inline at each call site — often using
`new Date(x).toLocaleDateString(...)` or a one-off string interpolation. There
is no central formatter, so changing date display requires touching many files.
P34B-05 added the preference control; this ticket wires it by centralising all
UI date formatting through `src/lib/dates.ts`.

This is a display-only change. vCard BDAY, CardDAV sync, import parsers, and
export functions always use ISO 8601 and must not be modified by this ticket.

## Scope

**In scope**
- Create `src/lib/dates.ts` with:
  ```typescript
  import type { UserPreferences } from "~/types/preferences";

  /**
   * DISPLAY ONLY — never use in sync, import, or export code paths.
   * vCard/CardDAV always use ISO 8601 (RFC 6350).
   */
  export function formatDate(
    isoString: string | null | undefined,
    format: UserPreferences["dateFormat"] = "DD MMM YYYY",
  ): string {
    if (!isoString) return "";
    // parse YYYY-MM-DD or ISO 8601 datetime
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString; // fallback: return raw string
    switch (format) {
      case "MM/DD/YYYY":
        return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
      case "YYYY-MM-DD":
        return isoString.slice(0, 10); // already ISO, just truncate to date
      case "DD MMM YYYY":
      default:
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  ```
  Use an existing date library (`date-fns`, `dayjs`) if it is already a
  dependency — check `package.json` first and prefer it over manual formatting.
- Replace all UI-facing date rendering in:
  - Contact detail fields: "Added", "Modified" (contact metadata)
  - Birthday field display (read mode)
  - Significant dates field display (read mode)
  - Activity log timestamp formatting (date portion only — keep time formatting
    unchanged if times are displayed separately)
  - History tab timestamps (date portion)
- Pass `preferences.dateFormat` from the nearest server component down as a
  prop. Do not call `getPreferences` from client components — accept it as a
  prop.

**Out of scope**
- Time formatting (HH:mm) — leave unchanged.
- Any date in sync routes (`src/app/api/cardDAV/`, `/api/google-sync/`, etc.).
- Any date in import/export handlers.
- Date pickers (input mode) — these use the raw ISO value internally.

## Design / Implementation Spec

### Call site pattern

Server components that render dates receive `session.user.preferences` and pass
`preferences.dateFormat` down:

```tsx
// Server component
const prefs = session.user.preferences;
return <ContactDetail contact={contact} dateFormat={prefs.dateFormat} />;

// Client/shared component
<span>{formatDate(contact.createdAt, dateFormat)}</span>
```

### Finding all call sites

Before starting, grep for existing date formatting patterns:
```bash
grep -rn "toLocaleDateString\|new Date.*format\|YYYY\|DD MMM" src/app/ --include="*.tsx"
```
Review each hit and determine if it is UI-facing (replace) or data/sync-facing
(leave alone).

## Acceptance Criteria
- `src/lib/dates.ts` exists with `formatDate` exported and documented with the
  display-only warning comment.
- With `dateFormat: "MM/DD/YYYY"`, a birthday of `1985-07-14` renders as
  "07/14/1985" in the contact detail view.
- With `dateFormat: "YYYY-MM-DD"`, the same birthday renders as "1985-07-14".
- With `dateFormat: "DD MMM YYYY"` (default), it renders as "14 Jul 1985".
- No date in sync, import, or export code reads `preferences.dateFormat`.
- TypeScript compilation passes; `formatDate` is not called with an untyped
  `format` argument anywhere.
- `null` and `undefined` input to `formatDate` returns `""` (no crash).

## Risks / Open Questions
- Timezone handling: `new Date("1985-07-14")` parses as UTC midnight, then
  `.toLocaleDateString` may shift the date by one day in negative-UTC-offset
  timezones. Use `new Date(isoString + "T12:00:00Z")` or parse the date parts
  directly to avoid timezone shift on date-only strings.
- If `date-fns` is available, use `format(parseISO(isoString), formatStr)`
  which handles this correctly. Check dependencies before rolling custom code.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): covered by P34B-02 Preferences help
- [ ] External · developers — /developers (P29-07): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [x] Internal · engineering — docs/: document `formatDate` and the sync/export
      exemption in the utility functions index
