# P46-01 — Letter index data + scrubber component

Status: Not started · Priority: P1 · Depends: [P46-DB01](p46-db01-design-brief-alphabet-scrubber.md), P38-02 (shipped)
Phase: [Phase 46](phase-46-alphabet-scrubber.md)

## Scope

- **Letter → offset map from the server**: a cheap aggregate (count of
  contacts per bucket letter under the current book/label/scope filters,
  respecting `nameDisplayOrder`) delivered with the first page of the
  windowed list (P38-02's contract — additive extension, one extra aggregate
  alongside the first 300-row window). This is what lets a jump to "T"
  compute the target index without having fetched T's rows. **The same map
  drives which letters render**: the rail displays exactly the map's keys —
  a letter with zero contacts is omitted, not dimmed — so data and UI can't
  disagree.
- **Bucket-key derivation**: implement the brief's four-step derivation
  (phonetic fields → CJK transliteration → diacritic folding → `#`) as one
  shared function used by the letter-map aggregate, the list's section
  headers, and the sort key — server-side, since the map is computed with
  the windowed query and P38-02's stored `sortKey` must agree with it.
  Backfill/recompute `sortKey` where the new derivation changes it (one-off
  script per the `scripts/*.mjs` pattern; mind the `db push` deploy note).
- **Jump behaviour**: scroll the virtualizer to the letter's first index;
  windowed fetch loads that page. The scrubber never blocks on network — it
  jumps immediately and rows stream in (skeleton rows are P38-02's concern).
- **Current-letter tracking**: derive from the first visible section header
  (the virtualizer already knows the visible range) — no scroll listeners
  beyond what the table has.
- **Gesture coexistence**: verify scrub-drag vs row-swipe vs vertical scroll
  on a real device (preview cannot emulate touch).
- Keep it cheap: the rail is pure client UI over data the list already
  needs; no per-row cost (Phase 38 row budget applies).

## Acceptance

- On a 2,000-contact seeded account (P38 harness): tap "T" lands on the T
  section within one frame of the jump, rows visible after the windowed
  fetch resolves; drag-scrub shows the bubble and tracks the thumb.
- Rail hidden under search, under "updated" sort, and on short lists.
- Only letters with contacts appear — for **every** letter, not any special
  case: the rail equals the set of initials present in the current list.
  Verify by diffing rail contents against distinct initials on a seeded
  account with several gaps; add a contact under a missing letter and it
  appears on next data refresh; delete/archive the last contact under a
  letter and it disappears; the same holds inside a label/book filter.
- Letter map respects book/label scope and `nameDisplayOrder`.
- Multi-language: seeded contacts "李" (phonetic "Li"), "Lee", "Élodie", and
  "Øystein" — 李 and Lee both appear under L (adjacent in the sorted list,
  one L section header), Élodie under E, Øystein under O; a Han-name contact
  with *no* phonetic field buckets by pinyin fallback; tapping each rail
  letter lands on the section containing those contacts.
- Row swipe actions still work adjacent to the rail; vertical scroll
  unaffected; verified on a real phone (iOS Safari + Android Chrome).
