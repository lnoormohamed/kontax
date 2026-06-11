# P29-06 — REST API v1

## Purpose

Expose the Kontax contact data model through a versioned, authenticated REST API at `/api/v1/contacts`, so users can programmatically read and write their contacts from external tools, scripts, and integrations. Every contact created or modified via the API is attributed to `SourceType.API`.

## Background

The roadmap scopes v1 to contacts CRUD only — activity log, sync accounts, and group management are v2+ scope. The API uses Bearer token authentication (P29-05) with read-only or read-write scope enforcement. Rate limits are enforced per token (P29-08). The canonical contact schema is already well-defined; the API exposes a JSON representation of it.

## Scope

**In scope:**
- `GET /api/v1/contacts` — list contacts (paginated with cursor, filterable by `q`, `bookId`)
- `POST /api/v1/contacts` — create a contact
- `GET /api/v1/contacts/:id` — get a single contact
- `PUT /api/v1/contacts/:id` — replace/update a contact
- `DELETE /api/v1/contacts/:id` — archive a contact (soft delete; use `?permanent=true` to hard-delete)
- Bearer token auth middleware that calls `validateApiToken` (P29-05)
- Read-write scope enforcement: `POST`/`PUT`/`DELETE` return 403 for read-only tokens
- `SourceType.API` attribution on all mutations
- Rate limiting middleware (P29-08 implements the counting; this ticket wires the check)
- Standard error responses: 400 (validation), 401 (no token), 403 (forbidden), 404 (not found), 429 (rate limited), 500 (server error)

**Out of scope:**
- Activity log API (`/api/v1/activity`)
- Sync account API
- Group/shared book API
- Webhook delivery (v2+)

---

## Design / Implementation Spec

### Route structure

All routes live under `src/app/api/v1/`:

```
src/app/api/v1/
  contacts/
    route.ts           GET list, POST create
    [id]/
      route.ts         GET one, PUT update, DELETE archive/delete
  _middleware/
    auth.ts            Bearer token validation + rate limit check
    validate.ts        Zod request body validation
```

### Auth middleware

`src/app/api/v1/_middleware/auth.ts`:

```typescript
export async function withApiAuth(
  req: NextRequest,
  handler: (userId: string, scope: ApiTokenScope) => Promise<NextResponse>,
): Promise<NextResponse> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Missing or invalid Authorization header." },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const identity = await validateApiToken(token);

  if (!identity) {
    return NextResponse.json(
      { error: "INVALID_TOKEN", message: "The provided API token is invalid or revoked." },
      { status: 401 }
    );
  }

  // Rate limit check (P29-08)
  const limited = await checkApiRateLimit(identity.userId, token);
  if (limited) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many requests. See X-RateLimit-* headers." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limited.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": limited.resetAt.toISOString(),
          "Retry-After": Math.ceil((limited.resetAt.getTime() - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return handler(identity.userId, identity.scope);
}
```

### `GET /api/v1/contacts`

```typescript
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (userId) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? undefined;
    const bookId = searchParams.get("bookId") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
    const cursor = searchParams.get("cursor") ?? undefined;

    const contacts = await db.contact.findMany({
      where: {
        userId,
        archivedAt: null,
        ...(bookId && { bookId }),
        ...(q && {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { fullName: "asc" },
      take: limit + 1, // fetch one extra to determine if there's a next page
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: API_CONTACT_SELECT,
    });

    const hasMore = contacts.length > limit;
    const items = hasMore ? contacts.slice(0, limit) : contacts;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return NextResponse.json({
      contacts: items.map(formatContactForApi),
      pagination: { cursor: nextCursor, hasMore },
    });
  });
}
```

### `POST /api/v1/contacts`

```typescript
export async function POST(req: NextRequest) {
  return withApiAuth(req, async (userId, scope) => {
    if (scope === "READ_ONLY") {
      return NextResponse.json({ error: "FORBIDDEN", message: "Token is read-only." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = ContactCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
    }

    const contact = await createContact({
      ...parsed.data,
      userId,
      source: "API",
    });

    return NextResponse.json(formatContactForApi(contact), { status: 201 });
  });
}
```

### Zod schemas

```typescript
// src/app/api/v1/_schemas.ts

export const ContactCreateSchema = z.object({
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  fullName: z.string().max(200).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  jobTitle: z.string().max(200).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
  emails: z.array(z.object({
    value: z.string().email().max(254),
    label: z.string().max(50).optional(),
  })).max(10).optional(),
  phones: z.array(z.object({
    value: z.string().max(50),
    label: z.string().max(50).optional(),
  })).max(10).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^--\d{2}-\d{2}$/).nullable().optional(),
  bookId: z.string().cuid().optional(),
});

export const ContactUpdateSchema = ContactCreateSchema.partial();
```

### API response shape

```typescript
function formatContactForApi(contact: ApiContact): object {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: contact.fullName,
    company: contact.company,
    jobTitle: contact.jobTitle,
    notes: contact.notes,
    emails: contact.emails,
    phones: contact.phones,
    birthday: contact.birthday,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
    source: contact.source,
  };
}
```

### `SourceType.API` attribution

The `createContact` and `updateContact` server actions already accept a `source` parameter. Pass `source: "API"` from all API route handlers:

```typescript
await createContact({ ...data, userId, source: "API", sourceAccountId: null });
```

This ensures the activity log shows "Via API" as the source badge on contacts created through the API.

### Error response format

All errors use a consistent JSON shape:
```json
{ "error": "ERROR_CODE", "message": "Human-readable description." }
```

Validation errors include a `details` field:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Request body is invalid.",
  "details": { "fieldErrors": { "emails": ["Invalid email address"] } }
}
```

---

## Acceptance Criteria

- `GET /api/v1/contacts` returns paginated contact list for the token owner.
- `POST /api/v1/contacts` creates a contact attributed to `SourceType.API`.
- `GET /api/v1/contacts/:id` returns a single contact or 404.
- `PUT /api/v1/contacts/:id` updates a contact; returns the updated contact.
- `DELETE /api/v1/contacts/:id` archives the contact (soft delete); `?permanent=true` hard-deletes.
- All write endpoints return 403 for read-only tokens.
- All endpoints return 401 for missing or invalid tokens.
- All endpoints return 429 (with `X-RateLimit-*` headers) when rate limited.
- Request body validation returns 400 with field-level error details.
- Contacts are correctly owned-by-user — a token cannot access another user's contacts.

---

## Risks and Open Questions

- **`PUT` vs `PATCH` semantics:** using `PUT` for updates means unspecified fields are cleared. Using `PATCH` means only specified fields are updated. The API uses `PATCH` semantics (partial update) even though the route is named `PUT` — document this explicitly in P29-07. A future v2 can add a true `PATCH` route.
- **Multi-value fields (emails, phones):** the PUT endpoint replaces the entire `emails` or `phones` array. Callers must send the complete current array plus any new entries — they cannot add a single phone without sending all existing phones. This is a known limitation of REST array fields; document it clearly.
