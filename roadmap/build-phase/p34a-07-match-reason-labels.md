# P34A-07 — Match Reason Labels on Duplicate Cards

## Purpose

Show small chip labels below the two contact names on each merge suggestion
card in `/?tab=duplicates`, explaining why the pair was flagged — so users
can quickly scan and triage without opening the review page.

## Background

The `MergeSuggestion` rows already store a `signals` JSON column (type
`SignalContribution[]`, added in P10-08). The review page
(`/merge-suggestions/[id]`) parses these and renders the "Why this was
suggested?" panel. However the **list card** in the duplicates tab shows
only the two names, confidence badge, and score — no signal labels.

This ticket adds a `signals` display to the list card. It also extends the
`PersistedMergeSuggestion` type so the signals array is available to the
card without re-parsing from raw JSON at render time.

## Scope

**In scope**
- Map stored signal keys to human-readable chip labels.
- Render signal chips on the duplicates list card below the two contact names.
- Extend `PersistedMergeSuggestion` to surface a `displaySignals: string[]`
  field (derived at query time or at render from the existing `signals` JSON).

**Out of scope**
- Adding new signals (P34A-06).
- The side-by-side field comparison (P34A-08).
- The review page "Why" panel (already built).

## Design / Implementation Spec

### Signal-to-label map

```ts
const SIGNAL_LABELS: Record<string, string> = {
  "exact-email":          "Same email",
  "exact-phone":          "Same phone",
  "normalized-phone":     "Same phone",
  "exact-name":           "Same name",
  "fuzzy-name-company":   "Similar name",
  "fuzzy-name":           "Similar name",
  "name-and-company":     "Same company",
  "name-and-missing-company": "Same name",
  "name-company-proximity":   "Similar name",
  "phonetic-name":        "Similar name",
  "email-domain-and-name":"Similar name",
};
```

Deduplicate labels before rendering — e.g. if two signals both map to
"Similar name", show it once.

Priority order for display (show at most 3 chips):
1. Same email
2. Same phone
3. Same name
4. Similar name
5. Same company

### PersistedMergeSuggestion type update

The type lives in `src/server/contact-merge.ts`. Add:

```ts
type PersistedMergeSuggestion = {
  // ... existing fields ...
  displaySignals: string[];  // derived from contributions / signals JSON
};
```

Populate in the query function:

```ts
displaySignals: deriveDisplaySignals(suggestion.signals as RawSignal[]),
```

where `deriveDisplaySignals` maps, deduplicates, and sorts by priority:

```ts
function deriveDisplaySignals(raw: RawSignal[]): string[] {
  const labels = new Set<string>();
  for (const item of raw) {
    const signal = typeof item === "string" ? item : item.signal;
    const label = SIGNAL_LABELS[signal];
    if (label) labels.add(label);
  }
  return [...labels].slice(0, 3);
}
```

### Card chip rendering

In the duplicates list card component (locate by searching for
`MergeSuggestion` card render in `src/app/contacts/page.tsx` or a dedicated
`_components/merge-suggestion-card.tsx`):

```tsx
{suggestion.displaySignals.length > 0 ? (
  <div className="mt-1.5 flex flex-wrap gap-1.5">
    {suggestion.displaySignals.map((label) => (
      <span
        key={label}
        className="inline-flex h-[20px] items-center rounded-[5px] px-2 text-[11px] font-medium"
        style={{ background: "#f2f4f0", color: "#5c655e" }}
      >
        {label}
      </span>
    ))}
  </div>
) : null}
```

Place the chips immediately below the two contact name+email rows (before the
action buttons).

### Storing signals on new suggestions

The generation job already stores `signals` as `SignalContribution[]` JSON.
No change needed — `deriveDisplaySignals` can parse both the old bare-string
format (P10-08 legacy) and the new `{ signal, label, score }` object format.

## Acceptance Criteria

- [ ] Each merge suggestion card in `/?tab=duplicates` shows up to 3 signal
      chips below the contact names.
- [ ] Chip labels are human-readable: "Same email", "Same phone", "Same name",
      "Similar name", "Same company".
- [ ] No duplicate labels appear on a single card.
- [ ] The chips render correctly for legacy suggestions whose `signals` column
      stores bare string arrays.
- [ ] Cards with no computable signals show no chip row (not an empty row).
- [ ] Chips use `#f2f4f0` bg and `#5c655e` text at 11px.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- The location of the list card component needs to be confirmed by reading
  `src/app/contacts/page.tsx`. It may be inline JSX or a separate component.
- If `displaySignals` is computed on the server and serialised through
  `JSON.stringify` in a server component prop, ensure the type is
  `string[]` (not `unknown`).

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: document SIGNAL_LABELS map and
      displaySignals derivation in the merge-suggestions concept doc
