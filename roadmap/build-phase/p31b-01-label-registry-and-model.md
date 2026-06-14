# P31B-01 — Label Registry & Model

## Purpose

Establish a canonical source of truth for labels (name + color) so that labels
can be browsed, recolored, renamed, merged, and deleted consistently — turning
the current free-form per-contact tags into a first-class primitive.

## Background

Labels today are a JSON string array on the contact (`Contact.labels`). They are
written at create time (`create-contact-form` → `createContact`, parsed at
`src/app/actions/contacts.ts`) and in bulk (`addLabelBulk` in
`src/app/actions/bulk-edit.ts`, which de-dupes case-insensitively). There is **no
registry**, so there is no place to store a label's color or to rename/delete it
across every contact that carries it. The sidebar "Labels" section is a hardcoded
placeholder (`contact-dashboard.tsx`).

## Scope

**In scope**
- A per-user **label registry**: canonical name + color (+ optional usage count).
- Reconciliation/backfill: every distinct value already in `Contact.labels`
  becomes a registry entry with an assigned color.
- Keep label *attachment* backward-compatible (`Contact.labels` stays the
  attachment mechanism; the registry is the metadata layer).
- Deploy-safe under `db push` (additive only — see the project's db-push deploy
  constraint).

**Out of scope**
- Sidebar UI (P31B-02), filtering (P31B-03), management UI (P31B-04), chips (P31B-05).

## Design / Implementation Spec

### Model decision
Two viable shapes — land one in this ticket:

1. **`Label` table** (`id, userId, name, color, createdAt`, unique `[userId, name]`):
   normalized; rename/recolor/delete touch one row + a bulk update of
   `Contact.labels`. Cleanest for management operations.
2. **User-level JSON registry** (`User.labelRegistry: Json` — `{name: color}`):
   no new table; simpler, but rename/merge still require scanning contacts.

Recommendation: **the `Label` table** — it makes P31B-04 (rename/merge/delete)
first-class. Additive, so `db push`-safe.

### Reconciliation / backfill
- A script (and a runtime upsert path) that, for each user, collects distinct
  `Contact.labels` values and upserts a `Label` row, assigning a color from the
  canonical palette (rotating) when none exists.
- New labels created via the contact form or `addLabelBulk` upsert a `Label` row.

### Attachment stays on the contact
`Contact.labels` remains the per-contact attachment (so existing sync/export
behavior is unchanged); the registry adds name canonicalization + color.

## Acceptance Criteria
- A canonical per-user label source of truth (name + color) exists.
- Every existing `Contact.labels` value reconciles into the registry with a color.
- Creating a label (form or bulk) upserts the registry; attachment still writes
  `Contact.labels`.
- Change is additive and `db push`-safe.

## Risks / Open Questions
- Case/whitespace canonicalization: define the canonical form (the bulk action
  already lower-cases for de-dupe — align the registry key with it).
- Color assignment strategy for backfilled labels (rotating palette vs. default).

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: update `organizing-contacts.md` with the label registry model
