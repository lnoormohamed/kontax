# P48-07 — Apply the sharing policy to shared copies and snapshots

**Phase:** 48 · **Workstream:** C · **Priority:** P1 · **Depends on:** —
**Audit severity:** Medium

## Objective

Stop the owner's policy-private fields (notes, personal phone, home address,
birthday, labels, custom fields) from being copied into family books, team
books, static shares and the initial live-share snapshot.

## Context

- `src/lib/sharing-policy.ts:50-63 DEFAULT_SHARING_POLICY` marks those fields
  private by default, and `src/server/contact-shares.ts:5-38 LIVE_FIELD_SELECT`
  deliberately excludes `notes` for live-share propagation.
- But the copy/snapshot selects include everything: `src/app/actions/family.ts:284
  COPY_SELECT`, `teams.ts:595 TEAM_COPY_SELECT`, `src/server/family-snapshot.ts
  COPY_SELECT`, and `shares.ts:100 SNAPSHOT_SELECT` (used for both static and
  the first live snapshot).
- `sharing-policy.ts` and `contact-private-fields.ts` are imported only by
  `src/lib/edit-context.ts` and `src/server/export-format/export.ts`; no
  sharing action applies them. `ContactPrivateField` rows are never joined
  by any sharing path (confirmed: the overlay itself does not leak).

## Steps

1. Add `applySharingPolicy(contact, policy, context)` in
   `src/lib/sharing-policy.ts` (or reuse `resolveEffectiveSharingPolicy`)
   that returns the shareable projection for a given target (family, team,
   static share, live share).
2. Route the four copy/snapshot paths through it before persisting.
3. Drop `notes` from `SNAPSHOT_SELECT` outright; live shares already exclude
   it so the first snapshot should too.
4. Backfill: decide whether existing copies keep leaked fields (likely yes,
   with a one-off script to null `notes` on `ContactShare.snapshot` and
   group-book copies where the source policy marks them private; record the
   decision).
5. Tests: extend `tests/node/contact-private-fields.test.ts` /
   sharing-policy tests with "family copy excludes notes", "team copy
   excludes personal phone when policy says so", "static share snapshot has
   no notes".

## Acceptance

- Add a contact with notes + personal phone + home address to a family book;
  the family member's copy has none of them.
- Create a static share; the recipient's snapshot has no notes.
- Live share initial snapshot equals what `LIVE_FIELD_SELECT` propagates.
- Export format (`export-format/export.ts`) behaviour unchanged.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help ("What is shared when I add a contact to a family/team book?")
- [ ] External · developers — /developers
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/ (sharing policy model)

## References

- Audit report §Medium "Private fields leak into shared copies and snapshots"
- `src/lib/sharing-policy.ts`, `src/lib/contact-private-fields.ts`, `src/server/contact-shares.ts`, `src/app/actions/{family,teams,shares}.ts`, `src/server/family-snapshot.ts`
