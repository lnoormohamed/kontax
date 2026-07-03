# P37 · Part 2 — CardDAV Projection (Ship on top of the data model)

**Status:** Ticketed as **[Phase 41](../build-phase/phase-41.md)** (2026-07-02) — this doc remains the authoritative spec. Depends entirely on Part 1
([`01-data-model-build-now`]) being in place. Delivers the multi-book + privacy value
to **existing users on their existing devices** — no app install required.

**Decision needed before ticketing:** confirm the V1 (outbound) / V2 (inbound) split,
the precedence model, and how hard we lean into the known iOS limitations vs work
around them.

---

## 1. The principle: CardDAV is the dumb pipe, Kontax is the brain

CardDAV moves vCards. It has no concept of books, private vs shared fields, or source
attribution. **Every smart behaviour lives in the Kontax sync runner**, not the
protocol. A sync connection becomes a *projection* of a contact with two halves:

- **Outbound (Kontax → remote):** which books' fields this connection draws from, and a
  precedence order when two books carry the same field type with different values.
- **Inbound (remote → Kontax):** which book and which layer (shared/private) a returned
  edit lands in.

So each connection has a **read scope** (what it pushes) and a **write target** (where
edits return). `SyncAccount.destinationBookId` (added in Part 1) is the write target;
the projection rules below are the read scope.

---

## 2. What CardDAV does well here ✅

1. **Outbound projection is fully feasible.** Kontax builds the vCard. The Work iCloud
   connection pushes the work projection (work fields + work-shared fields); the
   Personal iCloud pushes the personal projection. The remote just receives a vCard.
2. **Multi-value fields dodge most "which value" conflicts.** vCard supports typed
   values — `TEL;TYPE=work`, `TEL;TYPE=home`. Different *types* both get pushed and the
   phone shows both, labelled. Precedence only fires when two books carry the **same
   type** with different values.
3. **Per-book write target works.** Work iCloud → Work book is a clean inbound rule.
   `SyncContactLink` already ties a remote card to a `contactId`, so the book context of
   a returned edit is known.

---

## 3. The genuine limitations — be honest in the UI ⚠️

| Limitation | Impact | Mitigation |
|---|---|---|
| **iOS auto-links cards across accounts** | Two iCloud accounts on one iPhone → iOS visually merges "the same person" into one card; edits may route to the *default* account, not the one Kontax expects. | Cannot fix at protocol level. Document it; recommend users keep one Kontax account per device where fidelity matters. |
| **Privacy is enforced only at the Kontax boundary** | Once a "private" field is on a device it can be AirDropped, backed up, re-shared. | Be explicit: "private" = not shown to other group members, *not* "can never leave". |
| **Inbound vCards lose layer/book attribution** | A returned card is a flat blob — doesn't say "this was the shared phone". | Kontax diffs the returned card against the last-pushed snapshot to infer what changed and which layer it belongs to. Engineering cost, not a free feature. |
| **No field-level merge in the protocol** | Three-way conflict (device vs shared layer vs another member) has only ETags, no merge. | Resolve at the Kontax layer via the connection's conflict-override rule (V2). |

**The one thing we cannot engineer around:** iOS auto-linking when two accounts live on
the same device. This *will* occasionally cross-contaminate work and personal. Set
expectations rather than promising it won't happen.

---

## 4. V1 — Outbound projection (ship first)

Delivers ~90% of the value and is fully CardDAV-compatible.

### 4.1 Per-connection projection config

On `SyncAccount` / `SyncAccountSettings`:

- `destinationBookId` (from Part 1) — the book this connection reads from and writes to.
- A **field-precedence order** for same-type collisions, e.g. `["WORK", "PERSONAL"]`
  means: when a contact is in both books and both have a `TEL;TYPE=cell`, push the Work
  book's value. (Stored as JSON on `SyncAccountSettings`.)
- Honours the **sharing policy**: a connection scoped to a shared book never pushes
  fields the member's policy marks private.

### 4.2 Outbound build (runner)

For each contact in the connection's scope:

1. Gather the contact's fields from the shared `Contact` row **plus** the owner's
   `ContactPrivateField` rows *if the connection is personal* (a personal iCloud sees
   private fields; a shared-book connection does not).
2. Filter to the connection's book scope + sharing policy.
3. On same-type collision across books, apply the precedence order.
4. Emit one vCard. Push.

### 4.3 Worked example — two iClouds, one person ("John")

John is a work colleague and a personal friend. Different mobile numbers.

| Connection | Pushes |
|---|---|
| **Work iCloud** (scope: Work, favour work) | Name, work email, work mobile, job title. No home address, no notes (private). |
| **Personal iCloud** (scope: Personal, favour personal) | Name, personal email, personal mobile, birthday, home address. |

One `Contact` row. Two projections. The work iPhone never sees John's home address;
the personal iPhone never sees his job title (unless it's also in Personal).

---

## 5. V2 — Inbound reconciliation (fast-follow)

The harder half. Ships after V1 proves out.

### 5.1 The diff problem

A returned vCard is flat. To route an edit correctly, the runner:

1. Loads the **last-pushed snapshot** for that `SyncContactLink` (we already store
   ETags; V2 adds a stored snapshot of the projected vCard we last sent).
2. Diffs returned vs last-pushed to find changed fields.
3. Routes each change:
   - Field in the connection's book + covered by policy → update the **shared row**.
   - Field that maps to a **private** field type on a personal connection → update the
     owner's `ContactPrivateField`.
   - New field → lands in the connection's destination book/layer per its write target.

### 5.2 Conflict override per connection

When a returned edit collides with a change made elsewhere (shared book, another
connection), the connection's **conflict-override** decides the winner for same-type
fields. Builds on the existing `conflictPolicy` (`SERVER_WINS` / `DEVICE_WINS` /
`MANUAL`) but scoped per connection and per field-type-precedence.

### 5.3 The full edit-context matrix (target behaviour)

For a user with Work iPhone (syncs work-private + work-shared) and Personal iPhone
(syncs personal + work + shared):

**Work iPhone**
| Edit | Result |
|---|---|
| Private personal contact | Personal update (private layer) |
| Private work contact | Work update (private layer) |
| Same-person collision | Favour **work** fields |
| New contact | Created as **work private** |
| Shared contact edit | Updates the **shared book** |

**Personal iPhone**
| Edit | Result |
|---|---|
| Personal contact | Personal update |
| Work contact | Work update |
| Same-person collision | Favour **personal** fields |
| Shared contact edit | Updates the **shared book** |

> **Precondition:** shared contacts must already be synced into the relevant book before
> a device can edit them. A device can't *create* a shared-book membership — only edit
> what's been shared to it.

---

## 6. Sync Connections page changes

Today the rail groups by provider (Google / Microsoft / CardDAV — see
[`p35-db01-multi-account-sync`]). With books, regroup by **destination**:

```
PERSONAL BOOK
  └── Google Contacts (li@gmail.com)        ↕ Two-way

WORK BOOK
  └── Google Contacts (li@kontax.io)        ↕ Two-way
  └── Outlook / Exchange                    ↓ Import only

WORK TEAM  (shared)
  └── Google Workspace (admin-connected)    ↕ Two-way

FAMILY  (shared)
  └── iCloud (shared)                       ↓ Import only
```

Section header = book name. Connections nest under their destination. The
source→destination relationship is then obvious at a glance.

**Per-connection settings additions** (extends the P36 settings panel —
[`p36-db01-sync-account-settings`]):
- Destination book selector.
- Field-precedence order (V1).
- Conflict-override (V2).

---

## 7. Rollout / scope

| Stage | Scope | CardDAV-safe? |
|---|---|---|
| **V1** | Outbound projection: destination book, field filtering, same-type precedence. Sync page regroup by book. | ✅ Fully |
| **V2** | Inbound reconciliation: last-pushed snapshot, diff routing, per-connection conflict override. | ✅ With Kontax-side diffing |
| **Always** | Document iOS auto-link caveat + "private ≠ unleakable". | — |

---

## 8. Open decisions for you

1. **V1/V2 split** — ship outbound alone first, or hold for both? (Recommend: ship V1,
   it's safe and high-value; V2 needs the snapshot infrastructure.)
2. **Same-person matching** — match across connections by email, by `remoteUid`, or
   both? Affects how aggressively we collapse vs duplicate. (Recommend: email +
   `remoteUid`, fall back to fuzzy → merge suggestion rather than auto-merge.)
3. **Precedence granularity** — book-level precedence (whole Work book wins) or
   field-type-level? (Recommend: book-level for V1, field-type for V2.)
4. **How hard to fight iOS auto-link** — document only, or add guidance like "use one
   Kontax sync account per device"? (Recommend: document + gentle in-app guidance.)

---

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — Help: "How sync chooses which contacts go where" + iOS caveat
- [ ] Internal · engineering — `docs/`: sync projection + inbound diff/reconciliation
- [ ] Internal · admins/ops — runbook: diagnosing a mis-routed inbound edit

[`01-data-model-build-now`]: 01-data-model-build-now.md
[`p35-db01-multi-account-sync`]: ../design-briefs/p35-db01-multi-account-sync.md
[`p36-db01-sync-account-settings`]: ../design-briefs/p36-db01-sync-account-settings.md
