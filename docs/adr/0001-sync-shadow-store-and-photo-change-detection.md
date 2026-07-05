# ADR 0001 — Per-link sync shadow store & photo change detection / echo suppression

Status: **Proposed** · Ticket: [P44-02](../../roadmap/build-phase/p44-02-photo-change-detection-echo-suppression.md)
Consumers: [P41-04](../../roadmap/build-phase/p41-04-pushed-snapshot-store-inbound-diff.md) · [p34i-05](../../roadmap/build-phase/p34i-05-per-link-remote-shadow-and-unsupported-field-preservation.md) · [P44-03](../../roadmap/build-phase/p44-03-inbound-photo-sync.md)/[P44-04](../../roadmap/build-phase/p44-04-outbound-photo-push-normalization.md)
Evidence: [`docs/photo-capability/`](../photo-capability) (P44-01) · Execution-sequence item 32

> This ADR is **design-only**. It defines storage shape and the decision table;
> no schema is pushed and no runner code changes here. The columns land when
> P44-03/04 build (see [§8 Consequences](#8-consequences)).

---

## 1. Context

Contact photos are not synced today: the Google runner's read mask and update
`personFields` deliberately exclude photos ([`google-sync.ts:74`](../../src/server/google-sync.ts), [`:369`](../../src/server/google-sync.ts)), and the CardDAV path never
reads or writes `PHOTO`. Contacts carry `avatarUrl` only. Phase 44 turns photo
sync on. The central hazard is the **echo loop**:

> push a photo → the provider recompresses/resizes it → the next pull sees
> "different bytes" → we import the provider's copy → local looks "changed" →
> we push again → forever.

The naive fix — "compare the bytes we pushed to the bytes we pulled" — **cannot
work**, because for at least one shipping provider (Google) the pulled bytes are
*never* equal to the pushed bytes (P44-01: 0/7 byte-identical). Any design that
falls through to a pushed-vs-pulled byte compare ships the echo loop. The
acceptance criterion for this ticket is precisely that **no case in the decision
table reduces to that comparison**.

Separately, three tickets each independently wanted per-link "what did the
provider last see" state:

| Consumer | Wants to remember, per (connection, contact) | Purpose |
| --- | --- | --- |
| [P41-04](../../roadmap/build-phase/p41-04-pushed-snapshot-store-inbound-diff.md) | the last **projection we pushed** (the vCard body) | diff an inbound card to infer *which field* changed, since inbound cards carry no layer/book attribution |
| [p34i-05](../../roadmap/build-phase/p34i-05-per-link-remote-shadow-and-unsupported-field-preservation.md) | the last **remote supported-field projection** + capability profile | reason about true deletions vs lossy provider projections; preserve provider-unsupported canonical fields |
| **P44-02** (this) | the provider's **canonical photo** + a photo change signal + a local photo version | detect a real photo change and suppress echoes |

The roadmap requires these be reconciled **before build** — "one mechanism,
three consumers" (execution-sequence item 32). Building a projection-only store,
then a shadow-only store, then a photo-only store would give three overlapping
lifecycles on the same row and three chances to orphan state.

### 1.1 Current schema footing

`SyncContactLink` (1:1 with a (connection, contact) pair) already carries the
seeds of this store:

```prisma
model SyncContactLink {
  remoteETag           String?   // card-/person-level ETag — NOT photo-specific (see §3.3)
  capabilityProfileId  String?   // p34i-01 capability profile
  supportedFieldShadow Json?     // p34i-05 remote shadow (partial today)
  // ...
  @@unique([syncAccountId, contactId])
}
```

The link cascade-deletes with both the account and the contact, so anything
stored here inherits a correct lifecycle for free.

---

## 2. P44-01 findings that drive the design

Summarised from [`docs/photo-capability/`](../photo-capability). The three columns that
matter for change detection are **byte stability**, **whether a photo-specific
identifier exists**, and **size caps**.

| Provider | Bytes stable round-trip | Re-encodes | Photo-specific identifier? | Size cap | PHOTO transport |
| --- | --- | --- | --- | --- | --- |
| **Google** (People API) | ✗ 0/7 identical | always (webp→jpeg, EXIF stripped, no square crop) | **yes** — dedicated photo endpoint URL/resource token, stable on no-op re-pull | ≥ 3191 KB accepted | separate photo endpoint (not a vCard field) |
| **iCloud** (CardDAV) | ✓ 6/6 identical | no | **no** — only card-level `getetag` | between 19 KB and 3193 KB (>1 MB → **HTTP 403**) | inline `PHOTO`, returned as an **authenticated URI** (fetch needs CardDAV basic auth) |
| **Fastmail** (CardDAV) | ✓ 7/7 identical | no | **no** — only card-level `getetag` | ≥ 3192 KB accepted | inline base64 `PHOTO`, transparent |

Two structural facts fall out of this table and shape everything below:

1. **No provider gives us a photo-specific ETag over the current transport.**
   Google's `person.etag` and CardDAV's `getetag` both change when *any* field
   changes — they answer "did the card change at all", not "did the photo
   change". A photo-specific signal must come from elsewhere.
2. **The reliable signal is different per provider, and the two options are
   complementary:**
   - Google churns bytes but exposes a stable **photo resource identifier** →
     use the identifier.
   - iCloud/Fastmail expose no photo identifier but are **byte-stable** → hash
     the decoded `PHOTO` bytes.

---

## 3. Decision

### 3.1 One per-link shadow store, three field families

Keep the store **on `SyncContactLink`** — it is already the 1:1 home, already
has `supportedFieldShadow`, and already has the correct cascade lifecycle. Do
**not** introduce a companion table (a join buys nothing here and adds an orphan
risk).

Follow the existing `supportedFieldShadow` precedent: **three sibling nullable
JSON columns**, one per field family, rather than a single opaque blob —

```prisma
model SyncContactLink {
  // ... existing fields ...
  projectionSnapshot   Json?   // P41-04 — last pushed vCard/projection body
  supportedFieldShadow Json?   // p34i-05 — last remote supported-field projection (exists)
  photoShadow          Json?   // P44-02 — photo change-detection state (§3.4)
}
```

Rationale for three columns over one blob:

- **Independent write cadence.** A non-photo field edit rewrites
  `projectionSnapshot`/`supportedFieldShadow` but must not touch `photoShadow`
  (and vice-versa) — separate columns make "don't churn the other family" the
  default, not a merge discipline.
- **Debuggability.** Support can read one family without decoding the others.
- **Shared row, shared lifecycle.** They live on one row so a link tombstone/delete
  cascades all three atomically — this is the "one mechanism" the roadmap asks
  for. The runner seeds/updates them in the **same post-sync transaction**.

### 3.2 The card-level ETag is a coarse gate, not a family signal

`remoteETag` stays where it is and keeps its current meaning: "the card/person
changed since we last saw it." It is a cheap first gate — if the ETag is
unchanged, nothing on the card changed and every family is unchanged, so the
runner can skip decode entirely. But an ETag *change* says nothing about
*which* family changed, so it must never be used as a photo-changed signal.
This is written down here because it is the most tempting wrong turn.

### 3.3 Photo change signal is provider-specific, selected by the capability registry

Define an abstract **`remotePhotoSignal`** with two implementations, chosen per
connection by the p34i-01 capability registry (photos become a registry entry,
not a special case):

| Registry attribute | Providers | How "remote photo signal" is computed | Why |
| --- | --- | --- | --- |
| `photoChangeSignal: "resourceIdentifier"` | Google | the photo endpoint's resource URL / token | bytes churn → a hash is useless; the identifier is stable across no-op re-pulls |
| `photoChangeSignal: "contentHash"` | iCloud, Fastmail, generic CardDAV | SHA-256 of the **decoded** `PHOTO` bytes | no photo-specific identifier exists, but bytes are byte-stable → the content hash is exact |

For `contentHash` on providers that return `PHOTO` as an **authenticated URI**
(iCloud), the extractor must fetch the URI with the connection's CardDAV
credentials before hashing; for inline base64 (Fastmail) it hashes the decoded
value directly. Both reduce to "SHA-256 of the image bytes the provider holds."

### 3.4 `photoShadow` shape

```jsonc
{
  "signalKind":        "resourceIdentifier" | "contentHash", // from the capability registry
  "remoteSignal":      "<Google photo resource token | sha256 of decoded PHOTO bytes>",
  "remoteCanonicalHash": "<sha256 of the bytes the provider returned after our last push>",
  "localPhotoHash":    "<sha256 of the canonical local image in MinIO>",
  "localPhotoVersion": 7,                 // monotonic; bumped on any local avatar change
  "normalizedForProvider": { "format": "jpeg", "maxDim": 2048, "capBytes": 1048576 },
  "lastSyncedRemoteAt": "2026-07-04T00:00:00Z",
  "lastPushRejected":  false,             // e.g. iCloud >1 MB → HTTP 403; latch so we don't retry-loop
  "photoExcluded":     false              // P39 field-exclusion family marker (§8)
}
```

- **`remoteSignal`** is the authoritative "did the remote photo change" value —
  the identifier for Google, the content hash for CardDAV. `remoteCanonicalHash`
  is stored for both providers as a diagnostic / secondary check and to detect
  Google async re-processing (see [§7 open questions](#7-open-questions)).
- **`localPhotoHash`** hashes the **canonical local original** stored in MinIO —
  *not* the per-provider re-encoded body we pushed. Local-change detection must
  be independent of provider normalization, otherwise capping a >1 MB photo for
  iCloud would make every subsequent sync think "local changed."

### 3.5 Seed the shadow from the provider's canonical copy, after every push

This is the mechanism that makes echo suppression work, and it is the whole
reason the shadow stores "what the provider returned" rather than "what we sent."

After a successful outbound push (P44-04), the runner **immediately reads the
photo back** from the provider, computes `remoteSignal` + `remoteCanonicalHash`
from that read-back, and writes them to `photoShadow` alongside the
`localPhotoHash`/`localPhotoVersion` that produced the push. From that moment the
provider's recompressed copy *is* the shadow, so the next pull that returns those
same recompressed bytes matches the shadow and reads as "remote unchanged."

---

## 4. Decision table

Local state is compared against `localPhotoHash`/`localPhotoVersion`; remote state
against `remoteSignal` (per §3.3). Neither axis ever compares pushed-vs-pulled
bytes.

| | **Remote unchanged** (`remoteSignal == shadow`) | **Remote changed** (`remoteSignal != shadow`) | **Remote deleted** (no photo remotely) |
| --- | --- | --- | --- |
| **Local unchanged** (`localPhotoHash == shadow`) | **no-op** ← echo suppressed here | **pull**: import remote, re-normalize, set `avatarUrl`, reseed shadow | **pull-delete**: clear `avatarUrl`, clear shadow (unless photo excluded / direction pull-only → preserve) |
| **Local changed** (`localPhotoHash != shadow`) | **push**: normalize, push, read back, reseed shadow | **conflict** → [P44-05](../../roadmap/build-phase/p44-05-photo-conflict-merge-surfaces.md) (both sides changed) | **conflict** → P44-05 (local edit vs remote delete); default policy = keep local, re-push |
| **Local deleted** (`avatarUrl == null`, shadow non-null) | **push-delete**: remove remote `PHOTO`, clear shadow | **conflict** → P44-05 (local delete vs remote change) | **no-op**: both gone, clear shadow |

Honour `syncDirection` (pull-only never pushes; push-only never imports) and
`exportLabelFilter`/`excludedFields` **before** consulting this table — an
excluded-or-filtered photo short-circuits to no-op regardless of state.

### 4.1 Echo suppression is exactly one cell — proven

The echo loop is the **Local unchanged × Remote unchanged** cell. It resolves to
no-op *because* §3.5 seeded the shadow with the provider's canonical copy:

- **Google**: the read-back stored the stable photo resource token as
  `remoteSignal`. The next pull reads the same token → `remoteSignal == shadow`
  → remote unchanged. The fact that the bytes differ from what we pushed is
  **never consulted** — we compare token-to-shadow, not pushed-to-pulled.
- **iCloud / Fastmail**: the read-back stored the SHA-256 of the provider's
  stored bytes. Bytes are byte-stable (P44-01), so the next pull hashes to the
  same value → remote unchanged.

In both rows the comparison is *pulled-signal vs shadow-seeded-from-a-prior-pull*,
never *pulled vs pushed*. That satisfies the acceptance criterion.

---

## 5. Per-provider walkthrough (acceptance)

Every provider from P44-01 is walked through the table; no cell falls through to
a pushed-vs-pulled byte compare.

**Google (People API).** `photoChangeSignal = resourceIdentifier`. Bytes are
never stable, so byte comparison is abandoned entirely; the photo endpoint's
resource token is the signal. Read-back-after-push (§3.5) seeds that token.
No-op cell holds because the token is stable across no-op re-pulls (P44-01).
Re-encode churn (webp→jpeg, EXIF stripped) is irrelevant — it changes bytes, not
the token. Open risk: async re-processing possibly rotating the token — see §7.

**iCloud (CardDAV).** `photoChangeSignal = contentHash`; the card-level
`getetag` is used only as the coarse gate (§3.2). Bytes are byte-stable so the
content hash is exact and the no-op cell holds. The `PHOTO` arrives as an
authenticated URI → the `contentHash` extractor fetches it with the connection's
CardDAV credentials before hashing. **Size cap**: >1 MB is rejected with HTTP
403; P44-04 must resize below the cap *before* pushing, and a push that is still
rejected latches `lastPushRejected = true` so the runner does not retry-loop on
every cycle. That latch is cleared only when `localPhotoVersion` advances.

**Fastmail (CardDAV).** `photoChangeSignal = contentHash`. Fully transparent,
inline base64, byte-stable, generous cap — the easiest case; content hash is
exact and no special handling is needed. Serves as the generic-CardDAV reference
(P44-01 waived Nextcloud since Fastmail covers generic CardDAV).

**Microsoft Graph** is out of scope for Phase 44 (Google is the shipped OAuth
path); when Graph photo sync lands it gets its own capability-registry entry and
signal kind.

---

## 6. No-loop guarantee

**Claim:** two full sync cycles with no user change produce zero photo writes on
either side.

*Proof.* Take the state immediately after any successful sync of a contact's
photo. §3.5 guarantees `photoShadow` holds the provider's current
`remoteSignal` and the current `localPhotoHash`.

- **Cycle 1.** Remote signal is re-extracted and equals `shadow.remoteSignal`
  (Google: stable token; CardDAV: byte-stable hash) → remote unchanged. Local
  hash equals `shadow.localPhotoHash` → local unchanged. Table → **no-op**, zero
  writes, shadow untouched.
- **Cycle 2.** State is identical to the start of cycle 1 → same evaluation →
  **no-op**.

Because neither cycle writes, the shadow never drifts, so the guarantee holds for
all subsequent cycles by induction. ∎

This becomes a [P44-06](../../roadmap/build-phase/p44-06-photo-sync-qa-matrix.md) test: seed a photo, run the runner twice
with no change, assert `pushedUpdatedCount == 0` and `updatedCount == 0` for the
photo family on both runs, across Google + iCloud + Fastmail.

---

## 7. Open questions

1. **Google async re-processing (blocking P44-03).** P44-01's ≥24 h re-pull is
   still outstanding (see [`project_p44-01-photo-roundtrip-state`]). If Google
   re-encodes a photo asynchronously *and* rotates the resource token, the
   no-op cell would false-positive into a spurious pull once. Mitigation kept in
   the shape: `remoteCanonicalHash` is stored for Google too, so an
   identifier-changed-but-hash-equal read can be recognised as a re-encode echo
   rather than a real change. **Confirm the 24 h behaviour before P44-03
   builds**; if the token is unstable, promote `remoteCanonicalHash` to a
   tie-breaker in the Google `resourceIdentifier` path.
2. **vCard 4.0 `PHOTO` as URI.** iCloud already returns an authenticated URI on
   vCard 3.0; the `contentHash` extractor's credentialed fetch must be exercised
   in P44-01's vCard-4 run before P44-03 relies on it.
3. **HEIC** ingestion is deferred to P44-03 (P44-01 waiver). The shadow shape is
   format-agnostic (it hashes decoded bytes / stores a token), so no change here.

---

## 8. Consequences

- **Schema is not pushed by this ticket.** `projectionSnapshot`/`photoShadow`
  columns are additive and land when P41-04 and P44-03/04 build. Adding them
  together (or as one migration) keeps the "one mechanism" promise visible in the
  schema.
- **Capability registry gains a `photoChangeSignal` attribute** (p34i-01),
  values `resourceIdentifier | contentHash`, defaulted per provider as in §3.3.
- **Photos are a P39 field-exclusion family.** `photoShadow.photoExcluded`
  mirrors the excluded state; P44-03 adds a "Photos" entry to the P36 Field
  Exclusions grid and coordinates with P39-03 so the enforcement seam accepts a
  value it did not originally list.
- **P41-04 and p34i-05 inherit this ADR's storage decision** — they add their
  own sibling column on the same row rather than a private store, and their
  acceptance ("doc/ADR shows the three consumers and their field families") is
  satisfied by §3.1.
