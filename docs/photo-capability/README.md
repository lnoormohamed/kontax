# Provider photo capability documents (P44-01)

This directory holds the empirical evidence for how each sync provider treats
contact photos — the input to P44-02's change-detection/echo-suppression
design. Everything here is produced by the round-trip harness:

```
scripts/phase44-photo-roundtrip-harness.ts    (npm run qa:phase44:photos)
```

## Files

| File | What it is |
| --- | --- |
| `evidence-<provider>-<accountId>.json` | Raw recorded evidence (pushes, pulls, hashes, identifiers) |
| `google.md`, `carddav-icloud.md`, `carddav-<host>.md` | Rendered capability doc per provider (`--mode=report`) |

Both evidence and rendered docs are committed — they are the "recorded
evidence" the P44-01 acceptance criterion asks for.

## What the harness measures

Per provider, it pushes a reference set (JPEG/PNG/WebP at 100/512/1024/2048 px,
all 4:3 non-square, plus one JPEG > 1 MB, each with an EXIF marker; optional
real HEIC via `--heic-file=`), pulls each photo back, and records:

- **Acceptance** — which formats/sizes the provider takes (HTTP status per push)
- **Byte stability** — SHA-256 of returned bytes vs pushed bytes
- **Mutation** — returned dimensions (square-cropping shows up because inputs
  are non-square), format transcoding, EXIF marker survival
- **Identifier stability** — etag / photo URL / PHOTO value across two
  back-to-back no-op reads (is there anything reliable for change detection?)
- **Async re-processing** — a second pull ≥ 24 h later, compared byte-wise
  against the initial pull

## Runbook

> ⚠️ **push/cleanup write to the provider account.** Only ever use a
> **dedicated test account** (see `roadmap/build-phase/phase-44-photo-sync.md`
> sequencing notes). The harness refuses to write without
> `--confirm-test-account`.

1. Connect the dedicated test account in Kontax as a normal sync account
   (Google OAuth or CardDAV app-specific password) and note its
   `SyncAccount.id`.
2. Sanity check, no writes:
   `npm run qa:phase44:photos -- --account=<id> --mode=status`
3. Push the reference set + initial pull (one command):
   `npm run qa:phase44:photos -- --account=<id> --mode=push --confirm-test-account`
   - CardDAV defaults to vCard 3.0 bodies; measure 4.0 with `--vcard=4`
     (separate `--evidence=` path recommended).
   - Include a real Apple-device HEIC with `--heic-file=<path>`.
4. **≥ 24 hours later** (async re-processing check):
   `npm run qa:phase44:photos -- --account=<id> --mode=pull --label=24h`
5. Render the capability doc:
   `npm run qa:phase44:photos -- --account=<id> --mode=report`
   then fill in the *Reviewer notes* section by hand.
6. Remove the test contacts:
   `npm run qa:phase44:photos -- --account=<id> --mode=cleanup --confirm-test-account`

Offline check of the harness itself (no account, no DB):
`npm run qa:phase44:photos -- --mode=selftest`

## Providers to cover (P44-01 acceptance)

- [ ] Google (People API photo endpoints)
- [ ] iCloud (CardDAV, vCard 3.0 inline `PHOTO`)
- [ ] Nextcloud (generic CardDAV; vCard 3.0 and 4.0 runs)

Microsoft Graph is out of P44-01 scope (Google sync path shipped in P27;
Graph photos get their own pass when photo sync reaches Microsoft).
