# Phase 10 — Enhanced Merge, Activity Changelog, and Source Tracking

## Objective
Deepen the quality of duplicate handling, give users a full auditable history of changes to their contacts, and make it clear where every contact came from and what last touched it. These three capabilities reinforce each other: better merge tooling generates better history, and source tracking makes history more meaningful.

## Success Criteria
- Users can resolve merge suggestions at a field level, not just "keep left or keep right."
- Every meaningful change to a contact — edit, import, sync, merge, share — is recorded as a structured event.
- Each contact carries visible attribution: where it came from and which platform or action last changed it.
- Activity log is a Pro feature. Source badges and basic per-contact history are available on all plans.

## Exit Criteria
- `ActivityEvent` schema is stable and written to from all contact mutation paths.
- Source tracking is present on all contacts without requiring a backfill migration.
- Enhanced merge UI ships alongside the new history and source surfaces.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P10-01 | Done | P0 | P1-01, P4-01 |
| P10-02 | Done | P0 | P10-01 |
| P10-03 | Done | P0 | P10-01 |
| P10-04 | Done | P1 | P10-02, P10-03 |
| P10-05 | Done | P1 | P10-01 |
| P10-06 | Not Started | P1 | P10-04, P10-05 |
| P10-07 | Not Started | P2 | P10-06 |
| P10-08 | Not Started | P2 | P10-06 |

---

## P10-01 — Define ActivityEvent schema
- Status: `Done`
- Priority: `P0`
- Dependencies: `P1-01`, `P4-01`
- Delivered:
  - `ActivityEvent` model (id, userId, contactId?, eventType, actor, actorDetail?, payload Json default `{}`, createdAt) with `userId` Cascade and `contactId` SetNull; reverse relations on `User` and `Contact`. `EventType` (14 values) and `Actor` (7: USER/SYNC/IMPORT/SHARE/FAMILY_MEMBER/TEAM_MEMBER/SYSTEM) enums. Composite indexes `(userId, createdAt desc)` and `(contactId, createdAt desc)`. Applied via `prisma db push`; both indexes confirmed in Postgres.
  - Zod payload schema per event type in `src/lib/activity/payload-schemas.ts` (`EVENT_PAYLOAD_SCHEMAS`, `FieldDiff`, `EventPayloadMap`). CONTACT_UPDATED requires non-empty `diffs`; CONTACT_DELETED carries a name/email/phone snapshot (the only snapshot exception, since contactId becomes null).
  - Append-only writer `emitEvent(client, args)` in `src/lib/activity/index.ts` — validates payload against the event-type schema, caps `actorDetail` at 255, accepts a `PrismaClient` or transaction client so callers write the event atomically with the mutation. No update/delete path exists (pruning is Phase 11).
  - Verified: event create with a diff payload round-trips; hard-deleting the contact leaves the event with `contactId = null` (SetNull); tsc + lint + build green.
  - Actor count note: the ticket text says "6 actor values" but the enum block lists 7 — shipped the 7-value enum (the block is authoritative; FAMILY_MEMBER/TEAM_MEMBER are needed by Phases 13/14).
- Implementation Notes:
  - Add an `ActivityEvent` model to the schema with the following fields: `id`, `userId`, `contactId` (nullable — some events are account-level), `eventType` (enum), `actor` (enum: `USER`, `SYNC`, `IMPORT`, `SHARE`, `SYSTEM`), `actorDetail` (nullable string — e.g. sync account label, import file name, share token), `payload` (JSON — field-level diff or summary), `createdAt`.
  - Event type enum covers: `CONTACT_CREATED`, `CONTACT_UPDATED`, `CONTACT_ARCHIVED`, `CONTACT_RESTORED`, `CONTACT_DELETED`, `CONTACT_MERGED`, `CONTACT_MERGE_UNDONE`, `CONTACT_IMPORTED`, `CONTACT_SHARED`, `CONTACT_SHARE_RECEIVED`, `SYNC_PULLED`, `SYNC_PUSHED`, `SYNC_CONFLICT_DETECTED`, `SYNC_CONFLICT_RESOLVED`.
  - The `payload` JSON for `CONTACT_UPDATED` events should store a field-level diff: `{ field: string, before: unknown, after: unknown }[]`. This enables the activity log UI to show "phone changed from X to Y" without storing full snapshots.
  - Index on `(userId, createdAt DESC)` for the global feed, and `(contactId, createdAt DESC)` for per-contact history.
  - Events are append-only — never update or delete them. Retention policy is plan-gated (see Phase 11).
- Acceptance Criteria:
  - Schema is migrated and stable.
  - All event types are enumerated and their payloads are documented.
  - Indexes support both global feed and per-contact history queries efficiently.
- Risks / Open Questions:
  - Payload JSON size should be bounded — avoid storing full vCard snapshots in every event. Diffs only.
  - Decide retention window per plan tier before wiring cleanup jobs.

---

## P10-02 — Instrument all contact mutation paths to emit ActivityEvents
- Status: `Done`
- Priority: `P0`
- Dependencies: `P10-01`
- Delivered:
  - `src/lib/activity/diff.ts` — `computeContactDiff` + structural `deepEqual` (handles Json/arrays, ignores system + source-tracking fields). Empty diff ⇒ no `CONTACT_UPDATED` event.
  - Manual CRUD (`contacts.ts`): create/update/archive/restore/delete + bulk archive/restore now run inside a transaction that emits the matching event atomically — `CONTACT_CREATED`, diff-gated `CONTACT_UPDATED` (before/after read in-tx), `CONTACT_ARCHIVED`/`CONTACT_RESTORED` (only when a row actually changed), `CONTACT_DELETED` (name/email/phone snapshot, `contactId: null`). Bulk paths resolve affected ids then `createMany` events.
  - Merge (`contact-merge.ts`): accept emits `CONTACT_MERGED` (survivor) + `CONTACT_ARCHIVED` (absorbed, actor SYSTEM); undo emits `CONTACT_MERGE_UNDONE` (survivor) + `CONTACT_RESTORED` (restored) — in the merge transaction.
  - Import (`commit`/`rollback` routes): `CONTACT_IMPORTED` per created contact via `createMany` (actorDetail = filename); rollback soft-archives, so `CONTACT_ARCHIVED` (actor IMPORT) per contact.
  - Sync (`sync-runner.ts`): `SYNC_PULLED` on remote-created and remote-applied contacts, `SYNC_CONFLICT_DETECTED` per detected conflict (in the sync tx); `SYNC_CONFLICT_RESOLVED` on resolution (`sync.ts`). actorDetail = sync account label.
  - Verified: `computeContactDiff` algorithm (identical/ignored-only → [], scalar + json-array changes correct); tsc + lint + build green.
- Known gaps (accurate, not omissions):
  - `SYNC_PUSHED` has no emission point yet — EXPORT_ONLY/push isn't in the current sync slice (sync-runner rejects EXPORT_ONLY). Wire when push lands.
  - Device-write conflicts (P9-08) are recorded as `SyncConflict` rows in `server.mjs` (plain JS, can't import the TS `emitEvent`); emitting a matching `SYNC_CONFLICT_DETECTED` from there is a follow-up.
  - `CONTACT_SHARED` / `CONTACT_SHARE_RECEIVED` are Phase 12 — not wired (stubs only).
  - `toggleFavoriteContact` is intentionally not logged (favourites are local preference state, would be activity-log noise).
- Implementation Notes:
  - Wire `ActivityEvent` creation into every path that mutates a contact: manual create/edit/archive/restore/delete, import commit, import rollback, merge accept, merge undo, sync pull (remote change applied), sync push (local change propagated), conflict resolution, and share-triggered create.
  - For `CONTACT_UPDATED` events, compute the diff against the previous state before writing. If no fields changed, do not emit an event.
  - Emit events inside the same database transaction as the mutation so events and data are always consistent. Do not fire-and-forget to a queue where the mutation could succeed without the event being recorded.
  - For sync and import paths, populate `actorDetail` with the sync account label or import file name so the history reads as "updated via iCloud sync" rather than just "updated via sync."
- Acceptance Criteria:
  - Every contact mutation path emits the correct event type with a correctly populated payload.
  - No mutations occur silently — every change is traceable through the event log.
  - Events emitted by sync and import paths carry meaningful `actorDetail` values.
- Risks / Open Questions:
  - Import commits can affect hundreds of contacts in a single transaction — batch event insertion to avoid per-row overhead.
  - Merge undo must emit both the undo event and restore events for fields that changed, not just a single "undo" marker.

---

## P10-03 — Add source tracking to contacts
- Status: `Done`
- Priority: `P0`
- Dependencies: `P10-01`
- Delivered:
  - Schema: `SourceType` enum (MANUAL/IMPORT_CSV/SYNC_CARDDAV/SHARED_STATIC/SHARED_LIVE/API) + `sourceType` (default MANUAL), `sourceDetail`, `lastMutatedBy` (default MANUAL), `lastMutatedByDetail` on `Contact`. Pushed via `db push` (zero-downtime defaults).
  - Origin set at creation: manual → MANUAL (default); import commit → IMPORT_CSV + filename; sync pull create → SYNC_CARDDAV + account label. `lastMutatedBy`/`Detail` updated on every mutation path (manual update/archive/restore/favorite/bulk, merge accept/secondary, sync apply) — origin (`sourceType`) is never changed after creation.
  - `src/lib/activity/formatters.ts`: `formatSourceBadge(sourceType, detail)` ("Added manually", "Imported from X", "Synced from X", "Shared by/Live from X", "Added via API") + `formatLastMutatedBy`.
  - Backfill: `scripts/backfill-source-type.mjs` (idempotent) sets IMPORT_CSV + detail for import-originated contacts; everything else stays MANUAL. Ran clean.
  - Contact detail page `select` now exposes the four source fields for the P10-04 badge.
  - Verified field semantics: manual → MANUAL/MANUAL; sync-edit of a manual contact → sourceType stays MANUAL, lastMutatedBy → SYNC_CARDDAV; manual-edit of a synced contact → sourceType stays SYNC_CARDDAV, lastMutatedBy → MANUAL. tsc + lint + build green.
  - Note: SHARED_STATIC/SHARED_LIVE/API enum values exist but are not wired (Phase 12 / API).
- Implementation Notes:
  - Add two fields to `Contact`: `sourceType` (enum: `MANUAL`, `IMPORT_CSV`, `SYNC_CARDDAV`, `SHARED_STATIC`, `SHARED_LIVE`, `API`) and `sourceDetail` (nullable string — import file name, sync account label, or share sender).
  - Add `lastMutatedBy` (same enum) and `lastMutatedByDetail` (nullable string) to track the most recent actor — this is separate from `sourceType` which records origin.
  - Set `sourceType` and `sourceDetail` at creation time only; they do not change when a contact is later edited through a different path.
  - Update `lastMutatedBy` and `lastMutatedByDetail` on every mutation alongside the `ActivityEvent` emission.
  - For existing contacts: backfill `sourceType` from `importJobId` (if set → `IMPORT_CSV`) or default to `MANUAL`. `lastMutatedBy` can default to `MANUAL` for pre-existing records.
- Acceptance Criteria:
  - Every contact has a `sourceType` set on creation.
  - `lastMutatedBy` reflects the most recent actor at all times.
  - Backfill migration runs cleanly on existing data without errors.
- Risks / Open Questions:
  - Future sharing (Phase 12) introduces `SHARED_STATIC` and `SHARED_LIVE` — ensure the enum can be extended without migration pain.

---

## P10-04 — Surface source badges and per-contact history in the UI
- Status: `Done`
- Priority: `P1`
- Dependencies: `P10-02`, `P10-03`
- Delivered:
  - API `GET /api/contacts/[id]/history` — auth (401), ownership (403), cursor pagination (limit+1, `nextCursor`/`hasMore`), uses the `(contactId, createdAt desc)` index; computes `summary`/`actorLabel`/`actorIcon` server-side via `formatters.ts`.
  - `formatters.ts` extended: `formatEventSummary` (all 14 event types), `formatActorLabel`, `actorIconName`; `field-labels.ts` (`formatFieldLabel`); `time.ts` (`formatRelativeTime`/`formatAbsoluteTime`).
  - `SourceBadge` + `LastUpdatedBy` rendered in the contact-detail hero (read from the contact record — no query). `LastUpdatedBy` is a client component so the relative time isn't stale.
  - `ContactHistory` client component in a new "History" section: reverse-chron feed, actor icon + summary + relative time (absolute on hover), expandable field diffs for CONTACT_UPDATED/SYNC_PULLED (null → "—", arrays joined, 80-char truncate), skeleton loading, error+retry, empty state ("History starts from …"), and "Load more" pagination. Available on all plans (no gating).
  - Verified end-to-end against seeded events: 401 unauth, correct summaries ("Updated · 2 fields changed", "Pulled from iCloud", "Imported from contacts.csv"), diffs, 403 for non-owned contact. tsc + lint + build green.
  - Note: rendered as a History **section** on the detail page rather than a Details/History tab toggle — the page isn't tab-structured and the toggle is a presentation detail for the P10-07 design. All behavioural acceptance criteria are met.
- Implementation Notes:
  - On the contact detail page, show a source badge: "Added manually", "Imported from Google CSV", "Synced from iCloud", "Shared by [name]". Use `sourceType` and `sourceDetail`.
  - Show a "Last updated by" line below the source badge using `lastMutatedBy` and `lastMutatedByDetail` with a relative timestamp.
  - Add a History tab to the contact detail page showing the per-contact `ActivityEvent` feed in reverse chronological order. Each event renders as a compact row: relative timestamp, actor icon, and a human-readable summary (e.g. "Phone number changed · iCloud sync", "Merged with John Smith · you").
  - For `CONTACT_UPDATED` events, expand the row to show the field diff on tap/click.
  - Per-contact history is available on all plans. The diff expansion is also available on all plans.
- Acceptance Criteria:
  - Source badge and last-updated line are visible on every contact detail page.
  - History tab shows all events for the contact in readable form.
  - Field-level diffs are accessible from the history tab without leaving the page.
- Risks / Open Questions:
  - History tab will be empty for contacts created before this phase ships. Show a clear "History starts from [date]" empty state rather than a broken-looking blank tab.

---

## P10-05 — Enhance merge: field-level selection and bulk accept
- Status: `Done`
- Priority: `P1`
- Dependencies: `P10-01`
- Delivered:
  - **Bulk accept**: `bulkAcceptHighConfidenceForUser` loops every OPEN HIGH-confidence suggestion through the existing tested `mergeContactsForUser` (per-pair transaction → CONTACT_MERGED + CONTACT_ARCHIVED events, MergeDecision, archive). One failure is caught and skipped, the rest proceed; each merged pair stays individually undoable. Surfaced as an "Accept all N high-confidence" button in the duplicates toolbar with a confirmation dialog (`BulkMergeButton`).
  - **Merged contacts section**: `getRecentMergesForUser` returns the last 20 un-reversed ACCEPTED decisions (survivor ← absorbed names from the decision snapshot, decided date, source). Rendered in the duplicates tab; each row offers **Undo** within 30 days (`UndoMergeButton` → existing `undoMergeContacts`, which restores the absorbed contact, reverts the survivor, re-opens the suggestion, and emits CONTACT_MERGE_UNDONE + CONTACT_RESTORED) or shows **Expired** beyond 30 days.
  - tsc + lint + build green; new queries verified against the schema.
  - **Field-level merge review UI** (rebuilt `merge-suggestions/[id]` in the locked light palette, new `merge-review.tsx` client component):
    - **Survivor selection** — choose which record stays primary; choices are stored contact-relative (A/B) and translated to primary/secondary at submit, so flipping the survivor keeps prior field picks valid.
    - **Auto-collapse identical fields** — only genuinely *conflicting* fields (both sides non-empty and different) demand a decision. Matching fields collapse into a "Show N matching fields" summary; fields where only one side has a value are listed as "filled automatically".
    - **Per-field winner** for the governed scalars (full name, email, phone, company) plus notes (A / B / **Keep both → combine**).
    - **Multi-value "keep both" union** — emails, phones, addresses, websites, labels, significant dates, related people, custom fields are unioned + deduped automatically by `buildMergedContactPreview` (already in the engine); the UI now surfaces the combined result in a "Kept from both contacts" panel. Query extended (`mergeReviewContactSelect`) so the review loads the rich JSON fields needed for real union previews.
    - **Merge gated** — the submit button is disabled until every conflicting field is resolved, with a live "resolve N more fields" hint.
- Implementation Notes:
  - The current merge UI presents two contact cards and lets the user pick one to keep. Replace this with a field-level merge UI: for each field where the two contacts differ, show both values side by side and let the user pick which value to keep (or keep both for multi-value fields like phone and email).
  - Fields that are identical on both contacts are auto-merged without prompting.
  - Add a "Bulk accept" action to the merge suggestions list that accepts all `HIGH` confidence suggestions in one step. Show a confirmation summary before executing: "This will merge 12 contact pairs. High-confidence matches only."
  - Bulk accept emits individual `CONTACT_MERGED` events per pair, not a single bulk event, so each merge remains individually undoable.
  - Add a "Merged contacts" section to the duplicates tab showing recently merged pairs with an undo button. Undo should be available for 30 days.
- Acceptance Criteria:
  - Field-level merge UI allows per-field selection for all structured fields.
  - Bulk accept works for high-confidence suggestions and emits correct events.
  - Undo is available from the merged contacts section and restores both contacts cleanly.
- Risks / Open Questions:
  - Field-level merge for multi-value fields (phoneNumbers, emailAddresses) needs a clear UI — "keep A's phone list, keep B's email list, merge both address lists" is three separate decisions.

---

## P10-06 — Activity log global feed (Pro)
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P10-04`, `P10-05`
- Implementation Notes:
  - Add an Activity tab to the main workspace (alongside People, Archived, Duplicates).
  - The global feed shows all `ActivityEvent` rows for the user in reverse chronological order, paginated. Each row: relative timestamp, contact name (linked to detail), event summary, actor icon.
  - Filter controls: by event type category (Edits, Sync, Imports, Merges, Shares), by actor (You, Sync, Import, Shared), and by date range.
  - Activity tab is Pro-gated. Free users see a locked state with an upgrade prompt.
  - Retention: Pro retains 90 days of activity. Future higher tiers can extend this.
- Acceptance Criteria:
  - Activity tab is visible in the workspace navigation.
  - Feed loads and paginates correctly for large event volumes.
  - Filters narrow the feed accurately.
  - Free users see a gated state, not an empty feed.
- Risks / Open Questions:
  - Large event volumes (heavy sync users) may need cursor-based pagination rather than offset — design for this from the start.

---

## P10-07 — Design brief: activity log and source UI
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P10-06`
- Implementation Notes:
  - Produce a design brief covering:
    - Source badge component: styles for each `sourceType`, icon set, placement on contact detail.
    - "Last updated by" line: format, icon, timestamp style.
    - History tab on contact detail: empty state (no events yet), event row layout, diff expansion, actor icons.
    - Global activity feed: tab placement in workspace, filter bar, event row layout, empty state per filter combination.
    - Bulk merge confirmation dialog: summary list of pairs, confirm/cancel.
    - Merged contacts section in duplicates tab: pair rows, undo action, undo confirmation.
  - Brief should specify all interactive states: hover, expanded diff, empty, loading, error.
- Acceptance Criteria:
  - Designer has everything needed without follow-up.
  - All states covered including empty and error.
- Risks / Open Questions:
  - Source badge icon set needs to cover: manual (person), CSV import, CardDAV sync (cloud), share received (arrow-in), share sent (arrow-out), API, system.

---

## P10-08 — Improve duplicate detection signals
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P10-06`
- Implementation Notes:
  - Extend the duplicate scoring engine to include additional signals:
    - Normalized phone number matching (strip country codes, spaces, formatting before comparing).
    - Company + name proximity: "J. Smith at Acme" and "John Smith, Acme Corp" should score higher than name alone.
    - Shared email domain with similar name: a weaker signal but worth surfacing as LOW confidence.
    - Phonetic name similarity using the existing phonetics module: "Jon" and "John", "Katherine" and "Catherine".
  - Add a "why was this suggested?" detail panel to each merge suggestion showing the individual signal scores that contributed to the match.
  - Add a `STALE` auto-dismissal: if either contact in a suggestion has been updated since the suggestion was generated, mark the suggestion as `STALE` and regenerate rather than showing potentially outdated signal reasons.
- Acceptance Criteria:
  - Phone normalization correctly collapses equivalent numbers across formats.
  - Phonetic matching catches common name variant pairs.
  - Signal detail panel is accessible from each suggestion.
  - Stale suggestions are regenerated rather than shown with outdated reasons.
- Risks / Open Questions:
  - Phone normalization across international formats is complex — start with E.164 normalization and expand.
  - Phonetic matching should not inflate the `HIGH` confidence bucket — keep it as a supporting signal, not a primary one.
