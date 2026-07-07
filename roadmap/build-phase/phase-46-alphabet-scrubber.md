# Phase 46 — Contacts list & photo polish

> **Mini-phase.** A grab-bag of contacts-surface fixes and small features,
> in three workstreams:
>
> 1. **Alphabet scrubber** — a vertical A–Z index rail on the right edge of
>    the contacts list (original scope; see below).
> 2. **Contact photos** — fix images not displaying, optimize uploads and drop
>    raw originals, add a real contact-photo file upload, and clean up orphaned
>    objects (added 2026-07-04 from user report).
> 3. **Contact detail navigation** — make the detail *tabs* not behave like
>    pages so Back returns to the contact list (added 2026-07-04).
> 4. **Notification aging** — muted/greyed treatment for notifications that are
>    stale by time (>7 days) or whose event has passed, on desktop + mobile
>    (added 2026-07-04 from user request).
> 5. **Mobile contact-list row refresh** — an updated mobile design brief for
>    the row now that photos + the scrubber exist: image + name + scrubber
>    (added 2026-07-04 from user request).
> 6. **Social media assets** — a brand/marketing design brief for the four
>    social channels (LinkedIn, Twitter/X, Facebook, Instagram): profile
>    images, banners, featured images, slogans + bios (added 2026-07-05 from
>    user request).
> 7. **Mobile UI consistency audit** — a mobile-only design brief aligning nav,
>    headers, back/directional behaviour, and banners across every screen, plus
>    removing the mobile Overview and relocating its worthwhile options (added
>    2026-07-05 from user request; desktop pass deferred to a future brief).

## Phase status
Pre-plan

## Phase objective
Polish the contacts list and detail surfaces: make long address books
navigable by letter, make contact photos reliably display and store cheaply,
and make detail-tab navigation behave.

## Tickets

| Ticket | Title | Priority | Depends on |
| --- | --- | --- | --- |
| [P46-DB01](p46-db01-design-brief-alphabet-scrubber.md) | Design brief: alphabet scrubber | P0 | — |
| [P46-01](p46-01-letter-index-data-scrubber-component.md) | Letter index data + scrubber component | P1 | P46-DB01, P38-02 |
| [P46-DB02](p46-db02-design-brief-contact-photo-model.md) | Design brief: contact photo storage/upload/display model | P0 | — |
| [P46-02](p46-02-contact-photo-display-fix.md) | Contact photo display fix (diagnosis + fallbacks) | P1 | — |
| [P46-03](p46-03-photo-storage-consolidation.md) | Photo storage consolidation (optimize-on-upload, cleanup) | P1 | P46-DB02 |
| [P46-04](p46-04-contact-photo-upload-ui.md) | Contact photo upload UI (desktop + mobile) | P2 | P46-DB02, P46-03 |
| [P46-05](p46-05-contact-detail-tab-history.md) | Contact detail tabs: Back returns to the list | P1 | — |
| [P46-DB03](p46-db03-design-brief-notification-aging.md) | Design brief: notification aging & event-passed states | P0 | — |
| [P46-06](p46-06-notification-aging-treatment.md) | Notification aging & event-passed treatment | P2 | P46-DB03 |
| [P46-DB04](p46-db04-design-brief-mobile-contact-list-refresh.md) | Design brief: mobile contact-list row refresh | P1 | — |
| [P46-07](p46-07-mobile-contact-list-row-polish.md) | Mobile contact-list row polish (contingent) | P3 | P46-DB04 |
| [P46-DB05](p46-db05-design-brief-social-media-assets.md) | Design brief: social media assets (LinkedIn/X/Facebook/Instagram) | P2 | — |
| [P46-DB06](p46-db06-design-brief-mobile-consistency-audit.md) | Design brief: mobile UI consistency audit + Overview removal (mobile-only) | P1 | — |
| [P46-DB07](p46-db07-design-brief-settings-ia-redesign.md) | Design brief: settings IA redesign (both breakpoints) | P1 | — |
| [P46-12](p46-12-settings-nav-config-unification.md) | Settings nav-config unification (DB07·T1) | P1 | P46-DB07 |
| [P46-13](p46-13-settings-billing-page.md) | Kill the anchor · birth /settings/billing (DB07·T2) | P1 | P46-12 |
| [P46-14](p46-14-settings-auth-boundary-moves.md) | Auth-boundary moves (DB07·T3) | P1 | P46-12 |
| [P46-15](p46-15-settings-data-sync-consolidation.md) | Data & sync consolidation (DB07·T4) | P1 | P46-12 |
| [P46-16](p46-16-settings-sharing-groups.md) | Sharing & groups restructure (DB07·T5) | P1 | P46-12 |
| [P46-17](p46-17-remove-merge-review-from-settings.md) | Remove Merge review from settings (DB07·T6) | P2 | P46-12 |
| [P46-18](p46-18-teams-page-split-seats.md) | Teams page body-split + seats relocation (T5 remainder) | P2 | P46-16 |
| [P46-19](p46-19-mobile-nav-duplicates-swap.md) | Mobile bottom nav: Duplicates replaces Sync + mobile merge actions | P2 | P46-17 |
| [P46-08](p46-08-mobile-chrome-conformance-pass.md) | Mobile chrome conformance pass (backs, missing headers, Overview removal) | P1 | P46-DB06 |
| [P46-09](p46-09-mobile-header-unification-banner-stack.md) | Mobile header primitive unification + banner stack | P1 | P46-08 |
| [P46-10](p46-10-contact-health-people-prompt.md) | Contact-health "needs attention" prompt in People | P2 | P46-08 |
| [P46-11](p46-11-overlay-sheet-taxonomy.md) | Overlay & sheet taxonomy consolidation | P2 | P46-08 |

> Tickets are split into standalone files (linked above); the sections
> below remain the phase-level overview for the **alphabet scrubber**
> workstream. The photo, navigation, notification-aging, and mobile-row
> workstreams live entirely in their ticket files.

## Photo & navigation workstreams (summary)

Verified 2026-07-04 (three read-only investigations of the current code):

- **Images not displaying** — thumbnail infra already exists (96px webp on
  both upload and sync paths); the failure is in resolution/serving. Top
  suspect: `resolveAvatarSrc` hardcodes the media host to
  `media.getkontax.com` while uploads use `MINIO_PUBLIC_URL`; also the detail
  heroes lack the `onError` fallback that list rows have. → [P46-02](p46-02-contact-photo-display-fix.md).
- **Optimize + drop original** — the profile-upload route stores the **raw**
  original and nothing ever cleans up superseded objects; sync already
  normalizes + cleans up. Consolidate on the shared normalizer, keep exactly
  two objects (canonical + 96 thumb), delete on replace/clear/delete. →
  [P46-DB02](p46-db02-design-brief-contact-photo-model.md) + [P46-03](p46-03-photo-storage-consolidation.md).
- **Contact photo upload** — contacts today only accept a *pasted URL*; add a
  real file upload (user decision 2026-07-04). → [P46-04](p46-04-contact-photo-upload-ui.md).
- **Detail tabs vs Back** — tabs already use `<Link replace>`, so this is a
  diagnosis, not an "add replace"; guarantee one Back press exits to the list.
  → [P46-05](p46-05-contact-detail-tab-history.md).

Added 2026-07-04 (two more small workstreams from user requests):

- **Notification aging** — the notification system is **fully built** (bell +
  360 px desktop dropdown + full-screen mobile overlay, six categories,
  `relativeTime` → `1w`, fresh/earlier 24 h grouping) but nothing ever *ages*:
  `Notification` has no `expiresAt`/event date and the feed only filters
  `dismissedAt: null`. Add a muted treatment for **aged** (>7 day) and
  **event-passed** notifications, distinct triggers, both surfaces. →
  [P46-DB03](p46-db03-design-brief-notification-aging.md) (extends the original
  [P22-DB05](p22-db05-design-brief-notifications.md) brief) + [P46-06](p46-06-notification-aging-treatment.md).
- **Mobile contact-list row refresh** — the mobile row already renders photo +
  name + a company/email/phone line and the scrubber is built but documented
  nowhere; [01-contacts-list.md](../design-briefs/01-contacts-list.md)'s mobile
  section predates both. Ratify the canonical row (image + name + one optional
  secondary line + scrubber) and supersede the old brief's mobile section. →
  [P46-DB04](p46-db04-design-brief-mobile-contact-list-refresh.md) + contingent
  [P46-07](p46-07-mobile-contact-list-row-polish.md).

Added 2026-07-05 (brand/marketing workstream from user request):

- **Social media assets** — a design brief for the four channels' profile
  images, banner/cover images, featured/post images, and text (slogans +
  bios), building on the locked [brand-assets.md](../design-briefs/brand-assets.md)
  identity and reusing the existing OG card + `avatar.png` master rather than
  re-specifying them. Marketing deliverable (no app code). →
  [P46-DB05](p46-db05-design-brief-social-media-assets.md).

- **Mobile UI consistency audit** — verified drift: no single mobile header
  (4+ variants), **three screens with no header at all** (`/shares`,
  `/merge-suggestions/[id]`, `/merge/manual`), icon-only settings back, an
  Activity-tab mid-screen header swap, and two screens that bypass `AppShell`'s
  banner stack. Also removes the mobile **Overview** (reached via the wordmark →
  `/contacts?tab=overview`) and relocates its options — Shared-with-me into
  Settings' Sync & Shared group, contact-health into People, the rest dropped;
  wordmark re-points to `/contacts`. Largest mobile surface in the phase;
  mobile-only, desktop deferred. → [P46-DB06](p46-db06-design-brief-mobile-consistency-audit.md).

## Alphabet scrubber — phase overview

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
