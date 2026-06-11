# P29-07 — API Documentation Page

## Purpose

Publish a public `/developers` page documenting the Kontax REST API v1: available endpoints, authentication method, field reference, rate limits, and code examples. Good API documentation is a product — it determines whether developers actually adopt the API or give up after 10 minutes.

## Background

The REST API (P29-06) is useless without documentation. The `/developers` page is a public, statically rendered Next.js page — no login required. It serves both existing users (who want to build on their data) and potential users (who evaluate Kontax's integration capabilities before signing up).

## Scope

**In scope:**
- `/developers` public page
- Sections: Introduction, Authentication, Endpoints reference, Field reference, Rate limits, Code examples (JavaScript, Python, cURL)
- Inline `<code>` blocks with syntax highlighting (using `@shikijs/rehype` or equivalent)
- `<meta name="robots" content="index, follow">` — this page should be indexed
- Link from the `/settings/developer` panel header: "Read the API docs →"

**Out of scope:**
- Interactive API playground (deferred — a future Swagger/Redoc integration)
- OpenAPI spec generation (deferred)
- Versioning docs for v2+ endpoints

---

## Design / Implementation Spec

### Route and structure

`src/app/(public)/developers/page.tsx` — server component, fully static.

```typescript
export const metadata = {
  title: "Kontax API — Developer Documentation",
  description: "Build with Kontax. Use the REST API to read and write your contacts programmatically.",
};
```

### Page layout

Single-column content page, max-width 780px, centred. Same nav bar and footer as the landing page. A sticky table of contents on the right side (on desktop) linking to each section anchor.

```
┌──────────────────────────────────────────────────────────────────────┐
│  NAV                                                                 │
├────────────────────────────┬─────────────────────────────────────────┤
│  SIDEBAR (TOC)             │  CONTENT                                │
│  Introduction              │                                         │
│  Authentication            │  Kontax API v1                          │
│  Endpoints                 │  ─────────────────────────────────────── │
│    GET /contacts           │  Use the Kontax API to access and       │
│    POST /contacts          │  modify your contacts programmatically. │
│    GET /contacts/:id       │  ...                                    │
│    PUT /contacts/:id       │                                         │
│    DELETE /contacts/:id    │  Authentication                         │
│  Field Reference           │  ...                                    │
│  Rate Limits               │                                         │
│  Code Examples             │  Endpoints                              │
│                            │  ...                                    │
└────────────────────────────┴─────────────────────────────────────────┘
```

On mobile: TOC collapses to a "Jump to section" dropdown at the top of the content.

### Content sections

**Introduction:**
```
# Kontax API v1

The Kontax API allows you to read and write your contacts programmatically.
All requests require a valid API token created in your account settings.

Base URL: https://kontax.app/api/v1
```

**Authentication:**
```
# Authentication

Pass your API token as a Bearer token in the Authorization header:

Authorization: Bearer ktx_live_your-token-here

Tokens are available in Settings → Developer. Read-only tokens cannot
create, update, or delete contacts.
```

**Endpoint documentation** (one section per endpoint):

Each endpoint section includes:
- HTTP method + path (in a code block with syntax highlighting)
- Description
- Request parameters / body (table)
- Example request (cURL)
- Example response (JSON)
- Error codes

Example for `GET /contacts`:
````
## GET /api/v1/contacts

List your contacts. Returns up to 100 contacts per page.

### Query parameters

| Parameter | Type   | Default | Description                        |
|-----------|--------|---------|------------------------------------|
| `q`       | string | —       | Search by name, company, or email  |
| `limit`   | integer| 50      | Results per page (max 100)         |
| `cursor`  | string | —       | Pagination cursor from previous response |
| `bookId`  | string | —       | Filter to a specific address book  |

### Example request

```bash
curl -H "Authorization: Bearer ktx_live_..." \
  "https://kontax.app/api/v1/contacts?q=acme&limit=10"
```

### Example response

```json
{
  "contacts": [
    {
      "id": "clx...",
      "firstName": "Jane",
      "lastName": "Smith",
      "fullName": "Jane Smith",
      "company": "Acme Corp",
      "emails": [{ "value": "jane@acme.com", "label": "Work" }],
      "phones": [{ "value": "+1 415 555 0100", "label": "Mobile" }],
      "createdAt": "2026-06-01T09:00:00Z",
      "updatedAt": "2026-06-10T14:32:00Z",
      "source": "API"
    }
  ],
  "pagination": { "cursor": "clx...", "hasMore": true }
}
```
````

**Field reference:** a table of all supported contact fields with their types, constraints, and which endpoints accept them.

**Rate limits:**

```
# Rate Limits

| Token scope  | Requests per hour |
|--------------|-------------------|
| Read-only    | 1,000             |
| Read-write   | 200               |

Rate limit status is included in every response:

X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 2026-06-11T15:00:00Z

When the limit is exceeded, the API returns 429 Too Many Requests.
```

**Code examples:** JavaScript (using `fetch`), Python (using `requests`), and cURL. Each example is a complete working snippet for the most common use case (list contacts, create a contact).

### Syntax highlighting

```bash
npm install @shikijs/rehype
```

Or use `react-syntax-highlighter` for inline code blocks. Apply the `github-light` theme to match the light design system.

---

## Acceptance Criteria

- `/developers` renders as a public, server-rendered static page.
- All 5 endpoints (`GET` list, `POST` create, `GET` one, `PUT` update, `DELETE`) are documented with parameters, example requests, and example responses.
- Authentication section explains Bearer tokens and scopes clearly.
- Rate limit table shows both scope types and their limits.
- Code examples for cURL, JavaScript (fetch), and Python are present and syntactically correct.
- The page is indexed by search engines (`<meta name="robots" content="index, follow">`).
- The page is linked from `/settings/developer` as "Read the API docs →".
- Syntax-highlighted code blocks render without horizontal overflow.

---

## Risks and Open Questions

- **Keeping docs in sync with the API:** as the API evolves, the documentation page must be updated manually. Consider a `/* API_VERSION: 1 */` comment at the top of the docs page as a reminder of the current version. A future improvement is auto-generating docs from the Zod schemas (P29-06).
