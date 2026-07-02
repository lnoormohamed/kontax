# P44-01 — Provider Photo Round-Trip QA Harness

## Status

Harness built and self-tested. Provider runs underway against the
live-test connections on the `li@linoormohamed.com` account (owner-approved
2026-07-03):

| Provider | Push + initial pull | 24h re-pull | Report |
| --- | --- | --- | --- |
| iCloud CardDAV (`cmqfr9674…`) | ✅ 2026-07-02/03 | ⏳ pending | `carddav-icloud.md` (initial) |
| Fastmail CardDAV (`cmq446geh…`) | ✅ 2026-07-02/03 | ⏳ pending | `carddav-carddav.fastmail.com.md` (initial) |
| Google (`cmqjx0xbz…`) | ✅ 2026-07-03 (after re-auth) | ⏳ pending | `google.md` (initial) |
| Nextcloud | ⏳ no account connected yet | — | — |

Headline findings so far:
- **iCloud stores photos byte-identically** (no recompression, EXIF
  survives) but re-hosts them behind an **authenticated URI** in the
  returned vCard (inbound fetch must send CardDAV credentials) and
  **rejects >1 MB uploads with HTTP 403** (cap between 19 KB and 3.2 MB —
  needs bisection). Etag + PHOTO value stable on no-op re-pulls.
- **Fastmail is fully transparent**: everything accepted incl. 3.1 MB,
  inline base64 back, byte-identical, EXIF intact.
- **Google always re-encodes**: 0/7 byte-identical, EXIF stripped on all,
  WebP→JPEG transcode; dimensions preserved (no square crop observed,
  contrary to the phase doc's assumption). Photo URL + person etag stable
  on no-op reads; default photo URL serves a 100px rendition, `=s0` the
  full stored copy. ⇒ Byte-hash comparison is unusable for Google echo
  detection; the shadow must hash Google's *canonical* copy (P44-02).

Test contacts (`P44 Photo QA …`) remain on all three providers until the
24h re-pull, then cleanup.

### Operational findings (side discoveries, not P44 scope)
- Both staging Google connections had dead refresh tokens (`invalid_grant`
  after ~10 days). Signature of the Google Cloud **OAuth consent screen in
  Testing status** (7-day refresh-token expiry) — staging Google sync will
  keep dying weekly until the OAuth app is moved to Production status.
- On Google's granular consent screen, an unticked Contacts checkbox
  produces a token with only `userinfo.email openid` — the P27-07 "scope
  reduced" state. First reconnect attempt hit exactly this.

## Purpose

Answer empirically, per provider: *"if we push photo X and pull it back, what
do we get?"* — acceptance limits, byte/dimension/format mutation, EXIF
survival, and whether any provider-side identifier is stable enough for
change detection. The recorded evidence feeds the P44-02 echo-suppression
design and, later, the 34I capability registry.

## What was built

- `scripts/phase44-photo-roundtrip-harness.ts` — the harness
  (`npm run qa:phase44:photos`), following the P37-12 QA-harness pattern
  (arg parsing, per-check PASS/FAIL, `--json`).
- `docs/photo-capability/README.md` — methodology + runbook; evidence JSON
  and rendered per-provider capability docs land in `docs/photo-capability/`.

### Design decisions

- **No product code touched.** The product strips photos today
  (`google-sync.ts` excludes `photos` from person fields; the CardDAV mapper
  has no `PHOTO` handling), so the harness builds raw vCards / calls People
  API photo endpoints (`people.createContact` → `updateContactPhoto` →
  `people.get(personFields=photos)`) itself. It measures the provider, not
  our mapper.
- **Reference set is deliberately non-square (4:3)** — square-cropping
  (documented Google behaviour) becomes detectable from returned dimensions
  alone. JPEG at 100/512/1024/2048 px, PNG + WebP at 512 px, one
  noise-filled JPEG > 1 MB (size-limit probe), each with an EXIF `Copyright`
  marker (`kontax-p44 <imageId>`).
- **HEIC**: sharp on this machine cannot *encode* HEIC (no HEVC encoder), so
  HEIC is covered by passing a real Apple-device file via `--heic-file=`.
- **Identifier stability** is measured two ways: two back-to-back no-op reads
  within a pull run (etag / photo URL / raw `PHOTO` value drift), and pull
  runs ≥ 24 h apart (`--mode=pull --label=24h`) for async re-processing.
- **Deterministic generation** for the sized images: colors/patterns are
  seeded from the image id, so re-running push produces identical bytes.
  (Exception: `jpeg-large` uses gaussian noise for its >1 MB size probe,
  which is random per run — harmless, since every comparison is against the
  hash recorded in that run's evidence file.)
- **Safety**: write modes (`push`, `cleanup`) hard-require
  `--confirm-test-account` and print the account owner before touching the
  provider. CardDAV pushes use deterministic UIDs
  (`kontax-p44-photoqa-<accountId>-<imageId>`) so re-pushes overwrite rather
  than duplicate; `cleanup` deletes exactly the contacts recorded in the
  evidence file.
- Google credential refresh is persisted back to `SyncAccount` exactly like
  the product connector, so the test account stays healthy for real syncs.

### Verified

- `--mode=selftest`: 37/37 checks pass — jpeg-large > 1 MB, EXIF marker
  embedded in every generated format, vCard 3.0 and 4.0 PHOTO bodies fold to
  ≤ 76 chars and round-trip byte-identical through the harness's own parser,
  generation is deterministic.
- `tsc --noEmit` clean.

## Remaining work

1. **24h re-pulls** (≥ 2026-07-04) for all three providers:
   `--mode=pull --label=24h`, then `--mode=cleanup --confirm-test-account`,
   then regenerate reports (`--mode=report`).
2. Fill in the *Reviewer notes* section of each rendered capability doc —
   which identifier P44-02 should trust per provider, and the outbound
   size/format caps P44-04 should normalize to.
3. Optional follow-ups: bisect the iCloud size cap (between 19 KB and
   3.2 MB); connect a **Nextcloud** account and run it (incl. `--vcard=4`);
   HEIC pass with a real Apple-device file (`--heic-file=`).

## Acceptance (from phase-44-photo-sync.md)

> The doc answers, for every provider we sync with, "if we push X and pull it
> back, what do we get?" with recorded evidence.

Met once the three provider runs above are recorded and reports rendered.
