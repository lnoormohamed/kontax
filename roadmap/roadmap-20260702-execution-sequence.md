# Execution sequence — P38 close-out through Phase 46 (2026-07-02)

One flat list, in the order the work should be done. Items marked ⏳ are
long-running kick-offs: start them at their position, let them run, don't
wait on them. Everything else is do-then-move-on.

Already done at time of writing: P38-01, P38-02, P38-06, P38-08, P38-09,
P38-10.

| # | Item | What it is |
|---|---|---|
| 1 | ⏳ P44-01 | Photo round-trip QA harness (research; test accounts; 24h re-pulls) |
| 2 | ⏳ P45-01 | Export format field audit + JSContact (RFC 9553) gap analysis |
| 3 | ⏳ P40-DB01 | Design brief: books-first navigation (longest lead — start now) |
| 4 | P38-03 | Contacts page query consolidation |
| 5 | P38-04 | Request-scoped billing/shared-context cache |
| 6 | P38-05 | Optimistic UI for row-level mutations |
| 7 | P38-07 | Server hot-path micro-fixes |
| 8 | P38 exit | Capture before/after numbers (TTFB, payload, query count @ 500/2k/10k) |
| 9 | P43-00 | Post-P38 measurement gate (chips on/off) + framing decision |
| 10 | P39-DB01 | Design brief: sync enforcement states, dirty guard, mobile sheet |
| 11 | P39-02 | Runner: deletion-safety threshold (P0 trust fix) |
| 12 | P39-01 | Runner: sync-window enforcement (fix the DST storage flaw) |
| 13 | P39-03 | Runner: field exclusions |
| 14 | P39-04 | Runner: export label filter |
| 15 | P39-05 | Runner: retry sensitivity + failure notifications |
| 16 | P39-06 | Settings panel dirty guard |
| 17 | P39-07 | Mobile bottom-sheet for sync settings |
| 18 | P39-08 | Enforcement QA matrix & smoke test |
| 19 | P42-DB01 | Design brief: connection-loss banner & offline states |
| 20 | P42-01 | Connection-loss banner replaces full-page takeover |
| 21 | P46-DB01 | Design brief: alphabet scrubber |
| 22 | P46-01 | Letter index data + scrubber component |
| 23 | P40-01 | Schema: ContactBookMembership |
| 24 | P40-02 | Schema: ContactPrivateField |
| 25 | P40-03 | Schema: sharing policies (member + Teams floor) |
| 26 | P40-04 | Schema: SyncAccount.destinationBookId |
| 27 | P40-05 | Migration & backfill (existing books respected; seed new accounts only) |
| 28 | P40-06 | Read/write cutover from Contact.bookId (soak begins) |
| 29 | P40-07 | Edit-context resolution rules |
| 30 | P40-08 | Sidebar redesign build |
| 31 | P41-DB01 | Design brief: projection surfaces (needs P40-DB01 vocabulary) |
| 32 | — | **Reconcile shared snapshot/shadow design: P41-04 + p34i-05 + P44-02** (one storage, three consumers — decide before building any) |
| 33 | P41-01 | Per-connection projection config |
| 34 | P41-02 | Outbound projection build (V1) |
| 35 | P41-03 | Sync page projection grouping + honest-limitations copy |
| 36 | P41-04 | Pushed-snapshot store & inbound diff engine (V2) |
| 37 | P41-05 | Conflict override + edit-context matrix (V2) |
| 38 | P41-06 | Multi-connection QA matrix (real devices) |
| 39 | P44-02 | Photo change detection & echo suppression model |
| 40 | P44-03 | Inbound photo sync (provider → MinIO → avatarUrl) |
| 41 | P44-04 | Outbound photo push with normalization |
| 42 | P44-05 | Photos in conflict review & merge surfaces |
| 43 | P44-06 | End-to-end photo sync QA matrix |
| 44 | P43-DB01 | Design brief: interface preferences (consumes P43-00 decision) |
| 45 | P43-01 | Interface preferences build (labels-on-rows, animations) |
| 46 | P45-02 | Format schema spec + vCard mapping (hardens the docs/ draft) |
| 47 | P45-03 | Archive container spec |
| 48 | P45-DB01 | Design brief: export surfaces & naming |
| 49 | P45-04 | Exporter (single doc + bulk archive) |
| 50 | P45-05 | Importer — lossless round-trip |
| 51 | P45-06 | Open-source publication: repo, license, validator |
| 52 | P45-07 | Publish format docs on /developers (+ Help entry) |

## Standing notes
- **P43-01 (item 45) is a floater** — it may slot anywhere after item 9's
  gate; positioned late only because nothing depends on it.
- **34-series triage is not in this list** and remains outstanding: 34P (test
  coverage) and 34Q (sync trust) deserve to interleave around items 10–22;
  34I/34J must be triaged before item 32 (they share the snapshot-store
  design).
- Items 3, 10, 19, 21, 31, 44, 48 are the design-brief track — each can run
  while the preceding build items execute; their position marks the latest
  sensible start.
