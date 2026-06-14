# P34E-07 — /developers docs base URL update

## Purpose

Update the `/developers` documentation page to use `https://api.getkontax.com/v1`
as the base URL for all API examples, replacing every occurrence of
`getkontax.com/api/v1` so developers see the canonical, clean URL from day one.

## Background

The developer docs page (`/developers`) was built in Phase 29 and uses
`https://getkontax.com/api/v1` as the base URL throughout. Now that
`api.getkontax.com` is the intended public API URL, all examples, code
snippets, and authentication instructions must be updated. This is a search-
and-replace-plus-review task — no logic changes.

## Scope

**In scope**
- Find and replace every occurrence of `getkontax.com/api/v1` with
  `api.getkontax.com/v1` in:
  - `src/app/developers/page.tsx` (or wherever the developers page lives —
    locate it by searching for `"getkontax.com/api/v1"` in `src/app/`)
  - Any child components imported by the developers page
  - Any inline OpenAPI or API reference snippet on the page
- Update `curl` example commands to use the new base URL.
- Update the "Authentication" section base URL.
- Update any SDK snippet or code block that shows the base URL.
- Final canonical URL displayed everywhere on the page:
  `https://api.getkontax.com/v1`

**Out of scope**
- The OpenAPI spec file itself — see P34E-09.
- Any docs not on the `/developers` page (e.g. the in-app Help).
- Any logic or API behaviour change.

## Design / Implementation Spec

### Finding all occurrences

```bash
grep -rn "getkontax.com/api/v1\|getkontax\.com/api/v1" src/app/developers/ src/app/_components/
```

Review each result. Some may be in JSX string literals, some in template
literals, some in raw text. Replace all with `api.getkontax.com/v1`.

### Example replacements

**Before:**
```bash
curl -H "Authorization: Bearer kt_live_xxx" \
  https://getkontax.com/api/v1/contacts
```

**After:**
```bash
curl -H "Authorization: Bearer kt_live_xxx" \
  https://api.getkontax.com/v1/contacts
```

**Before (in prose):**
> Make requests to `https://getkontax.com/api/v1`.

**After:**
> Make requests to `https://api.getkontax.com/v1`.

### Completeness check

After the replacement, verify no instance of the old URL remains:
```bash
grep -rn "getkontax.com/api" src/app/developers/
```
Expected: zero results.

### Backward compatibility note

The old URL (`getkontax.com/api/v1/...`) continues to work — the middleware
rewrite is one-directional and the original routes are unchanged. There is no
need to add deprecation notices for the old URL at this stage, but do not
actively advertise it.

## Acceptance Criteria
- The `/developers` page renders with `https://api.getkontax.com/v1` as the
  base URL in all code blocks, prose, and authentication examples.
- Zero occurrences of `getkontax.com/api/v1` remain in the developers page
  source files.
- Copying a `curl` command from the page and running it (with a valid token)
  returns the expected response via the new base URL.
- No other page (settings, contact detail, etc.) was accidentally changed.

## Risks / Open Questions
- If the developers page is MDX or has a separate content file (e.g.
  `src/content/developers.mdx`), locate and update that file as well.
- If any example shows a base URL hardcoded in a constant or environment
  variable used on the page, update the constant rather than replacing text in
  JSX — a centralised `API_BASE_URL` constant is preferable going forward.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · developers — /developers (P29-07): this IS the docs update
- [ ] External · users — in-app Help (P26-12): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [ ] Internal · engineering — docs/: none required
