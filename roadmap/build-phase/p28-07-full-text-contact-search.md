# P28-07 — Full-Text Contact Search

## Purpose

Extend the contact search from basic `ILIKE` name/email matching to a PostgreSQL full-text index (`tsvector`) that searches across notes, custom fields, addresses, job title, company, and all structured multi-value fields — with relevance-ranked results. This is a P0 because the current search gap is the most common reason power users keep a spreadsheet alongside Kontax.

## Background

The current search (`?q=...`) uses `WHERE firstName ILIKE '%query%' OR email ILIKE '%query%'`. This misses notes, addresses, job titles, and any custom field data. A user who types "Acme Corp" should find all contacts at Acme Corp. A user who types "San Francisco" should find contacts with a San Francisco address. Postgres full-text search via `tsvector`/`tsquery` provides this with minimal infrastructure overhead.

## Scope

**In scope:**
- `searchVector tsvector` generated column on `Contact` — populated from all searchable fields via a Postgres `GENERATED ALWAYS AS` expression
- `GIN` index on `searchVector`
- Updated `/api/contacts` search path: use `to_tsquery` when `q` is non-empty; fall back to `ILIKE` for empty query
- Relevance ranking: `ts_rank(searchVector, query)` ordering for non-trivial queries
- Include in search: `fullName`, `firstName`, `lastName`, `company`, `jobTitle`, `notes`, all email values, all phone values, all address fields (via JSON extraction), custom field values
- Highlight: return a `snippet` field with the matching text for display in the search result row (optional P2 enhancement)

**Out of scope:**
- Phonetic search (Soundex / pg_trgm — deferred)
- Cross-account or admin search
- Real-time search as-you-type streaming (the existing debounced fetch is sufficient)

---

## Design / Implementation Spec

### `searchVector` generated column

In a new Prisma migration, add the column via raw SQL (Prisma does not yet support `GENERATED` columns directly):

```sql
-- migration file: add-contact-search-vector.sql

ALTER TABLE "Contact" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("fullName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("firstName", '') || ' ' || coalesce("lastName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("company", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("jobTitle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("notes", '')), 'C') ||
    setweight(to_tsvector('english', coalesce("department", '')), 'C')
  ) STORED;

CREATE INDEX "Contact_searchVector_idx" ON "Contact" USING GIN ("searchVector");
```

For JSON array fields (emails, phones, addresses), the generated column cannot directly index them. Use a trigger or a separate indexed approach:

```sql
-- Trigger to update a TEXT column with extracted JSON values:
CREATE OR REPLACE FUNCTION extract_contact_text_fields(contact "Contact")
RETURNS tsvector AS $$
  SELECT
    setweight(to_tsvector('english', coalesce(contact."fullName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(contact."company", '')), 'B') ||
    setweight(to_tsvector('english',
      coalesce(
        array_to_string(
          ARRAY(SELECT el->>'value' FROM jsonb_array_elements(contact."emails") el),
          ' '
        ), ''
      )
    ), 'B') ||
    setweight(to_tsvector('english',
      coalesce(
        (contact."addresses"::jsonb #>> '{0,city}') || ' ' ||
        (contact."addresses"::jsonb #>> '{0,state}') || ' ' ||
        (contact."addresses"::jsonb #>> '{0,country}'),
        ''
      )
    ), 'C') ||
    setweight(to_tsvector('english', coalesce(contact."notes", '')), 'C');
$$ LANGUAGE sql IMMUTABLE;
```

Use a Prisma `rawQuery` migration to apply the trigger approach. Alternatively, update the `searchVector` from the application layer (in the `createContact` / `updateContact` server actions) using a raw `UPDATE` after every contact mutation.

**V1 approach:** update `searchVector` from the application layer — simpler to implement, no trigger complexity:

```typescript
// In createContact and updateContact, after the main DB write:
await db.$executeRaw`
  UPDATE "Contact"
  SET "searchVector" = (
    setweight(to_tsvector('english', coalesce(${fullName}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${company}, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(${notes}, '')), 'C') ||
    setweight(to_tsvector('english', ${emailsText}), 'B') ||
    setweight(to_tsvector('english', ${addressText}), 'C')
  )
  WHERE id = ${contactId}
`;
```

### Updated search query

In `/api/contacts`, replace the existing `ILIKE` search:

```typescript
export async function searchContacts(params: {
  userId: string;
  q: string;
  limit: number;
  cursor?: string;
}): Promise<ContactSearchResult[]> {
  const { userId, q, limit, cursor } = params;

  if (!q) {
    // No search — return all contacts in default sort order
    return db.contact.findMany({ where: { userId, archivedAt: null }, /* ... */ });
  }

  // Full-text search with relevance ranking
  const tsQuery = q.trim().split(/\s+/).join(" & ") + ":*"; // prefix match on last token

  return db.$queryRaw<ContactSearchResult[]>`
    SELECT id, "fullName", company, emails, phones, "archivedAt",
           ts_rank("searchVector", to_tsquery('english', ${tsQuery})) AS rank
    FROM "Contact"
    WHERE
      "userId" = ${userId}
      AND "archivedAt" IS NULL
      AND "searchVector" @@ to_tsquery('english', ${tsQuery})
    ORDER BY rank DESC, "fullName" ASC
    LIMIT ${limit}
    ${cursor ? Prisma.sql`OFFSET ${cursor}` : Prisma.empty}
  `;
}
```

The `:*` suffix enables prefix matching (e.g., "joh" matches "John"). `&` joins multiple words with AND semantics.

### Fallback for short/special queries

For single characters or queries that fail `to_tsquery` parsing (e.g., special characters), fall back to `ILIKE`:

```typescript
function isTsqueryCompatible(q: string): boolean {
  return q.trim().length >= 2 && !/[!@#$%^&*()\[\]{}<>?]/.test(q);
}

const results = isTsqueryCompatible(q)
  ? await fullTextSearch(userId, q, limit)
  : await ilikeSearch(userId, q, limit);
```

### Backfill existing contacts

After the migration, run a one-time backfill to populate `searchVector` for all existing contacts:

```sql
UPDATE "Contact" SET "searchVector" = (
  setweight(to_tsvector('english', coalesce("fullName", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("company", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("notes", '')), 'C')
);
```

The JSON field extraction backfill runs as a separate script.

---

## Acceptance Criteria

- `searchVector` column exists on `Contact` with a `GIN` index.
- Searching "Acme Corp" returns all contacts with `company = "Acme Corp"`.
- Searching "San Francisco" returns contacts with a San Francisco address.
- Searching an email address fragment ("@acme.com") returns matching contacts.
- Searching notes content returns contacts whose notes contain the search term.
- Results are ordered by relevance rank (name matches rank higher than notes matches).
- Prefix matching works: "joh" returns "John Smith".
- Queries that fail `to_tsquery` validation fall back to `ILIKE` gracefully.
- All existing contacts have their `searchVector` populated after the backfill migration.
- Every contact create/update operation updates the `searchVector` column.

---

## Risks and Open Questions

- **`to_tsquery` with user input:** user queries may contain characters that are invalid in `to_tsquery` (parentheses, operators). Sanitise the query before passing to `to_tsquery`: strip non-alphanumeric characters except spaces and hyphens. Never pass raw user input directly to `$executeRaw` without parameterisation.
- **Multi-language contact names:** `to_tsvector('english', ...)` uses the English stemmer, which does not stem Chinese, Japanese, or Arabic names correctly. For non-Latin script contact names, the vector will store the raw tokens without stemming — search still works (exact match), but stemming (e.g., "running" matches "run") won't. This is acceptable for v1. Add a `'simple'` configuration as a fallback for non-Latin content.
- **JSON field extraction performance:** extracting email values from the JSON `emails` column on every update via `$executeRaw` is correct but fragile. The long-term fix is a Postgres trigger (no application-layer dependency). Schedule this as a follow-up when contact mutation volume becomes a concern.
