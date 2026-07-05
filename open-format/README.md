# Kontax Contact Export Format

An open, documented format for exporting and interchanging contacts — so your
data is never locked inside one app. One JSON document describes one contact; an
archive is just packaging around many of them, plus their photos.

- **Base standard:** [JSContact (RFC 9553)](https://www.rfc-editor.org/rfc/rfc9553)
  — a contact is a JSContact `Card`.
- **Extensions:** everything Kontax-specific lives under the `getkontax.com:`
  vendor namespace (RFC 9553 §1.8). A generic JSContact reader that ignores
  unknown properties still recovers a usable, mostly-complete contact.
- **No proprietary file type:** documents are plain `.json`, archives plain
  `.zip`. Recognition is by content (the `getkontax.com:formatVersion` property
  and `manifest.json`), never the file extension.

The full normative specification is in **[spec.md](spec.md)**. The machine-
checkable schemas are in **[schemas/](schemas/)**.

## Two serializations

| | File | Contains |
| --- | --- | --- |
| **Document** | `contact.json` | One `Card`. Photo inlined as a `data:` URI. |
| **Archive** | `contacts.zip` | `manifest.json` + `contacts/NNNN.json` + content-addressed `media/<sha256>.<ext>` + optional `vcards/contacts.vcf` compatibility copy. |

See [spec.md §7](spec.md#7-archive-container) for the archive container:
ordinal filenames, media deduplication, the manifest, and the per-entry
**integrity checksums** that make a truncated archive detectable.

## Versioning policy

Two independent version fields — don't conflate them:

- `version` — the JSContact spec version (`"1.0"`); changes only when RFC 9553
  itself revises.
- `getkontax.com:formatVersion` — the Kontax extension set's version,
  `MAJOR.MINOR`. **Current: `1.0`.**
  - **MINOR** bumps are additive (a new optional `getkontax.com:*` property).
    Older readers MUST still parse the document (unknown properties preserved,
    per RFC 9553 §1.7.4).
  - **MAJOR** bumps remove/rename/repurpose a property. A reader MUST reject a
    document whose major exceeds what it supports, with a clear error — never a
    silent partial import.

One JSON Schema file is published per major (`schemas/kontax-contact.v1…`,
`schemas/kontax-archive.v1…`).

## The vCard promise

Every property in the format maps to a **native vCard property where one
exists, or an `X-KONTAX-*` extension otherwise** — the mapping is enumerated end
to end in [spec.md §6](spec.md#6-complete-vcard-3040-mapping-table). The archive's
optional `vcards/contacts.vcf` is that projection, for tools that can't read
JSContact. It is lossy by construction (a generic reader drops the `X-` props);
the lossless source is always `contacts/`.

## Validate a file

The reference validator is **zero-dependency — Node.js ≥ 18, nothing to
install, no Kontax account.** It validates a document or an archive against the
published schemas, and for an archive it verifies the manifest integrity
checksums.

```sh
node bin/validate.mjs examples/daniel-cho.json
node bin/validate.mjs examples/example-archive.zip
```

Exit code `0` = valid, `1` = invalid, `2` = usage/IO error. Point it at any file
— a renamed `.zip` still validates, because recognition is content-based.

Example output for the archive:

```
Validating examples/example-archive.zip as archive (.zip)…
  ✓ manifest.json matches kontax-archive.v1 schema
  ✓ integrity verified (4 entries)
  ✓ all 2 contact document(s) match kontax-contact.v1 schema

VALID ✓
```

If you prefer a package binary: `npm install` then `npx kontax-validate <file>`.

## Examples

- [`examples/daniel-cho.json`](examples/daniel-cho.json) — a bare document with
  an inline photo, custom field, label registry, and multi-value entries.
- [`examples/example-archive.zip`](examples/example-archive.zip) — a small
  archive of two contacts that share one photo (so it exercises media dedup),
  with a `vcards/` fallback and a full integrity table.

## License

**MIT** (see [LICENSE](LICENSE)). Chosen for minimal adoption friction: an
interchange format wants the widest possible reuse in readers, writers, and
tools, and MIT is the least encumbered, most universally recognized permissive
license. Apache-2.0 was considered for its explicit patent grant, but this
repository is a format specification plus a small validator — there is no
substantial patentable implementation for that grant to protect — so the
simpler license wins.

---

This repository is the canonical home of the format. The Kontax apps
(export/import) implement exactly this spec at the same `formatVersion`.
