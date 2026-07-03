# P45-DB01 — Export Format Surfaces & Naming

**Surface:** Format picker (import-export, `/settings/export-presets`, contact detail, bulk selection, full account data-export), single-contact export/share, async archive job, import wizard source picker
**Trigger:** Any export action; drag/drop or file-pick on import
**Priority:** P1 — blocks the UI portions of P45-04/05; naming must land before P45-06 creates the public repo.
**Related:** [P45-01](p45-01-format-research-jscontact-fit.md) (field audit → honest "what's kept" copy) · [P45-02](p45-02-schema-spec-vcard-mapping.md) (schema, versioning, recognition mechanism) · extends the shipped export card (`ie-export.jsx`) and presets — does **not** redesign the export wizard.

> **Companion visual:** `P45-DB01 Export Format Surfaces.html` (design canvas) renders every
> frame below against the locked design language. Frame ids (2·B, 4·C, 5·A…) are cross-referenced here.

---

## Naming decision (product call — owned here)

**Decided — docs-first, neutral extensions.** One open schema, two serializations.

| | Decision | Rationale |
|---|---|---|
| **Public name** | **Kontax Archive** (the `.zip`); a single document is a **Kontax contact** file | Human/provenance labels only — **not** a proprietary file type. UI copy: *"Export as a Kontax Archive."* |
| **File extension** | `.zip` (archive) · `.json` (document) | Standard, not branded. A third party opens plain `.json` — no Kontax file type to register or trust first. |
| **MIME type** | `application/zip` · `application/json` | No custom `application/vnd.kontax` — nothing to allot before a native app needs OS association. |

**Why this way**
- **Adoption beats branding.** Phase-37 found a vendor-neutral surface travels further. Neutral extensions + a published spec mean anyone can read the file without adopting a "Kontax" file type.
- **Interop is in the schema, not the suffix.** Kontax's own projects round-trip through the documented JSON (P45-02); recognition reads the in-file `getkontax.com:formatVersion` property.
- **The name can move freely.** Because recognition never depends on extension or label, we can rename or add a suffix later with zero format change.

**Set aside — `.kontax`**
- A branded extension earns its keep only with OS file-association + a MIME allotment — premature before any native app exists to register it.
- It would signal a *proprietary* format and cool third-party adoption — the opposite of the phase goal.
- Revisitable anytime: the bytes on disk don't change, only the suffix, so a future native app can adopt `.kontax` without a format bump. Hook left open for public-card/QR (future phase).

---

## Surface 2 — Format picker (every export surface) — frames 2·A–2·D

Wherever vCard/CSV is offered today, the new format joins as the **recommended, pre-selected** row, using the shipped export card's radio-row component. Two toggles reveal only under the selected archive row.

**Per-format one-liners (non-negotiable strings):**

| Format | One-liner |
|---|---|
| **Kontax Archive** `.zip` | Everything — photos, custom fields, labels. Best for backup and moving to Kontax. |
| **vCard 4.0** `.vcf` | Works with Apple, Google, Outlook. No custom fields or labels. |
| **CSV** `.csv` | Spreadsheets. Text fields only. |

- **2·B Default** — Kontax Archive selected. Toggles: **Include photos** (default on, drives a live size estimate `~180 MB`) and **Add a compatibility copy (.vcf)** (default off).
- **2·C Legacy selected** — selecting vCard/CSV surfaces one amber honesty note (informational, not error) naming what's dropped, linking to the comparison. No photo/fallback toggles for legacy formats.
- **2·D "What's kept" comparison** — compact/expandable table from the P45-01 audit. ✓ full · – partial (one-word qualifier) · ✕ dropped. Kontax Archive is the only all-✓ column — that *is* the argument. Partials are specific (vCard embeds one photo, maps labels → `CATEGORIES`, flattens repeats; CSV flattens structured fields).

vCard keeps its existing **Pro** gate unchanged.

---

## Surface 3 — Single-contact export & share — frames 3·A–3·C

New entry point on the contact detail (and mobile sheet). A **split-button**: the body runs the default (bare `.json` **Document**, downloads immediately — no async job); the caret opens Document / Archive / vCard.

- **3·A** — detail with the menu open; "Document" marked **DEFAULT**.
- **3·B** — no-photo contact: nothing special in UI; Document exports with no `photos` key. Custom fields are the honest reason to reach past vCard.
- **3·C** — mobile: caret becomes a bottom sheet; primary button **"Export and share"** hands to the OS share sheet.

Photo inclusion at one contact is decided by serialization (Document inlines `dataUrl`; Archive writes to `media/`), **not** a separate toggle. Files named `daniel-cho.json` / `.zip` / `.vcf`.

---

## Surface 4 — Bulk / archive export (async) — frames 4·A–4·D

Whole-book/account archive streams through the existing data-export job.

- **4·A Estimate & toggle** — size shown *before* committing (`~180 MB`, live-recomputed from the photo toggle). Same two toggles as the picker. "Prepare archive" starts the job without blocking.
- **4·B In progress** — determinate bar; copy frees the user: *"You can leave this page — we'll notify you."* Job survives navigation; clean Cancel.
- **4·C Ready** — completion arrives as an in-app **notification** (persists in the bell feed) and a transient **toast**. Download link is **time-boxed** ("expires in 7 days") stated up front; re-runnable after expiry.
- **4·D Failed** — red; reassures *"your contacts are untouched"* (export never mutates). **Try again** with same settings + quiet support link.

---

## Surface 5 — Import-side recognition — frames 5·A–5·C

The import source picker gains the format. Recognition is **content-based** — reads `getkontax.com:formatVersion` + `manifest.json`, never the extension (a renamed `.zip` still recognizes).

- **5·A Archive** — green dropzone; counts (contacts / photos / `formatVersion`) from the manifest before import. Continues into a mapping-free import (fields are native).
- **5·B Document** — file glyph (not the box) to distinguish from an archive; names photo + custom fields to confirm lossless single-contact round-trip.
- **5·C Corrupt / newer version** — two shapes:
  - *Newer major:* readers reject only newer majors (P45-02). Copy points at the fix — *"This file needs a newer Kontax… Update Kontax, then try again."*
  - *Corrupt/unrecognized:* *"We couldn't read this file. It may be damaged or not a Kontax export — try re-exporting it."* Never blames the user.

---

## Surface 6 — Open-standard framing — frame 6·A

Only on the full account data-export page (highest-trust surface). Neutral info callout: *"Your data, in an open format. A Kontax Archive is documented JSON and standard photos — no lock-in."* Links to the human-readable spec and the public repo (`getkontax/contact-format`, live once P45-06 lands; naming must match this brief). Used sparingly — elsewhere the picker one-liner carries the message without a spec lecture.

---

## Copy deck (deliverable)

Tone matches the shipped export card: plain, non-technical, no exclamation marks.

| Surface / state | String | Action |
|---|---|---|
| One-liner · Archive | Everything — photos, custom fields, labels. Best for backup and moving to Kontax. | RECOMMENDED |
| One-liner · vCard | Works with Apple, Google, Outlook. No custom fields or labels. | PRO |
| One-liner · CSV | Spreadsheets. Text fields only. | all plans |
| Photo toggle | Include photos — full-resolution, in a media/ folder (default on) | ~180 MB ↔ ~2 MB |
| Fallback toggle | Add a compatibility copy (.vcf) — a vCard fallback inside the zip for apps that can't read the archive. | default off |
| Legacy honesty note | Some data won't be included. Custom fields and labels aren't part of vCard. See what's kept before you export. | See what's kept |
| Single · Document | Document (.json) — one file, photo included. Best for a quick backup. | DEFAULT |
| Single · Archive | Archive (.zip) — photo as a separate file. For moving into another Kontax. | — |
| Single · vCard | vCard (.vcf) — add to Apple, Google, or Outlook contacts. | — |
| Mobile primary | Export and share | OS share sheet |
| Archive · estimate | Export this book — 1,240 contacts · 890 photos · ~180 MB with photos | Prepare archive |
| Archive · in progress | Preparing your archive… You can leave this page — we'll notify you. | Cancel |
| Archive · ready | Your archive is ready — 1,240 contacts · 890 photos · expires in 7 days. | Download |
| Archive · notification | Your Kontax Archive is ready. 1,240 contacts (182 MB). The download link is valid for 7 days. | Download |
| Archive · failed | Export didn't finish. Something interrupted the job — your contacts are untouched. | Try again |
| Import · archive | Kontax Archive recognized. Everything transfers — photos, custom fields, and labels come across intact. | 1,240 · 890 · v1 |
| Import · document | Kontax contact recognized. One contact, with its photo and custom fields. | 1 · v1 |
| Import · newer version | This file needs a newer Kontax. It's a Kontax Archive saved in format v2 — this version reads up to v1. Update Kontax, then try again. | rejected |
| Import · corrupt | We couldn't read this file. It may be damaged or not a Kontax export — try re-exporting it. | rejected |
| Open framing | Your data, in an open format. A Kontax Archive is documented JSON and standard photos — no lock-in. Read it, script it, or move it anywhere. | Read the spec |

---

## Out of scope
- The export wizard's overall flow (shipped; extend only).
- The spec itself, schema, container internals (P45-02/03).
- Public card / QR adoption of the single-contact document (future phase; naming leaves the `.kontax` hook open).
- Third-party/developer docs-site design (P45-06 repo README suffices).

## Dependencies
Depends on **P45-01** (field audit → honest "what's kept"). Blocks the UI portions of **P45-04/05**. Naming must land before **P45-06** creates the public repo.
