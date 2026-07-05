# Execution order — Phases 39–46 (tickets & design briefs combined)

> One flat list to follow, top to bottom. Ordering rules: design briefs
> front-run their builds; research tickets with external wait time start
> immediately; the P40 migration gets a quiet codebase; P41/P44 share the
> snapshot-shadow design and must reconcile it before either builds.
> Items marked ∥ can run in parallel with their neighbours.
>
> Status as of 2026-07-03. All ticket files live in
> [roadmap/build-phase/](build-phase/); finished design briefs land in
> [roadmap/design-briefs/](design-briefs/).

## Already done

- ✅ [P43-00](build-phase/p43-00-post-p38-measurement-gate.md) — measurement
  gate: chips are taste, not perf (2026-07-02)
- ✅ [P45-01](build-phase/p45-01-format-research-jscontact-fit.md) — JSContact
  (RFC 9553) confirmed as export-format base (2026-07-02)
- ◑ [P44-01](build-phase/p44-01-provider-photo-roundtrip-qa-harness.md) —
  photo round-trip harness **built & self-tested**; provider runs pending
  (needs dedicated Google / iCloud / Nextcloud test accounts)

## The list

### Now — long-poles and independent fixes (parallel track)

1. ∥ [P44-01](build-phase/p44-01-provider-photo-roundtrip-qa-harness.md) —
   finish the provider runs (incl. the ≥24h re-pulls). Longest external wait
   in the whole plan; unblocks P44-02.
2. ∥ [P40-DB01](build-phase/p40-db01-design-brief-books-first-navigation.md) —
   books-first navigation brief. Biggest design surface; every later P40/P41
   vocabulary decision hangs off it.
3. ∥ [P39-DB01](build-phase/p39-db01-design-brief-sync-enforcement-states.md) —
   enforcement states, dirty guard, mobile sheet.

### Phase 39 — sync settings enforcement (runner-side; independent of P40)

4. [P39-01](build-phase/p39-01-runner-sync-window-enforcement.md) — sync
   window (fix the DST flaw here, don't inherit it)
5. [P39-02](build-phase/p39-02-runner-deletion-safety-threshold.md) —
   deletion-safety pause (P0 trust issue — the earliest build ticket for a
   reason)
6. ∥ [P39-03](build-phase/p39-03-runner-field-exclusions.md) — field
   exclusions (open-list seam; Photos joins later)
7. ∥ [P39-04](build-phase/p39-04-runner-export-label-filter.md) — export
   label filter
8. [P39-05](build-phase/p39-05-runner-retry-sensitivity-notifications.md) —
   retry sensitivity + notifications
9. ∥ [P39-06](build-phase/p39-06-settings-panel-dirty-guard.md) — dirty guard
10. ∥ [P39-07](build-phase/p39-07-mobile-bottom-sheet-sync-settings.md) —
    mobile bottom sheet
11. [P39-08](build-phase/p39-08-enforcement-qa-matrix.md) — enforcement QA
    matrix (phase exit)

### Phase 42 — connection-loss UX (small; slots alongside P39)

12. ∥ [P42-DB01](build-phase/p42-db01-design-brief-connection-loss-banner.md) —
    banner states + stacking rules
13. ∥ [P42-01](build-phase/p42-01-offline-connection-banner.md) — banner
    replaces the full-page takeover (real-device airplane-mode pass)

### Phase 46 — contacts list & photo polish (builds on fresh P38-02 knowledge)

14. [P46-DB01](build-phase/p46-db01-design-brief-alphabet-scrubber.md) —
    scrubber brief (present-letters-only rule, multi-language derivation)
15. [P46-01](build-phase/p46-01-letter-index-data-scrubber-component.md) —
    letter map + component (includes the shared bucket-key/sortKey function
    and backfill)

Added 2026-07-04 (photo + detail-nav workstreams — run independently of the
scrubber; ∥ with each other except where deps noted):

16. ∥ [P46-02](build-phase/p46-02-contact-photo-display-fix.md) — contact
    photo display fix + diagnosis ("images not displaying"; media-host regex
    vs `MINIO_PUBLIC_URL`, detail-hero `onError` fallbacks). Feeds DB02.
17. ∥ [P46-05](build-phase/p46-05-contact-detail-tab-history.md) — detail
    tabs Back-to-list (already uses `<Link replace>` — diagnose, don't just
    re-add replace)
18. [P46-DB02](build-phase/p46-db02-design-brief-contact-photo-model.md) —
    photo model brief (2-variation set, optimize-on-upload/no raw original,
    cleanup, display resolution). Front-runs 19/20.
19. [P46-03](build-phase/p46-03-photo-storage-consolidation.md) — optimize on
    upload, drop raw original, delete superseded objects + orphan sweep
    (reuses the sync normalizer/cleanup)
20. [P46-04](build-phase/p46-04-contact-photo-upload-ui.md) — contact photo
    file upload UI, desktop + mobile (contacts are URL-paste only today)

Added 2026-07-04 (two more small workstreams — ∥ with each other and with the
photo/nav work; briefs front-run their builds):

20a. ∥ [P46-DB03](build-phase/p46-db03-design-brief-notification-aging.md) —
    notification aging brief (muted treatment for >7-day-old **and**
    event-passed notifications; desktop dropdown + mobile overlay; extends the
    original P22-DB05 notification brief). Front-runs P46-06.
20b. [P46-06](build-phase/p46-06-notification-aging-treatment.md) — build the
    aging/event-passed treatment (system is fully built; add the aging layer it
    lacks — no `expiresAt`/event date today). Low urgency (P2).
20c. ∥ [P46-DB04](build-phase/p46-db04-design-brief-mobile-contact-list-refresh.md)
    — mobile contact-list row brief (image + name + one optional secondary line
    + scrubber; supersedes the mobile section of 01-contacts-list.md). Row is
    mostly as-built, so this ratifies + documents.
20d. [P46-07](build-phase/p46-07-mobile-contact-list-row-polish.md) —
    **contingent** row polish; dropped if DB04 changes nothing (P3).

Added 2026-07-05 (brand/marketing brief; independent of all the above):

20e. ∥ [P46-DB05](build-phase/p46-db05-design-brief-social-media-assets.md) —
    social media assets brief (LinkedIn/X/Facebook/Instagram: profile + banner
    + featured images, slogans + bios). Extends brand-assets.md; no app code
    (external-platform uploads). P2.
20f. [P46-DB06](build-phase/p46-db06-design-brief-mobile-consistency-audit.md) —
    mobile UI consistency audit (mobile-only): one header system, one back
    contract, one banner stack across every screen; fixes the 3 header-less
    screens + icon-only settings back; removes the mobile Overview and relocates
    its options (Shared→Settings, health→People, wordmark→/contacts). Largest
    mobile surface in the phase; front-runs the mobile-chrome build tickets it
    will spawn. Desktop pass = future brief. P1.

### Phase 43 — interface preferences (gate passed; taste knob, low urgency)

16. [P43-DB01](build-phase/p43-db01-design-brief-interface-preferences.md) —
    two-knob brief (labels-on-rows, animations)
17. [P43-01](build-phase/p43-01-interface-preferences.md) — settings card +
    row enforcement

### Phase 40 — multi-book model (the big one; wants a quiet codebase)

18. [P40-01](build-phase/p40-01-schema-contact-book-membership.md) —
    `ContactBookMembership`
19. [P40-02](build-phase/p40-02-schema-contact-private-field.md) —
    `ContactPrivateField` + read-path helper
20. ∥ [P40-03](build-phase/p40-03-schema-sharing-policies.md) — sharing
    policies
21. ∥ [P40-04](build-phase/p40-04-schema-sync-destination-book.md) —
    `destinationBookId`
22. [P40-05](build-phase/p40-05-migration-backfill-default-books.md) —
    backfill + seeding (new accounts only; runbook first)
23. [P40-06](build-phase/p40-06-read-write-cutover.md) — read/write cutover
    (dual-write soak starts)
24. [P40-07](build-phase/p40-07-edit-context-resolution.md) — edit-context
    resolution (sync-ready interface)
25. [P40-08](build-phase/p40-08-sidebar-redesign-build.md) — sidebar
    redesign build

### Phase 41 — CardDAV projection (blocked on P40)

26. [P41-DB01](build-phase/p41-db01-design-brief-sync-projection-surfaces.md)
    — projection surfaces brief (start once P40-DB01 vocabulary settles;
    can overlap P40 build)
27. **Shared-shadow reconciliation** — one storage design for
    [P41-04](build-phase/p41-04-pushed-snapshot-store-inbound-diff.md),
    [P44-02](build-phase/p44-02-photo-change-detection-echo-suppression.md),
    and p34i-05's remote shadow. An ADR, not a ticket — do it before items
    28/31/33.
28. [P41-01](build-phase/p41-01-projection-config.md) — projection config
29. [P41-02](build-phase/p41-02-outbound-projection-v1.md) — outbound
    projection (V1)
30. ∥ [P41-03](build-phase/p41-03-sync-page-projection-grouping.md) — sync
    page grouping + honest copy
31. [P41-04](build-phase/p41-04-pushed-snapshot-store-inbound-diff.md) —
    snapshot store + inbound diff (V2)
32. [P41-05](build-phase/p41-05-conflict-override-edit-matrix.md) — conflict
    override + edit matrix (V2)
33. [P41-06](build-phase/p41-06-multi-connection-qa-matrix.md) —
    multi-connection QA (phase exit; real devices)

### Phase 44 — photo sync (research already running; build after the shadow ADR)

34. [P44-02](build-phase/p44-02-photo-change-detection-echo-suppression.md) —
    change detection + echo suppression ADR (needs P44-01 provider evidence
    and item 27)
35. [P44-03](build-phase/p44-03-inbound-photo-sync.md) — inbound photo sync
    (adds "Photos" to the P36 exclusions grid)
36. [P44-04](build-phase/p44-04-outbound-photo-push-normalization.md) —
    outbound push + normalization
37. ∥ [P44-05](build-phase/p44-05-photo-conflict-merge-surfaces.md) — photos
    in conflict/merge surfaces
38. [P44-06](build-phase/p44-06-photo-sync-qa-matrix.md) — photo QA matrix
    incl. the zero-write echo test (phase exit)

### Phase 45 — open export format (research done; spec tracks P40 decisions)

39. ∥ [P45-DB01](build-phase/p45-db01-design-brief-export-format-surfaces.md)
    — surfaces + **naming** (must land before the repo, item 42)
40. [P45-02](build-phase/p45-02-schema-spec-vcard-mapping.md) — schema spec +
    vCard mapping (hardens the [developer draft](../docs/contact-export-format-draft.md);
    book/privacy scoping tracks P40)
41. [P45-03](build-phase/p45-03-archive-container-spec.md) — archive
    container spec
42. [P45-06](build-phase/p45-06-open-source-publication.md) — public repo +
    validator
43. [P45-04](build-phase/p45-04-exporter.md) — exporter (after P40-02's
    read-path helper exists for privacy scoping)
44. [P45-05](build-phase/p45-05-importer.md) — importer + the round-trip
    proof
45. [P45-07](build-phase/p45-07-developers-page-format-docs.md) —
    `/developers` page + Help entry (last: never publishes ahead of the
    thing it documents)

## Standing caveat

The fifteen pre-plan 34-series phases (34G–34R) are not in this list. 34P
(test coverage) and 34Q (sync trust) deserve to interleave around the
Phase 39/42 slot; 34I/34J overlap P41/P44 and should be triaged before item
26. That triage is the outstanding item from the 2026-07-02 audit.
