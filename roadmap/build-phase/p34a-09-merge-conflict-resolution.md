# P34A-09 — Per-Field Conflict Resolution: wide prop + address field

## Purpose

Scope correction after reading `merge-review.tsx` (2026-06-14):

**Already implemented in `merge-review.tsx` — do not rebuild:**
- `SCALAR_FIELDS` already covers fullName, email, phone, company, jobTitle,
  nickname, website, birthday (8 fields, line 129-138).
- `ConflictCard` with `SegChip` A/B/combine picker already built (line 641).
- Notes "Keep both — combine" third option already implemented (line 700-711).
- `SummaryPanel` (line 912) already shows auto-filled fields and collapsible
  matching fields — this IS the "auto-filled summary section". Not net-new.
- `UnionPanel` (line 716) already shows multi-value field union ("Kept from
  both contacts") — this IS mg2's `UnionCard`. Not net-new.

**What P34A-09 actually needs to do:**
1. Add `address` to the conflict field list (currently missing from `SCALAR_FIELDS`).
2. Add the `wide` prop to `ConflictCard` for desktop layout (side-by-side option cards).
3. Verify the merge action handles address and any gap fields correctly.

## Background

`merge-review.tsx` is significantly more complete than the ticket originally
assumed. Reading the file confirmed that scalar coverage, "keep both" notes,
auto-filled summary, and union panel are all built. The only genuine gaps are
address (missing from `SCALAR_FIELDS`) and the `wide` desktop layout variant
(identified by the designer reviewing mg2's `DesktopReview`).

## Scope

**In scope**
- Add `address` to `SCALAR_FIELDS` in `merge-review.tsx`. Address may be
  stored as a JSON object or string — check the Prisma schema and display
  as a single formatted string (join sub-fields: street, city, postcode,
  country).
- Add a `wide?: boolean` prop to `ConflictCard`. When `wide` is true (desktop
  ≥ 768px), the two option buttons render side by side (`grid-cols-2 gap-7`).
  When false/undefined (mobile), they stack (`grid-cols-1`).
- Pass `wide` from the parent render based on a `useMediaQuery` hook or a CSS
  class + `window.innerWidth` check.
- Verify the `mergeContacts` server action (in `contacts.ts`) handles address
  and all 8 scalar fields in `SCALAR_FIELDS`. If any are silently dropped,
  wire them up.

**Out of scope**
- Rebuilding `UnionPanel`, `SummaryPanel`, `ConflictCard`, `SegChip` — all
  already built and correct.
- Custom fields (Phase 35+).
- mg2 `DeskChrome`/`DesktopReview` full restyle — future phase.

## Design / Implementation Spec

### 1. Add address to SCALAR_FIELDS

```ts
const SCALAR_FIELDS = [
  { key: "fullName"  as const, label: "Full name" },
  { key: "email"     as const, label: "Email" },
  { key: "phone"     as const, label: "Phone" },
  { key: "company"   as const, label: "Company" },
  { key: "jobTitle"  as const, label: "Job title" },
  { key: "nickname"  as const, label: "Nickname" },
  { key: "website"   as const, label: "Website" },
  { key: "birthday"  as const, label: "Birthday" },
  { key: "address"   as const, label: "Address" },   // ← add
];
```

Confirm `address` field name in `MergeReviewContact` type and Prisma schema.
If stored as JSON, add a `formatAddress(raw)` helper that joins non-null
sub-fields into a readable string for display in the conflict card.

### 2. wide prop on ConflictCard

```tsx
function ConflictCard({
  // ...existing props
  wide?: boolean;
}) {
  return (
    <section ...>
      {/* header row: field label + SegChip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: wide ? "1fr 1fr" : "1fr",
          gap: 7,
        }}
      >
        <ValueRow badge="A" ... />
        <ValueRow badge="B" ... />
        {allowCombine && (
          <ValueRow ... fullWidth />
        )}
      </div>
    </section>
  );
}
```

Pass `wide` from the parent render:
```tsx
const isWide = typeof window !== "undefined" && window.innerWidth >= 768;
// or use a useMediaQuery("(min-width: 768px)") hook
{scalarConflicts.map((row) => (
  <ConflictCard ... wide={isWide} />
))}
```

### 3. Verify merge action field coverage

Read `src/app/actions/contacts.ts` → `mergeContacts`. Confirm it reads and
applies choices for all 9 fields. Add address handling if missing.

## Acceptance Criteria

- [ ] `address` field appears as a conflict card when both contacts have
      different addresses.
- [ ] On desktop (≥ 768px), option buttons in each conflict card render
      side by side.
- [ ] On mobile (< 768px), option buttons stack as before.
- [ ] `SummaryPanel` auto-fill list includes address when only one contact
      has one.
- [ ] Notes "Keep both — combine" still works (no regression).
- [ ] Merge action correctly writes address and all 9 scalar fields.
- [ ] `tsc --noEmit` passes.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: update merge-review spec in brief 09 to
      reflect the expanded field list and "Keep both" implementation status
