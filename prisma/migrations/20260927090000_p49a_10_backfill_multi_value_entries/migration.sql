-- P49A-10 (A-14) — typed *Entries are the single source of truth for a
-- contact's emails, phones, postal addresses and websites.
--
-- DATA-ONLY: no table, column, index, constraint or function is created,
-- altered or dropped, so `prisma migrate diff` / KONTAX_SCHEMA_MODE=validate
-- see no schema change. Safe to re-run: every statement only touches rows
-- that still differ, and a second run changes nothing.
--
-- 1. Backfill: every legacy value missing from the typed entries is appended
--    as an entry labelled "other" (a postal address keeps its own label).
--    Sources: email + emailAddresses, phone + phoneNumbers, address +
--    postalAddresses, website. Matching is case-insensitive; phones also match
--    an entry's "e164" and ignore formatting (digits and "+" only). An
--    appended entry is primary only when the family had no entries. Rows that
--    gain an entry get syncVersion + 1 (DAV ETag) and updatedAt = now (DAV
--    CTag), so synced devices re-download the recovered values.
--    JS twin: reconcileLegacyIntoEntries in
--    src/server/dav/contact-multi-values.mjs.
-- 2. Re-derive the legacy columns from the entries, exactly as every writer
--    now does (deriveMultiValueFields in the same module): entries deduped on
--    label + value; the scalar is the primary entry (first isPrimary: true — a
--    missing flag counts as false — else the first entry); the flat arrays
--    hold each distinct value in entry order (phones: e164 when present);
--    postalAddresses is [{label, formatted}] per entry; empty → NULL.
--    Every step is set-based (joins / GROUP BY aggregates, no correlated
--    subqueries), so it is linear in contacts + entries.
--
-- Verification (must return 0 after this migration; see
-- roadmap/build-phase/p49a-10-multi-value-field-model.md):
--   SELECT count(*) FROM "Contact"
--    WHERE jsonb_array_length(CASE WHEN jsonb_typeof("emailAddresses") = 'array' THEN "emailAddresses" ELSE '[]' END)
--        > jsonb_array_length(CASE WHEN jsonb_typeof("emailEntries") = 'array' THEN "emailEntries" ELSE '[]' END)
--       OR jsonb_array_length(CASE WHEN jsonb_typeof("phoneNumbers") = 'array' THEN "phoneNumbers" ELSE '[]' END)
--        > jsonb_array_length(CASE WHEN jsonb_typeof("phoneEntries") = 'array' THEN "phoneEntries" ELSE '[]' END)
--       OR jsonb_array_length(CASE WHEN jsonb_typeof("postalAddresses") = 'array' THEN "postalAddresses" ELSE '[]' END)
--        > jsonb_array_length(CASE WHEN jsonb_typeof("addressEntries") = 'array' THEN "addressEntries" ELSE '[]' END);
--
-- Production runs KONTAX_SCHEMA_MODE=validate and is migrated out of band
-- (roadmap/runbooks/deploy.md). Apply this BEFORE (or together with) the
-- P49A-10 deploy; the app also reads legacy values for a row whose entries are
-- still empty, so a short gap is safe, but only the backfill recovers values
-- that sit in the legacy arrays next to non-empty entries.

-- ── 1a. emails ────────────────────────────────────────────────────────────────
WITH legacy AS (
  SELECT c."id", btrim(c."email") AS value, 0::bigint AS ord
    FROM "Contact" c
   WHERE btrim(coalesce(c."email", '')) <> ''
  UNION ALL
  SELECT c."id", btrim(e.item #>> '{}'), e.ord
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."emailAddresses") = 'array' THEN c."emailAddresses" ELSE '[]'::jsonb END
         ) WITH ORDINALITY AS e(item, ord)
   WHERE jsonb_typeof(e.item) = 'string' AND btrim(e.item #>> '{}') <> ''
),
known AS (
  SELECT c."id", lower(btrim(x.item ->> 'value')) AS key
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."emailEntries") = 'array' THEN c."emailEntries" ELSE '[]'::jsonb END
         ) AS x(item)
   WHERE jsonb_typeof(x.item) = 'object' AND jsonb_typeof(x.item -> 'value') = 'string'
     AND btrim(x.item ->> 'value') <> ''
),
missing AS (
  SELECT DISTINCT ON (l."id", lower(l.value)) l."id", l.value, l.ord
    FROM legacy l
   WHERE NOT EXISTS (SELECT 1 FROM known k WHERE k."id" = l."id" AND k.key = lower(l.value))
   ORDER BY l."id", lower(l.value), l.ord
),
known_ids AS (
  SELECT DISTINCT "id" FROM known
),
ranked AS (
  SELECT m.*,
         row_number() OVER (PARTITION BY m."id" ORDER BY m.ord) AS rn,
         (h."id" IS NOT NULL) AS has_entries
    FROM missing m
    LEFT JOIN known_ids h ON h."id" = m."id"
),
appended AS (
  SELECT r."id",
         jsonb_agg(
           jsonb_build_object('label', 'other', 'value', r.value, 'isPrimary', (r.rn = 1 AND NOT r.has_entries))
           ORDER BY r.rn
         ) AS items
    FROM ranked r
   GROUP BY r."id"
)
UPDATE "Contact" c
   SET "emailEntries" = (CASE WHEN jsonb_typeof(c."emailEntries") = 'array' THEN c."emailEntries" ELSE '[]'::jsonb END) || a.items,
       "syncVersion" = c."syncVersion" + 1,
       "updatedAt" = now()
  FROM appended a
 WHERE c."id" = a."id";

-- ── 1b. phones ────────────────────────────────────────────────────────────────
WITH legacy AS (
  SELECT c."id", btrim(c."phone") AS value, 0::bigint AS ord
    FROM "Contact" c
   WHERE btrim(coalesce(c."phone", '')) <> ''
  UNION ALL
  SELECT c."id", btrim(e.item #>> '{}'), e.ord
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."phoneNumbers") = 'array' THEN c."phoneNumbers" ELSE '[]'::jsonb END
         ) WITH ORDINALITY AS e(item, ord)
   WHERE jsonb_typeof(e.item) = 'string' AND btrim(e.item #>> '{}') <> ''
),
keyed AS (
  SELECT l.*, regexp_replace(l.value, '[^0-9+]', '', 'g') AS key
    FROM legacy l
),
known AS (
  SELECT c."id", regexp_replace(k.candidate, '[^0-9+]', '', 'g') AS key
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."phoneEntries") = 'array' THEN c."phoneEntries" ELSE '[]'::jsonb END
         ) AS x(item)
   CROSS JOIN LATERAL (
           VALUES (CASE WHEN jsonb_typeof(x.item -> 'value') = 'string' THEN x.item ->> 'value' END),
                  (CASE WHEN jsonb_typeof(x.item -> 'e164') = 'string' THEN x.item ->> 'e164' END)
         ) AS k(candidate)
   WHERE jsonb_typeof(x.item) = 'object' AND jsonb_typeof(x.item -> 'value') = 'string'
     AND btrim(x.item ->> 'value') <> ''
     AND k.candidate IS NOT NULL
),
missing AS (
  SELECT DISTINCT ON (l."id", l.key) l."id", l.value, l.ord
    FROM keyed l
   WHERE l.key <> ''
     AND NOT EXISTS (SELECT 1 FROM known k WHERE k."id" = l."id" AND k.key = l.key)
   ORDER BY l."id", l.key, l.ord
),
known_ids AS (
  SELECT DISTINCT "id" FROM known
),
ranked AS (
  SELECT m.*,
         row_number() OVER (PARTITION BY m."id" ORDER BY m.ord) AS rn,
         (h."id" IS NOT NULL) AS has_entries
    FROM missing m
    LEFT JOIN known_ids h ON h."id" = m."id"
),
appended AS (
  SELECT r."id",
         jsonb_agg(
           jsonb_build_object('label', 'other', 'value', r.value, 'isPrimary', (r.rn = 1 AND NOT r.has_entries))
           ORDER BY r.rn
         ) AS items
    FROM ranked r
   GROUP BY r."id"
)
UPDATE "Contact" c
   SET "phoneEntries" = (CASE WHEN jsonb_typeof(c."phoneEntries") = 'array' THEN c."phoneEntries" ELSE '[]'::jsonb END) || a.items,
       "syncVersion" = c."syncVersion" + 1,
       "updatedAt" = now()
  FROM appended a
 WHERE c."id" = a."id";

-- ── 1c. websites (scalar only; there is no legacy array) ───────────────────────
WITH known AS (
  SELECT c."id", lower(btrim(x.item ->> 'value')) AS key
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."websiteEntries") = 'array' THEN c."websiteEntries" ELSE '[]'::jsonb END
         ) AS x(item)
   WHERE jsonb_typeof(x.item) = 'object' AND jsonb_typeof(x.item -> 'value') = 'string'
     AND btrim(x.item ->> 'value') <> ''
),
known_ids AS (
  SELECT DISTINCT "id" FROM known
),
appended AS (
  SELECT c."id",
         jsonb_build_array(jsonb_build_object(
           'label', 'other',
           'value', btrim(c."website"),
           'isPrimary', h."id" IS NULL
         )) AS items
    FROM "Contact" c
    LEFT JOIN known_ids h ON h."id" = c."id"
   WHERE btrim(coalesce(c."website", '')) <> ''
     AND NOT EXISTS (SELECT 1 FROM known k WHERE k."id" = c."id" AND k.key = lower(btrim(c."website")))
)
UPDATE "Contact" c
   SET "websiteEntries" = (CASE WHEN jsonb_typeof(c."websiteEntries") = 'array' THEN c."websiteEntries" ELSE '[]'::jsonb END) || a.items,
       "syncVersion" = c."syncVersion" + 1,
       "updatedAt" = now()
  FROM appended a
 WHERE c."id" = a."id";

-- ── 1d. addresses ─────────────────────────────────────────────────────────────
WITH legacy AS (
  SELECT c."id", 'other'::text AS label, btrim(c."address") AS formatted, 0::bigint AS ord
    FROM "Contact" c
   WHERE btrim(coalesce(c."address", '')) <> ''
  UNION ALL
  SELECT c."id",
         coalesce(nullif(CASE WHEN jsonb_typeof(e.item -> 'label') = 'string' THEN btrim(e.item ->> 'label') END, ''), 'other'),
         CASE WHEN jsonb_typeof(e.item) = 'string' THEN btrim(e.item #>> '{}') ELSE btrim(e.item ->> 'formatted') END,
         e.ord
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."postalAddresses") = 'array' THEN c."postalAddresses" ELSE '[]'::jsonb END
         ) WITH ORDINALITY AS e(item, ord)
   WHERE (jsonb_typeof(e.item) = 'string' AND btrim(e.item #>> '{}') <> '')
      OR (jsonb_typeof(e.item) = 'object' AND jsonb_typeof(e.item -> 'formatted') = 'string'
          AND btrim(e.item ->> 'formatted') <> '')
),
known AS (
  SELECT c."id", lower(btrim(coalesce(
           nullif(btrim(x.item ->> 'formatted'), ''),
           nullif(concat_ws(', ',
             coalesce(nullif(btrim(x.item ->> 'streetLine1'), ''), nullif(btrim(x.item ->> 'street'), '')),
             nullif(btrim(x.item ->> 'streetLine2'), ''),
             coalesce(nullif(btrim(x.item ->> 'cityOrTown'), ''), nullif(btrim(x.item ->> 'city'), '')),
             coalesce(nullif(btrim(x.item ->> 'stateOrProvince'), ''), nullif(btrim(x.item ->> 'state'), ''), nullif(btrim(x.item ->> 'region'), '')),
             coalesce(nullif(btrim(x.item ->> 'postcode'), ''), nullif(btrim(x.item ->> 'postalCode'), '')),
             coalesce(nullif(btrim(x.item ->> 'countryOrRegion'), ''), nullif(btrim(x.item ->> 'country'), ''))
           ), ''),
           nullif(btrim(x.item ->> 'poBox'), '')
         ))) AS key
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."addressEntries") = 'array' THEN c."addressEntries" ELSE '[]'::jsonb END
         ) AS x(item)
   WHERE jsonb_typeof(x.item) = 'object'
),
missing AS (
  SELECT DISTINCT ON (l."id", lower(l.formatted)) l."id", l.label, l.formatted, l.ord
    FROM legacy l
   WHERE NOT EXISTS (SELECT 1 FROM known k WHERE k."id" = l."id" AND k.key = lower(l.formatted))
   ORDER BY l."id", lower(l.formatted), l.ord
),
known_ids AS (
  SELECT DISTINCT "id" FROM known WHERE key IS NOT NULL
),
ranked AS (
  SELECT m.*,
         row_number() OVER (PARTITION BY m."id" ORDER BY m.ord) AS rn,
         (h."id" IS NOT NULL) AS has_entries
    FROM missing m
    LEFT JOIN known_ids h ON h."id" = m."id"
),
appended AS (
  SELECT r."id",
         jsonb_agg(
           jsonb_build_object('label', r.label, 'formatted', r.formatted, 'isPrimary', (r.rn = 1 AND NOT r.has_entries))
           ORDER BY r.rn
         ) AS items
    FROM ranked r
   GROUP BY r."id"
)
UPDATE "Contact" c
   SET "addressEntries" = (CASE WHEN jsonb_typeof(c."addressEntries") = 'array' THEN c."addressEntries" ELSE '[]'::jsonb END) || a.items,
       "syncVersion" = c."syncVersion" + 1,
       "updatedAt" = now()
  FROM appended a
 WHERE c."id" = a."id";

-- ── 2. re-derive the legacy columns from the entries ───────────────────────────
-- Set-based (GROUP BY aggregates joined back to "Contact", no correlated
-- subqueries). Mirrors deriveMultiValueFields: entries are first deduped on
-- label + value (normalizeValueEntries), the scalar is the first entry flagged
-- isPrimary (a missing flag counts as false), else the first entry; the flat
-- arrays hold each distinct value (case-insensitive) in entry order.

WITH items AS (
  SELECT c."id",
         coalesce(CASE WHEN jsonb_typeof(x.item -> 'label') = 'string' THEN btrim(x.item ->> 'label') END, '') AS label,
         btrim(x.item ->> 'value') AS value,
         coalesce((x.item -> 'isPrimary') = 'true'::jsonb, false) AS is_primary,
         x.ord
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."emailEntries") = 'array' THEN c."emailEntries" ELSE '[]'::jsonb END
         ) WITH ORDINALITY AS x(item, ord)
   WHERE jsonb_typeof(x.item) = 'object' AND jsonb_typeof(x.item -> 'value') = 'string'
     AND btrim(x.item ->> 'value') <> ''
),
deduped AS (
  SELECT DISTINCT ON ("id", lower(label), lower(value)) *
    FROM items
   ORDER BY "id", lower(label), lower(value), ord
),
flat AS (
  SELECT DISTINCT ON ("id", lower(value)) "id", value, ord
    FROM deduped
   ORDER BY "id", lower(value), ord
),
primary_value AS (
  SELECT "id", (array_agg(value ORDER BY is_primary DESC, ord))[1] AS email
    FROM deduped
   GROUP BY "id"
),
flat_values AS (
  SELECT "id", jsonb_agg(to_jsonb(value) ORDER BY ord) AS addresses
    FROM flat
   GROUP BY "id"
),
derived AS (
  SELECT c."id", p.email, f.addresses
    FROM "Contact" c
    LEFT JOIN primary_value p ON p."id" = c."id"
    LEFT JOIN flat_values f ON f."id" = c."id"
)
UPDATE "Contact" c
   SET "email" = d.email,
       "emailAddresses" = d.addresses
  FROM derived d
 WHERE c."id" = d."id"
   AND (c."email" IS DISTINCT FROM d.email OR c."emailAddresses" IS DISTINCT FROM d.addresses);

WITH items AS (
  SELECT c."id",
         coalesce(CASE WHEN jsonb_typeof(x.item -> 'label') = 'string' THEN btrim(x.item ->> 'label') END, '') AS label,
         btrim(x.item ->> 'value') AS value,
         -- phoneNumbers holds the e164 form when the entry carries one
         coalesce(nullif(CASE WHEN jsonb_typeof(x.item -> 'e164') = 'string' THEN btrim(x.item ->> 'e164') END, ''),
                  btrim(x.item ->> 'value')) AS flat,
         coalesce((x.item -> 'isPrimary') = 'true'::jsonb, false) AS is_primary,
         x.ord
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."phoneEntries") = 'array' THEN c."phoneEntries" ELSE '[]'::jsonb END
         ) WITH ORDINALITY AS x(item, ord)
   WHERE jsonb_typeof(x.item) = 'object' AND jsonb_typeof(x.item -> 'value') = 'string'
     AND btrim(x.item ->> 'value') <> ''
),
deduped AS (
  SELECT DISTINCT ON ("id", lower(label), lower(value)) *
    FROM items
   ORDER BY "id", lower(label), lower(value), ord
),
flat AS (
  SELECT DISTINCT ON ("id", lower(flat)) "id", flat, ord
    FROM deduped
   ORDER BY "id", lower(flat), ord
),
primary_value AS (
  SELECT "id", (array_agg(value ORDER BY is_primary DESC, ord))[1] AS phone
    FROM deduped
   GROUP BY "id"
),
flat_values AS (
  SELECT "id", jsonb_agg(to_jsonb(flat) ORDER BY ord) AS numbers
    FROM flat
   GROUP BY "id"
),
derived AS (
  SELECT c."id", p.phone, f.numbers
    FROM "Contact" c
    LEFT JOIN primary_value p ON p."id" = c."id"
    LEFT JOIN flat_values f ON f."id" = c."id"
)
UPDATE "Contact" c
   SET "phone" = d.phone,
       "phoneNumbers" = d.numbers
  FROM derived d
 WHERE c."id" = d."id"
   AND (c."phone" IS DISTINCT FROM d.phone OR c."phoneNumbers" IS DISTINCT FROM d.numbers);

WITH items AS (
  SELECT c."id",
         coalesce(CASE WHEN jsonb_typeof(x.item -> 'label') = 'string' THEN btrim(x.item ->> 'label') END, '') AS label,
         btrim(x.item ->> 'value') AS value,
         coalesce((x.item -> 'isPrimary') = 'true'::jsonb, false) AS is_primary,
         x.ord
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."websiteEntries") = 'array' THEN c."websiteEntries" ELSE '[]'::jsonb END
         ) WITH ORDINALITY AS x(item, ord)
   WHERE jsonb_typeof(x.item) = 'object' AND jsonb_typeof(x.item -> 'value') = 'string'
     AND btrim(x.item ->> 'value') <> ''
),
deduped AS (
  SELECT DISTINCT ON ("id", lower(label), lower(value)) *
    FROM items
   ORDER BY "id", lower(label), lower(value), ord
),
primary_value AS (
  SELECT "id", (array_agg(value ORDER BY is_primary DESC, ord))[1] AS website
    FROM deduped
   GROUP BY "id"
),
derived AS (
  SELECT c."id", p.website
    FROM "Contact" c
    LEFT JOIN primary_value p ON p."id" = c."id"
)
UPDATE "Contact" c
   SET "website" = d.website
  FROM derived d
 WHERE c."id" = d."id"
   AND c."website" IS DISTINCT FROM d.website;

WITH items AS (
  SELECT c."id",
         coalesce(CASE WHEN jsonb_typeof(x.item -> 'label') = 'string' THEN btrim(x.item ->> 'label') END, '') AS label,
         coalesce(
           nullif(btrim(x.item ->> 'formatted'), ''),
           nullif(concat_ws(', ',
             coalesce(nullif(btrim(x.item ->> 'streetLine1'), ''), nullif(btrim(x.item ->> 'street'), '')),
             nullif(btrim(x.item ->> 'streetLine2'), ''),
             coalesce(nullif(btrim(x.item ->> 'cityOrTown'), ''), nullif(btrim(x.item ->> 'city'), '')),
             coalesce(nullif(btrim(x.item ->> 'stateOrProvince'), ''), nullif(btrim(x.item ->> 'state'), ''), nullif(btrim(x.item ->> 'region'), '')),
             coalesce(nullif(btrim(x.item ->> 'postcode'), ''), nullif(btrim(x.item ->> 'postalCode'), '')),
             coalesce(nullif(btrim(x.item ->> 'countryOrRegion'), ''), nullif(btrim(x.item ->> 'country'), ''))
           ), ''),
           nullif(btrim(x.item ->> 'poBox'), '')
         ) AS formatted,
         coalesce(btrim(x.item ->> 'poBox'), '') AS po_box,
         coalesce((x.item -> 'isPrimary') = 'true'::jsonb, false) AS is_primary,
         x.ord
    FROM "Contact" c
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(c."addressEntries") = 'array' THEN c."addressEntries" ELSE '[]'::jsonb END
         ) WITH ORDINALITY AS x(item, ord)
   WHERE jsonb_typeof(x.item) = 'object'
),
deduped AS (
  -- label + formatted + PO box repeats collapse, as in normalizeAddressEntries
  SELECT DISTINCT ON ("id", lower(label), lower(formatted), lower(po_box)) *
    FROM items
   WHERE formatted IS NOT NULL
   ORDER BY "id", lower(label), lower(formatted), lower(po_box), ord
),
aggregated AS (
  SELECT "id",
         (array_agg(formatted ORDER BY is_primary DESC, ord))[1] AS address,
         jsonb_agg(jsonb_build_object('label', label, 'formatted', formatted) ORDER BY ord) AS postal
    FROM deduped
   GROUP BY "id"
),
derived AS (
  SELECT c."id", a.address, a.postal
    FROM "Contact" c
    LEFT JOIN aggregated a ON a."id" = c."id"
)
UPDATE "Contact" c
   SET "address" = d.address,
       "postalAddresses" = d.postal
  FROM derived d
 WHERE c."id" = d."id"
   AND (c."address" IS DISTINCT FROM d.address OR c."postalAddresses" IS DISTINCT FROM d.postal);
