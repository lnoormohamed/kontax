# P44-04 — Outbound photo push with per-provider normalization

Status: Built (flag-gated `PHOTO_SYNC_ENABLED`, off by default) · Priority: P1 · Depends: [P44-02](p44-02-photo-change-detection-echo-suppression.md), [P44-03](p44-03-inbound-photo-sync.md)
Phase: [Phase 44](phase-44-photo-sync.md)

> Built behind `PHOTO_SYNC_ENABLED` (off). Outbound normalizes to a canonical
> 1024px JPEG (under every P44-01 cap incl. iCloud's ~1MB) before push; CardDAV
> via a full-card PUT that carries the PHOTO (and preserves the remote photo on
> ordinary field-pushes so it is never wiped), Google via updateContactPhoto.
> The shadow is seeded from the provider-canonical copy immediately after push
> (read-back), and a rejected push latches `lastPushRejected` to avoid a retry
> loop. `IMPORT_ONLY` never pushes (cap gating). The two-cycle no-loop guarantee
> is proven in the selftest; live verification is [P44-06](p44-06-photo-sync-qa-matrix.md).

## Scope

Push local photos per [P44-01](p44-01-provider-photo-roundtrip-qa-harness.md)'s
measured per-provider caps — resize/re-encode **before** push so the provider
mutates as little as possible (minimizing echo). After a successful push,
immediately read back the provider's canonical copy to seed the shadow (this
is what makes P44-02's suppression work). Honour `syncDirection` and
`exportLabelFilter`.

## Acceptance

- A local photo change reaches each provider within its documented caps; the
  shadow holds the provider-canonical hash immediately after push.
- The no-loop guarantee holds: two full cycles after a push produce zero
  further photo writes (pre-verification of the
  [P44-06](p44-06-photo-sync-qa-matrix.md) echo test).
- `IMPORT_ONLY` accounts never push photos; filtered contacts follow
  `exportLabelFilter`.
