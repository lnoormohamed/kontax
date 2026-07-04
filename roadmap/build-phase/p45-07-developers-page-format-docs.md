# P45-07 — Publish the format docs on `/developers` (+ Help entry)

Status: Built (2026-07-04) · Priority: P2 · Depends: [P45-02](p45-02-schema-spec-vcard-mapping.md), [P45-06](p45-06-open-source-publication.md)
Phase: [Phase 45](phase-45-open-export-format.md)

## Built

- **Export format section** added to
  [`/developers`](../../src/app/developers/page.tsx) (the existing public API
  reference), reusing the page's own components: intro (JSContact base + vendor
  namespace), Document structure with a worked JSON example, Archive layout
  (zip tree + manifest integrity example), Versioning policy, a vCard mapping
  table, and a Schemas & validator subsection. A `FORMAT_VERSION = "1.0"`
  constant + marker comment mirror the `API_VERSION` pattern; the page and repo
  state the same version. SEO metadata broadened (title/description) with the
  same canonical/robots pattern.
- **Artifacts served from the app** at `public/format/` so download links work
  independently of the (not-yet-pushed) GitHub repo: both JSON Schemas, both
  examples, the reference validator, and the full `spec.md`. Middleware
  `PUBLIC_PREFIXES` gains `/format/` — the matcher didn't exclude
  `.json/.zip/.mjs/.md`, so without this the artifacts 307-redirected to
  `/login`. **Canonical source stays the P45-06 repo** (`open-format/`); the
  page links it and mirrors the files rather than forking the text.
- Drift guard `npm run qa:phase45:openformat` extended to assert every
  `public/format/*` file matches its `open-format/` source byte-for-byte.

Verified: dev render (SSR HTML + live DOM show the section, 13 `/format/`
links, tables), every `public/format/*` serves 200 with the right content-type
after the middleware fix, guard + tsc clean. Full `next build`/prod not run
locally (shared `.next`); page is plain static JSX.

`/help` user-level entry and the marketing changelog announcement are the
phase's docs-checklist items, not this ticket.

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
