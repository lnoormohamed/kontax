# P34E-09 — OpenAPI servers array

## Purpose

Update the `servers` array in the OpenAPI specification (if one exists) to
point to `https://api.getkontax.com/v1` as the production server URL, so that
any tooling consuming the spec (Swagger UI, Redoc, code generators, Postman
imports) uses the correct base URL.

## Background

OpenAPI specifications include a `servers` array that defines the base URL(s)
for the API. If Kontax has an OpenAPI spec (generated or hand-authored), it
currently points to `getkontax.com/api/v1` or is missing a `servers` entry
altogether. Updating it ensures that any developer who imports the spec into
Postman, generates a client SDK, or uses the in-app API explorer gets the
correct subdomain URL automatically.

## Scope

**In scope**
- Locate any OpenAPI spec file. Common locations to check:
  - `public/openapi.json` or `public/openapi.yaml`
  - `src/app/api/openapi/route.ts` (dynamically generated)
  - `src/openapi.ts` or `src/lib/openapi.ts`
  - Any reference to `swagger`, `redoc`, or `openapi` in `src/`
- If a spec file exists, update (or add) the `servers` array:
  ```json
  "servers": [
    {
      "url": "https://api.getkontax.com/v1",
      "description": "Production"
    }
  ]
  ```
- If a Swagger UI or Redoc viewer is mounted (e.g. at `/developers/api` or
  `/api-docs`), verify it reflects the updated server URL.
- If no spec file exists, record this as a "future enhancement" note in a code
  comment or in this ticket's resolution, and close the ticket as N/A.

**Out of scope**
- Creating an OpenAPI spec from scratch if none exists.
- Updating individual endpoint schemas or response shapes.
- Adding a `staging` or `sandbox` server entry — production only for now.

## Design / Implementation Spec

### Locating the spec

```bash
find src public -name "openapi*" -o -name "swagger*" 2>/dev/null
grep -rn "openapi\|swagger\|redoc\|servers.*url" src/ --include="*.ts" --include="*.tsx" --include="*.json" -l
```

### If the spec is static JSON/YAML

Edit the file directly:

```json
{
  "openapi": "3.1.0",
  "info": { ... },
  "servers": [
    {
      "url": "https://api.getkontax.com/v1",
      "description": "Production"
    }
  ],
  "paths": { ... }
}
```

### If the spec is generated dynamically (route handler)

Update the `servers` value in the generator function:

```typescript
const spec = {
  openapi: "3.1.0",
  info: { ... },
  servers: [{ url: "https://api.getkontax.com/v1", description: "Production" }],
  // ...
};
```

### If a Swagger UI is mounted

Check whether the Swagger UI receives a `url` or `spec` prop. If `url`, it
fetches the spec dynamically and will pick up the change automatically after
the spec file is updated. If `spec`, update the inline spec object.

### If no spec exists

Add a comment in `src/app/api/v1/` (e.g. in a `README.md` or a code comment
at the top of the first route handler):

```
// Future enhancement: generate an OpenAPI spec for this API.
// Base URL when created: https://api.getkontax.com/v1
```

Close the ticket noting this as a future enhancement.

## Acceptance Criteria
- If a spec exists: the `servers[0].url` value in the OpenAPI spec is
  `https://api.getkontax.com/v1`.
- If Swagger UI / Redoc is present: the "Base URL" shown in the UI matches the
  updated servers entry.
- If no spec exists: ticket closed as N/A with a note recording the expected
  base URL for when a spec is created.
- No regression to any existing API explorer functionality.

## Risks / Open Questions
- If the spec was previously served at `getkontax.com/api/openapi.json`, any
  external tool that fetches it by URL will pick up the change automatically
  on next fetch. No notification to developers is required.
- OpenAPI 3.1 vs 3.0: the `servers` array is supported in both; syntax is
  identical. Verify the spec's `openapi` version before editing.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · developers — /developers (P29-07): if the spec is linked from
      the developers page, verify the link still resolves after any path change
- [ ] External · users — in-app Help (P26-12): none required
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [ ] Internal · engineering — docs/: note spec location in API architecture doc
