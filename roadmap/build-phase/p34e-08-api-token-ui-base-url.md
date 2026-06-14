# P34E-08 — Token UI base URL update

## Purpose

Update the API token management UI in Settings to display
`https://api.getkontax.com/v1` as the base URL, so users who create a token
immediately see the correct URL to use — without needing to visit the developers
documentation page.

## Background

Phase 29 (P29-05/P29-03) shipped the API token management panel in Settings.
This panel likely shows users a getting-started snippet or the base URL
alongside their newly created token. If it currently shows
`https://getkontax.com/api/v1`, developers who copy the displayed URL into
their apps will use the old path rather than the clean subdomain. This is a
targeted text update — no logic change.

## Scope

**In scope**
- Locate the API token management UI in `src/app/settings/` (search for the
  component that renders API tokens — likely `settings/api/` or
  `settings/developers/` or similar).
- Update every display of the base URL from
  `https://getkontax.com/api/v1` to `https://api.getkontax.com/v1`.
- Update any example `curl` command shown after token creation (the "copy this
  command to get started" snippet, if present).
- If a `const API_BASE_URL = "..."` or equivalent constant exists in the
  settings area, update it there rather than at every render site.

**Out of scope**
- The token format, generation logic, or storage.
- The `/developers` page — see P34E-07.
- Any backend route that checks the base URL.

## Design / Implementation Spec

### Finding the token UI

```bash
grep -rn "getkontax.com/api\|API_BASE_URL\|api/v1" src/app/settings/ --include="*.tsx" --include="*.ts"
```

Review results and identify the token management component(s).

### Common patterns to update

**Displayed base URL in a code block or inline text:**
```tsx
// Before
<code>https://getkontax.com/api/v1</code>

// After
<code>https://api.getkontax.com/v1</code>
```

**Example curl command shown after token creation:**
```tsx
// Before
<pre>{`curl -H "Authorization: Bearer ${token}" https://getkontax.com/api/v1/contacts`}</pre>

// After
<pre>{`curl -H "Authorization: Bearer ${token}" https://api.getkontax.com/v1/contacts`}</pre>
```

### Centralise the base URL

If the base URL appears in more than two places within the settings token UI,
extract it to a constant:

```typescript
// src/lib/api-config.ts (or similar)
export const API_BASE_URL = "https://api.getkontax.com/v1";
```

Import and use `API_BASE_URL` everywhere it is displayed. This makes future
base URL changes a one-line edit.

### Token format unchanged

The token itself (format `kt_live_xxx`) is unchanged. Only the displayed base
URL and example snippets are updated.

## Acceptance Criteria
- Opening the API token management settings page shows
  `https://api.getkontax.com/v1` as the base URL.
- Creating a new token (or viewing an existing one) shows an example curl
  command using `https://api.getkontax.com/v1`.
- Zero occurrences of `getkontax.com/api/v1` remain in the settings token UI
  source files.
- No change to token creation, listing, or revocation logic.

## Risks / Open Questions
- If the base URL is rendered from an API response (e.g. the server sends back
  a `baseUrl` field), update the server-side value rather than the client
  component. Check whether the token API response includes any URL strings.
- If there is no example curl command in the current token UI, note that as a
  gap but do not build one in this ticket — scope is update-only.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): none required (UI is self-describing)
- [x] External · developers — /developers (P29-07): consistent with P34E-07 update
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [ ] Internal · engineering — docs/: add `API_BASE_URL` constant location to
      developer tooling notes if one is created in this ticket
