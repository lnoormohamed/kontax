# P45-07 — Publish the format docs on `/developers` (+ Help entry)

Status: Not started · Priority: P2 · Depends: [P45-02](p45-02-schema-spec-vcard-mapping.md), [P45-06](p45-06-open-source-publication.md)
Phase: [Phase 45](phase-45-open-export-format.md)

## Scope

The public, indexed `/developers` page (currently the REST API reference)
gains an **Export format** section or subpage: the human-readable spec —
document structure with the worked example, archive layout, field
conventions, versioning policy, and the vCard mapping table — sourced from
the P45-02 spec. **Single source of truth: the P45-06 repo is canonical; the
page renders/links it rather than forking the text.** Includes download links
to the JSON Schema files and the validator. Follows the existing page's
conventions — the `API_VERSION` review-comment pattern gets a matching
`FORMAT_VERSION` marker.

Division of audiences:
- `/developers` — the spec (this ticket).
- `/help` — the user-level entry ("Which export format should I use?" — the
  what's-kept comparison from P45-DB01; already covered by the phase's docs
  checklist).
- Marketing changelog — announces the format at launch.

## Acceptance

- A developer who has never seen Kontax can implement a reader for the format
  from the `/developers` page alone (spec + schema + example files).
- The page and the repo state the same `formatVersion`.
- SEO metadata follows the existing `/developers` pattern.
