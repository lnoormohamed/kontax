# Phase 46 — Alphabet Scrubber (fast-scroll index rail)

> **Mini-phase.** A vertical A–Z index rail on the right edge of the contacts
> list (the classic phone-book scrubber — iOS Contacts, Reddit's subscription
> list): tap or drag along it to jump to a letter, and see at a glance where
> you are in the scroll. The list already renders alphabetical letter
> section headers in the virtualized table
> (`contacts-workspace-table.tsx`, `LETTER_H`), so the rail has existing
> anchors — this phase adds the control, not the grouping.

## Phase status
Pre-plan

## Phase objective
Make long address books navigable by letter on touch devices. Primarily a
mobile/tablet affordance (desktop has a scrollbar, keyboard, and search;
out of scope for v1). Complements — and depends on — the Phase 38 windowed
fetch: jumping to "T" must work when the rows around "T" haven't been
fetched yet.

## Tickets

| Ticket | Title | Priority | Depends on |
| --- | --- | --- | --- |
| [P46-DB01](p46-db01-design-brief-alphabet-scrubber.md) | Design brief: alphabet scrubber | P0 | — |
| [P46-01](p46-01-letter-index-data-scrubber-component.md) | Letter index data + scrubber component | P1 | P46-DB01, P38-02 |

> Tickets are split into standalone files (linked above); the sections
> below remain the phase-level overview.

### P46-DB01 — Design brief: alphabet scrubber
Specify:
- **Rail** — right edge of the mobile list: sizing and spacing at a ~380px
  viewport, resting vs active opacity, and clearance from the swipeable-row
  gesture zone (`contact-list/swipeable-row.tsx` uses horizontal swipe — the
  rail must not eat its touch starts, and vice versa).
  **Letter set — decided (user, 2026-07-02): only letters that exist in the
  current list render.** No contacts under L → no L on the rail, in every
  context (full list and filtered views alike); the rail is a map of the
  data, not a static A–Z + `#`. `#` appears only when a `#`-bucket contact
  exists. The brief specifies how the rail redistributes vertically as the
  letter count changes (fixed spacing vs stretch-to-fill) and the minimum
  letter count below which the rail hides entirely (overlaps the length
  threshold below).
- **Interaction** — tap a letter to jump; drag along the rail to scrub with a
  floating letter bubble next to the thumb; current-section letter
  highlighted while scrolling normally (the "where am I" signal in the
  screenshot that motivated this).
- **When it shows** — only when: sorted by name, no active search query, and
  the list is long enough to need it (threshold, e.g. > 2 screens). Hidden in
  "recently updated" sort. In filtered views the present-letters-only rule
  above applies automatically — the rail doubles as a map of the filter
  results.
- **Letter derivation — multi-language (decided, user 2026-07-02):**
  contacts named "李" and "Lee" must both file under **L**. One derivation
  function produces the bucket letter, resolved in order:
  1. **Phonetic name fields** when present (`phoneticFirstName` /
     `phoneticLastName` — the contact form already live-autofills these):
     李 with phonetic "Li" → L. This is the primary path and works for any
     language the user (or autofill) has covered.
  2. **Transliteration fallback** for CJK/Han without a phonetic value
     (pinyin first-letter for Han; evaluate a lightweight library in the
     build ticket). Honest limitation to record: Han readings differ by
     language (李 = Lǐ in Mandarin, Lee/이 in Korean, Ri in Japanese) —
     without a phonetic field we bucket by pinyin and document that; the
     phonetic field is the user's override.
  3. **Diacritic folding** for Latin scripts: Élodie → E, Øystein → O
     (Unicode NFD + strip, matching the P38-07 collator's behaviour).
  4. **`#`** only for what survives all of the above (numbers, symbols,
     scripts with no mapping).
  Follows the user's `nameDisplayOrder` preference (P34B) for *which* name
  feeds the derivation.
- **Bucket = sort — one function.** The rail letter, the list's letter
  section headers, and the list's sort collation must all derive from the
  same key, or jumping to L won't land on 李: if 李 buckets under L it must
  also *sort* among the L names. This likely touches the P38-02 `sortKey` /
  P38-07 collator — the build ticket owns reconciling them.
- **Accessibility** — the rail is a secondary affordance duplicating scroll:
  proper `role`/labels, and it must not trap screen-reader swipe navigation.
- States: resting, scrubbing (bubble), sparse rail (few letters — spacing
  behaviour per the decision above), single-letter list (rail hidden),
  tablet width, and the interaction with the pull-to-refresh / header
  collapse if present.

### P46-01 — Letter index data + scrubber component
- **Letter → offset map from the server**: a cheap aggregate (count of
  contacts per initial letter under the current book/label/scope filters,
  respecting `nameDisplayOrder`) delivered with the first page of the
  windowed list (P38-02's contract). This is what lets a jump to "T" compute
  the target index without having fetched T's rows. **The same map drives
  which letters render**: the rail displays exactly the map's keys — a letter
  with zero contacts is omitted, not dimmed — so data and UI can't disagree.
- **Jump behaviour**: scroll the virtualizer to the letter's first index;
  windowed fetch loads that page. The scrubber never blocks on network — it
  jumps immediately and rows stream in (skeleton rows are P38-02's concern).
- **Bucket-key derivation**: implement the brief's four-step derivation
  (phonetic fields → CJK transliteration → diacritic folding → `#`) as one
  shared function used by the letter map aggregate, the list's section
  headers, and the sort key — server-side, since the map is computed with
  the windowed query and P38-02's stored `sortKey` must agree with it.
  Backfill/recompute `sortKey` where the new derivation changes it (one-off
  script per the `scripts/*.mjs` pattern; mind the `db push` deploy note).
- **Current-letter tracking**: derive from the first visible section header
  (the virtualizer already knows visible range) — no scroll listeners beyond
  what the table has.
- **Gesture coexistence**: verify scrub-drag vs row-swipe vs vertical scroll
  on a real device (preview cannot emulate touch — established workflow).
- Keep it cheap: the rail is pure client UI over data the list already needs;
  no per-row cost (Phase 38 row budget applies).

Acceptance:
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

## Sequencing notes
- P38-02 (windowed fetch) **shipped 2026-07-02**, so this phase is unblocked:
  the letter→offset map is an *additive* extension to its response shape
  (one extra aggregate alongside the first 300-row window), not a redesign.
- Pairs naturally with P43 (interface preferences) if users ever want the
  rail toggleable — not in v1.

## Documentation (per roadmap/documentation-policy.md)
- [ ] External · users — in-app Help: finding contacts quickly (mention
      alongside search)
- [ ] Internal · engineering — note in the contacts-list data contract where
      the letter map rides
