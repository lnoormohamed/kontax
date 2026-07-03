# P45-DB01 — Design Brief: Export Format Surfaces & Naming

Status: **Done** (2026-07-03). Brief delivered at
[roadmap/design-briefs/p45-db01-export-format-surfaces.md](../design-briefs/p45-db01-export-format-surfaces.md)
(companion visual canvas in the design tool). Naming decision: **Kontax
Archive** (.zip) / **Kontax contact** (.json) as UI labels only — neutral
extensions and MIME types, recognition via the in-file
`getkontax.com:formatVersion` property (P45-02 §7.4/§8). All six surfaces
implemented in-app same day (format picker + comparison, single-contact
export split-button + mobile share sheet, async archive job states with
notification, import recognition, open-format callout on data export).

## Purpose

Specify how the new open export format shows up in the product: the format
picker across every export surface, how we explain "what each format keeps"
without a spec lecture, the single-contact export/share entry points, and the
format's public-facing name.

## Background

- Phase 45 introduces one schema with two serializations: a per-contact JSON
  document and a zip archive (contacts + `media/` photos + optional vCard
  fallback). Existing surfaces already offer vCard/CSV: the export flows in
  import-export, export presets (`/settings/export-presets`), the contact
  detail, workspace bulk selection, and the full account data export.
- The existing export UX language (mode-focused export flow, presets) applies;
  this brief extends those surfaces, it does not redesign the export wizard.
- Naming constraint from
  [phase-37/04-open-standard-exploration.md](../phase-37/04-open-standard-exploration.md):
  a vendor-neutral name travels further than a Kontax-branded one. The brief
  owns the final call (product decision) — name, file extension, and MIME
  type land here.

## Scope

### In scope

1. **Format picker treatment** — wherever vCard/CSV is offered today, the new
   format joins as the recommended option. Per-format one-liners a
   non-technical user understands:
   - New format: "Everything — photos, custom fields, labels. Best for backup
     and moving to Kontax."
   - vCard: "Works with Apple, Google, Outlook. No custom fields or labels."
   - CSV: "Spreadsheets. Text fields only."
   A "what's kept" comparison (compact table or expandable) for users who ask.
2. **Single-contact export** — entry point on the contact detail (and its
   mobile sheet): downloads the bare document or a one-contact archive
   (P45-02 decides which the button does by default; the brief designs the
   affordance, including whether photo inclusion is a toggle).
3. **Bulk/archive export states** — the archive job runs async for large
   books (streams via the data-export job): progress state, ready-to-download
   notification, size estimate up front ("~180 MB with photos"), and the
   photo on/off toggle (photos dominate archive size).
4. **vCard-fallback toggle** — "Include a compatibility copy (.vcf)" checkbox
   on archive exports: default, copy, and where it sits.
5. **Naming** — evaluate and decide: product name for the format (neutral),
   file extension for the bare document and the archive, and how the name
   appears in UI copy ("Export as <Name>"). Include the open-source framing
   ("an open format — spec at <repo>") where it earns trust, e.g. the full
   data-export page.
   **Direction (updated 2026-07-02): docs-first, neutral extensions.** The
   branded `.kontax` extension was considered and set aside — standard
   `.json` / `.zip` extensions plus **published developer documentation** of
   the JSON structure is the chosen route (draft:
   [docs/contact-export-format-draft.md](../../docs/contact-export-format-draft.md)).
   Kontax's own projects interoperate through the documented schema, not a
   file suffix; a branded extension can be revisited later without any
   format change if a native app ever wants OS file association.
6. **Import side acknowledgement** — the import wizard's source picker gains
   the format (drag a `.═` archive in); design the recognized-format
   confirmation state ("Kontax archive — 1,240 contacts, 890 photos").

### Out of scope
- The export wizard's overall flow (shipped; extend only).
- The spec itself, schema, container internals (P45-02/03).
- Public card / QR adoption of the single-contact document (future phase;
  leave a hook in the naming decision).
- Third-party/developer docs site design (P45-06 repo README suffices).

## States to specify

Format picker: default, new-format selected (photo toggle + fallback toggle
visible), per-format "what's kept" expanded. Archive export: estimating,
in-progress, ready (notification + download), failed. Single-contact: default
and no-photo contact. Import recognition: valid archive, valid bare document,
corrupt/unsupported-version file. Desktop / mobile.

## Deliverables

A `p45-db01` brief in `roadmap/design-briefs/` per the house format: the
naming decision with rationale, copy deck for every one-liner and state
above, layout blocks for each surface touched, and the comparison-table
content — ready for P45-04/05 to build against.

## Dependencies
Depends on P45-01 (the field audit feeds the honest "what's kept" copy).
Blocks the UI portions of P45-04/05. Naming must land before P45-06 creates
the public repo.
