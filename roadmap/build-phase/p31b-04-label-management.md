# P31B-04 — Label Management (rename / recolor / merge / delete)

## Purpose

Give users full lifecycle control over a label: rename it, change its color,
merge it into another, or delete it — with each operation applied consistently
across every contact that carries the label.

## Background

With the registry from P31B-01 (canonical name + color) and the sidebar `⋯` menu
from P31B-02, this ticket implements the actual operations. Each operation spans
the registry row **and** every `Contact.labels` array that references the label,
so all writes are transactional and bump `syncVersion` on affected contacts
(matching the bulk-edit convention in `src/app/actions/bulk-edit.ts`).

## Scope

**In scope**
- **Rename** — update the registry name and rewrite the value in every contact's
  `labels` array.
- **Recolor** — update the registry color (palette from the design brief).
- **Merge** — fold label A into label B across all contacts (dedupe), then delete
  A's registry row.
- **Delete** — remove the label from the registry and from every contact's
  `labels` array (confirmation; destructive).
- A small management surface (modal from the sidebar `⋯`, and/or a settings panel).

**Out of scope**
- Registry model (P31B-01), sidebar (P31B-02), filter (P31B-03), chips (P31B-05).

## Design / Implementation Spec

### Server actions (per-user scoped, impersonation read-only)
```ts
renameLabel({ from, to })   // registry + every Contact.labels entry
recolorLabel({ name, color })
mergeLabels({ from, into }) // rewrite + dedupe + drop `from`
deleteLabel({ name })       // confirmed; removes from registry + all contacts
```
- Each contact-touching op runs in a `$transaction`, rewrites the JSON array, and
  sets `lastMutatedBy: "MANUAL"`, `lastMutatedByDetail: null`,
  `syncVersion: { increment: 1 }` on changed contacts (so the sync engine
  re-pushes). De-dupe case-insensitively (align with P31B-01 canonical form).
- `revalidatePath("/contacts")` after each.

### UI
- Rename: inline text input. Recolor: palette swatches. Merge: pick the target
  label. Delete: a `ConfirmDialog` (reuse the existing one) — "Remove 'VIP' from
  N contacts?".

## Acceptance Criteria
- Rename updates the label everywhere it's used.
- Recolor updates the registry and reflects in chips/sidebar.
- Merge folds A into B across all contacts with no duplicates, and A disappears.
- Delete removes the label from the registry and every contact, behind a confirm.
- Affected contacts have `syncVersion` bumped.

## Risks / Open Questions
- Large label sets: rewriting many `Contact.labels` arrays should be batched in a
  transaction; consider a bound/paging if a label spans thousands of contacts.
- Merge target selection UX when many labels exist.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (P26-12): managing labels (rename/merge/delete)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/
