# P46-DB01 — Design Brief: Alphabet Scrubber

Status: Not started · Priority: P0 · Depends: —
Phase: [Phase 46](phase-46-alphabet-scrubber.md)

## Purpose

Specify the vertical fast-scroll index rail on the right edge of the mobile
contacts list (the classic phone-book scrubber): tap or drag to jump to a
letter, and see at a glance where you are in the scroll.

## Scope

- **Rail** — right edge of the mobile list: sizing and spacing at a ~380px
  viewport, resting vs active opacity, and clearance from the swipeable-row
  gesture zone (`contact-list/swipeable-row.tsx` uses horizontal swipe — the
  rail must not eat its touch starts, and vice versa).
  **Letter set — decided (user, 2026-07-02): only letters that exist in the
  current list render.** A letter with no contacts is absent, in every
  context (full list and filtered views alike); the rail is a map of the
  data, not a static A–Z + `#`. `#` appears only when a `#`-bucket contact
  exists. The brief specifies how the rail redistributes vertically as the
  letter count changes (fixed spacing vs stretch-to-fill) and the minimum
  letter count below which the rail hides entirely.
- **Interaction** — tap a letter to jump; drag along the rail to scrub with a
  floating letter bubble next to the thumb; current-section letter
  highlighted while scrolling normally (the passive "where am I" signal).
- **When it shows** — only when: sorted by name, no active search query, and
  the list is long enough to need it (threshold, e.g. > 2 screens). Hidden in
  "recently updated" sort. In filtered views the present-letters-only rule
  applies automatically — the rail doubles as a map of the filter results.
- **Letter derivation — multi-language (decided, user 2026-07-02):**
  contacts named "李" and "Lee" must both file under **L**. One derivation
  function produces the bucket letter, resolved in order:
  1. **Phonetic name fields** when present (`phoneticFirstName` /
     `phoneticLastName` — the contact form already live-autofills these):
     李 with phonetic "Li" → L. Primary path; works for any language the
     user (or autofill) has covered.
  2. **Transliteration fallback** for CJK/Han without a phonetic value
     (pinyin first-letter for Han; evaluate a lightweight library in
     [P46-01](p46-01-letter-index-data-scrubber-component.md)). Honest
     limitation to record: Han readings differ by language (李 = Lǐ in
     Mandarin, Lee/이 in Korean, Ri in Japanese) — without a phonetic field
     we bucket by pinyin and document that; the phonetic field is the user's
     override.
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

## States to specify

Resting, scrubbing (bubble), sparse rail (few letters — spacing behaviour per
the decision above), single-letter list (rail hidden), tablet width, and the
interaction with pull-to-refresh / header collapse if present.

## Out of scope

Desktop (scrollbar, keyboard, and search cover it in v1); locale-aware
non-Latin index sections (e.g. ㄱㄴㄷ for Korean) — future follow-up on the
same derivation seam.

## Deliverables

A `p46-db01` brief in `roadmap/design-briefs/` per the house format: layout,
tokens, motion, all states above, and the copy for the bubble/aria labels —
ready for P46-01 to build without further design decisions.
