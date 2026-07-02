# Phase 44 — Contact Photo Sync (research, change detection, round-trip)

> **Mini-phase.** Contact photos are currently **not synced at all**: the
> Google runner skips photo fields explicitly (`google-sync.ts` — "we don't
> sync those fields (metadata/photos)"), and the CardDAV read/write path has
> no `PHOTO` handling. Contacts carry `avatarUrl` only. Before building photo
> sync, three questions must be answered *empirically*, because providers are
> known to mutate images in transit: **does the provider compress or change
> the image? how do we sync it? how do we detect a real change?**

## Phase status
In build — P44-01 harness built (`scripts/phase44-photo-roundtrip-harness.ts`,
see `p44-01-provider-photo-roundtrip-qa-harness.md`); provider runs pending
dedicated test accounts.

## Phase objective
Ship two-way photo sync that never churns. The central hazard is the **echo
loop**: we push a photo → the provider recompresses/resizes it → the next
pull sees "different bytes" → we import the provider's copy → local "changed"
→ we push again → forever. Everything in this phase is structured around
proving provider behaviour first (P44-01), designing change detection that
survives it (P44-02), and only then building the pipes (P44-03/04).

## Known provider realities to verify (not assume)
- **Google People API** uses dedicated photo endpoints (not a contact field);
  it crops to square and re-encodes — returned bytes will not match pushed
  bytes.
- **iCloud CardDAV** stores `PHOTO` inline base64 in the vCard; size limits
  and re-encoding behaviour are undocumented and must be measured.
- **Generic CardDAV** varies per server (inline base64 vs URI; vCard 3 vs 4
  encoding differences).
- **HEIC** uploads from Apple devices may arrive in formats we don't want to
  store or re-push.

## Tickets

| Ticket | Title | Priority | Depends on |
| --- | --- | --- | --- |
| [P44-01](p44-01-provider-photo-roundtrip-qa-harness.md) | Provider photo round-trip QA harness | P0 | — |
| [P44-02](p44-02-photo-change-detection-echo-suppression.md) | Photo change detection & echo suppression model | P0 | P44-01 |
| [P44-03](p44-03-inbound-photo-sync.md) | Inbound photo sync (provider → MinIO → `avatarUrl`) | P1 | P44-02 |
| [P44-04](p44-04-outbound-photo-push-normalization.md) | Outbound photo push with per-provider normalization | P1 | P44-02, P44-03 |
| [P44-05](p44-05-photo-conflict-merge-surfaces.md) | Photos in conflict review & merge surfaces | P2 | P44-03 |
| [P44-06](p44-06-photo-sync-qa-matrix.md) | End-to-end photo sync QA matrix | P1 | P44-03, P44-04 |

> Tickets are split into standalone files (linked above); the sections
> below remain the phase-level overview.

### P44-01 — Provider photo round-trip QA harness
The "testing images" core. A scripted harness (follow the P37-12 QA-harness
pattern) that, per provider (Google, iCloud CardDAV, generic CardDAV —
Nextcloud at minimum):
1. Pushes a reference set: JPEG / PNG / WebP (+ HEIC where uploadable) at
   ~100px, 512px, 1024px, 2048px, and one file > 1 MB, each with EXIF and an
   embedded marker.
2. Pulls each back and records: bytes identical? (hash), dimensions, format,
   EXIF survival, and the stability of any provider-side identifier (etag,
   photo metadata, `PHOTO` value) across a no-op re-pull.
3. Repeats the pull after 24h (some providers re-process asynchronously).

Output: a per-provider **photo capability document** in `docs/` — max size,
formats accepted, whether bytes are stable, what identifier is reliable for
change detection. This feeds the 34I capability registry (photos become a
registry entry, not a special case).

Acceptance: the doc answers, for every provider we sync with, "if we push X
and pull it back, what do we get?" with recorded evidence.

### P44-02 — Photo change detection & echo suppression model
Design ticket (ADR-style). Given P44-01's findings, define how we know a
photo *actually* changed:
- Per sync link, store a **photo shadow**: the hash of the provider's
  *canonical* copy (what the provider returned after our last push — not what
  we sent), plus the provider's photo identifier and a local photo version.
  Coordinate storage with the P41-04 pushed-snapshot store / p34i-05 remote
  shadow — one mechanism, photo is another field family in it.
- Decision table covering: local change only → push; remote change only →
  pull; provider recompressed our own push → **no-op** (echo suppressed);
  both changed → conflict (P44-05); photo deleted on either side.
- Explicit no-loop guarantee: two full sync cycles with no user change
  produce zero photo writes on either side — this becomes a P44-06 test.

Acceptance: the decision table reviewed against every provider behaviour
recorded in P44-01; no case falls through to "compare raw bytes of pushed vs
pulled".

### P44-03 — Inbound photo sync
Pull provider photos into Kontax: fetch (People API photo / vCard `PHOTO`
decode), normalize (re-encode to our canonical format, cap dimensions, strip
EXIF for privacy), store in MinIO alongside the existing S3/data-export
plumbing, set `avatarUrl`, update the photo shadow. Respect
`excludedFields` (Phase 39) — photos become an excludable field family, which
also means the P36 settings panel's Field Exclusions checkbox grid gains a
"Photos" entry (small UI addition; coordinate with P39-03 so the enforcement
seam handles a value it didn't originally list).
Emits activity events; counts toward the P38-08 thumbnail pipeline rather
than duplicating it.

### P44-04 — Outbound photo push with normalization
Push local photos per P44-01's per-provider caps (resize/re-encode *before*
push so the provider mutates as little as possible — minimizing echo). After
a successful push, immediately read back the provider's canonical copy to
seed the shadow (this is what makes P44-02's suppression work). Honour
`syncDirection` and `exportLabelFilter`.

### P44-05 — Photos in conflict review & merge surfaces
When both sides changed (P44-02 conflict case) or a merge candidate pair has
two photos: show the two images side-by-side with a pick, in the existing
conflict-review (P23-05) and merge surfaces. Small design addendum to the
existing briefs rather than a full new brief — photo-specific states: broken
image, both-identical-after-normalization (auto-resolve), oversized preview.

### P44-06 — End-to-end photo sync QA matrix
Staging pass across Google + iCloud + Nextcloud with a seeded photo set:
add/change/delete on each side, the no-op double-cycle echo test (zero writes
— the P44-02 guarantee), excluded-fields off-switch, a 5,000-contact account
for storage/runtime cost, and real-device verification that iOS/Android
contact apps display the synced photos. Results recorded in the ticket
(P37-12 sign-off format).

## Sequencing notes
- P44-01 can start any time — it needs no product code, and it writes only to
  **dedicated test accounts** (it pushes reference images, so it is not
  read-only: never point it at a real user's provider account).
- P44-02's shadow storage must be reconciled with Phase 41's snapshot store
  and p34i-05 *before* either builds — same storage, three consumers.
- Do not start P44-03/04 until the capability doc exists; building the pipe
  before knowing provider mutation behaviour is how the echo loop ships.

## Documentation (per roadmap/documentation-policy.md)
- [ ] External · users — in-app Help: how contact photos sync, what quality
      to expect per provider
- [ ] Internal · engineering — docs/: per-provider photo capability doc
      (P44-01 output) + change-detection ADR (P44-02)
- [ ] Internal · admins/ops — runbook: diagnosing photo churn / storage growth
