# P34A-08 — Expandable Side-by-Side Field Comparison on Duplicate Card

## Purpose

Add a "Compare fields" expand toggle on each merge suggestion card in the
duplicates list so users can compare two contacts field-by-field without
navigating to the full review page — enabling faster triage.

## Background

The merge suggestion card (located in the duplicates tab of
`/?tab=duplicates`) currently shows two contact names, signal chips (P34A-07),
confidence badge, and action buttons. The full field-level comparison is only
available on the review page `/merge-suggestions/[id]`.

For high-volume deduplication (users with 50+ suggestions), the context
switch to the review page for every card is friction. An inline expandable
comparison panel lets the user decide "obvious merge" vs "needs careful
review" at the list level.

## Scope

**In scope**
- An expand/collapse toggle button on each suggestion card: "Compare fields ↓"
  (collapsed) / "Compare fields ↑" (expanded). Collapsed by default.
- Expanded state: a two-column table (Contact A | Contact B) with field
  name in the left margin.
- Differing values: row highlighted with `#fff0bf` background.
- Matching values: muted text `#8b938c`.
- Fields to compare: name, email, phone, company, title, address, birthday,
  notes (truncate notes to 80 chars with "…").
- Mobile: stacked layout — field name above, then Contact A value, then
  Contact B value, no horizontal two-column table.

**Out of scope**
- Conflict resolution (that happens on the review page).
- Editing from the inline comparison.
- Custom fields (defer to Phase 35+).

## Design / Implementation Spec

### Data loading

The suggestion card currently receives a `PersistedMergeSuggestion` shape.
Extend it to include both contacts' field values:

```ts
type SuggestionContact = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
  // address as a formatted single string for display
  addressDisplay: string | null;
  birthday: string | null;   // ISO date or null
};

type PersistedMergeSuggestion = {
  // ... existing fields ...
  contactA: SuggestionContact;
  contactB: SuggestionContact;
};
```

The duplicates list query already fetches both contacts. Extend the SELECT to
include the fields above. This avoids a separate API call on expand.

### Expand/collapse toggle

```tsx
const [expanded, setExpanded] = useState(false);

<button
  className="mt-2 flex items-center gap-1 text-[12.5px] font-medium text-[#4158f4] hover:underline"
  onClick={() => setExpanded((e) => !e)}
  type="button"
>
  Compare fields {expanded ? "↑" : "↓"}
</button>
```

The panel opens with a smooth height transition:
```tsx
<div
  className="overflow-hidden transition-all duration-200"
  style={{ maxHeight: expanded ? "800px" : "0px" }}
>
  <ComparisonTable a={suggestion.contactA} b={suggestion.contactB} />
</div>
```

### ComparisonTable (desktop)

```
┌─────────────────────────────────────────────────────┐
│ Field       │ Contact A            │ Contact B       │
├─────────────┼──────────────────────┼─────────────────┤
│ Name        │ John Appleseed       │ Jon Appleseed   │  ← diff row: #fff0bf bg
│ Email       │ j@x.com              │ j@x.com         │  ← match: muted text
│ Phone       │ +44 7700 900111      │ 07700 900111    │  ← diff (display differs)
│ Company     │ —                    │ Acme Corp       │  ← diff
│ Notes       │ Met at conf…         │ —               │  ← diff
└─────────────┴──────────────────────┴─────────────────┘
```

Implementation:

```tsx
const FIELDS: { key: keyof SuggestionContact; label: string }[] = [
  { key: "fullName", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "addressDisplay", label: "Address" },
  { key: "birthday", label: "Birthday" },
  { key: "notes", label: "Notes" },
];

function ComparisonTable({ a, b }: { a: SuggestionContact; b: SuggestionContact }) {
  return (
    <table className="mt-3 w-full border-collapse text-[12.5px]">
      <thead>
        <tr className="border-b border-[#edf0ea]">
          <th className="w-[80px] py-1.5 text-left font-semibold text-[#8b938c]">Field</th>
          <th className="py-1.5 text-left font-semibold text-[#1d2823]">{a.fullName ?? "Contact A"}</th>
          <th className="py-1.5 text-left font-semibold text-[#1d2823]">{b.fullName ?? "Contact B"}</th>
        </tr>
      </thead>
      <tbody>
        {FIELDS.map(({ key, label }) => {
          const aVal = a[key] ?? null;
          const bVal = b[key] ?? null;
          const differs = aVal !== bVal;
          if (aVal === null && bVal === null) return null;  // skip empty on both sides
          return (
            <tr
              key={key}
              className="border-b border-[#f2f4f0] last:border-b-0"
              style={{ background: differs ? "#fff0bf" : "transparent" }}
            >
              <td className="py-1.5 pr-3 font-medium text-[#8b938c]">{label}</td>
              <td className={`py-1.5 pr-3 ${differs ? "text-[#1d2823]" : "text-[#8b938c]"}`}>
                {truncate(aVal, 80) ?? "—"}
              </td>
              <td className={`py-1.5 ${differs ? "text-[#1d2823]" : "text-[#8b938c]"}`}>
                {truncate(bVal, 80) ?? "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

Rows where both sides are null/empty are skipped to keep the table concise.

### Mobile layout (< 768px)

Swap from a `<table>` to a `<dl>` list of field rows:

```
Field: Name
  A: John Appleseed
  B: Jon Appleseed

Field: Email
  A: j@x.com
  B: j@x.com     (muted — matching)
```

Use a `useBreakpoint` hook or a CSS-only approach with
`hidden md:table` / `md:hidden` to toggle between the two layouts.

### Truncation helper

```ts
function truncate(s: string | null, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) + "…" : s;
}
```

## Acceptance Criteria

- [ ] Each suggestion card has a "Compare fields ↓" button (collapsed by
      default).
- [ ] Clicking expands the comparison panel with field rows.
- [ ] Rows where both contacts have a differing value are highlighted with
      `#fff0bf` background.
- [ ] Rows where both contacts have the same value are shown in muted
      `#8b938c` text.
- [ ] Rows where both contacts have no value are hidden.
- [ ] On mobile (< 768px), the comparison uses a stacked dl layout instead of
      a two-column table.
- [ ] The contact name in the column header matches the actual contact name.
- [ ] Notes are truncated to 80 chars with "…".
- [ ] Multiple cards can each have their own expanded state independently.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- Phone display: even if the normalised digit key matches, the raw display
  strings may differ ("+44 7700 900111" vs "07700 900111"). The comparison
  shows the raw display string (which will differ), even though the scoring
  engine treats them as the same phone. Add a note "(same number)" below
  differing phone values if the normalised keys match, so the user isn't
  confused.
- If a suggestion card is in a virtualised list, ensure the expanded panel's
  height is stable so scroll position is preserved.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: document ComparisonTable in the
      merge-suggestions concept doc; note the phone display vs normalised key
      distinction
