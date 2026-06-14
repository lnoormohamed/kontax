# Runbook: Import / export jobs

**Subsystem:** CSV/vCard import pipeline, data export background jobs, blob storage  
**Audience:** Engineers investigating stuck imports/exports or user-reported data issues

---

## Overview

**Import** is a synchronous, user-driven flow: parse → classify columns → preview → commit. It runs in the request lifecycle and does not use background jobs. Large imports (thousands of contacts) may be slow but complete in a single request.

**Export** has two paths:
- **Small address books**: ZIP generated synchronously, returned as a download.
- **Large address books**: A background job writes the ZIP to blob storage and emails the user a time-limited download link (48-hour expiry). The job is enqueued via `POST /api/cron/data-export` and the link is served from MinIO.

---

## Import pipeline

### Phases

1. **Parse** — detect delimiter, encoding, header row.
2. **Column classification** — auto-detect Google/Apple/Outlook export layout; fall back to manual mapping.
3. **Preview** — show first 10 rows, highlight duplicate candidates.
4. **Dedup check** — flag contacts matching existing entries by name, email, or phone.
5. **Commit** — write contacts to the DB in a transaction; create an `ActivityEvent` per contact.

### Failure modes

| Symptom | Likely cause | Recovery |
|---------|-------------|---------|
| "Failed to parse file" | Non-UTF-8 encoding, malformed CSV/vCard | Ask user to re-export as UTF-8; try opening in a text editor to confirm encoding |
| Import completes but contacts are wrong | Column mapping was off | User can re-import with manual mapping; duplicates created can be merged via the Duplicates tab |
| Import hangs / request times out | Very large file (10k+ rows) | Split the file into smaller chunks; or run the import from a stable network connection |
| Duplicate contacts after import | Dedup check missed a match | Direct user to Duplicates tab; the engine matches on name + email + phone but not all combinations |

---

## Data export pipeline

### Small export (synchronous)

`generateDataExport` in `src/server/data-export/generate-export.ts` runs inline:
1. Queries all contacts, activity events, subscription, and user profile.
2. Serialises to vCard (using the same serialiser as the CardDAV server), CSV, billing summary text, and account JSON.
3. Streams all into a ZIP archive via `archiver`.
4. Returns the `Buffer` to the response handler.

### Large export (background job)

When the address book is large, the export is enqueued:
1. `POST /api/cron/data-export` (requires `x-cron-secret`) triggers the job.
2. The ZIP is generated and written to MinIO under a unique key.
3. An email is sent with a pre-signed download URL (48-hour expiry).
4. The `DataExport` row in the DB tracks `status`, `blobKey`, and `expiresAt`.

### Export link expiry

`POST /api/cron/expire-exports` runs nightly. It finds `DataExport` rows with `expiresAt <= now` and deletes the blob from MinIO and marks the row as `EXPIRED`.

---

## Failure modes & recovery

### Export email not received

1. Check SES is configured (see [ses-setup.md](ses-setup.md)).
2. Check the `DataExport` row: is `status = 'READY'`? Is `blobKey` set?
3. If the job ran but email failed: regenerate the pre-signed URL from MinIO and send manually.
4. If the job didn't run: check cron logs and `CRON_SECRET`.

### Export link expired before download

The user needs to request a new export from Settings → Account → Your data → Request export. There is no admin shortcut to extend an expired link — a new ZIP must be generated.

### Stuck import (user can't get past preview)

This is a UI state issue, not a job. Reload the Import page and start fresh. Data is never written until the user explicitly confirms at the commit step.

### Large vCard import (.vcf with thousands of entries)

vCard parsing is synchronous and memory-intensive for very large files. If the user reports a browser tab crash:
1. Split the .vcf file into smaller files (any text editor — vCards are newline-separated `BEGIN:VCARD ... END:VCARD` blocks).
2. Import each part separately.

---

## MinIO / blob storage

All uploaded files (avatars, export ZIPs) live in MinIO bucket `kontax-uploads` (configurable via `MINIO_BUCKET`).

**If MinIO is unreachable:**
- Avatar upload fails gracefully (user sees an error, existing avatar is unchanged).
- Export jobs fail silently — the email is not sent. Check MinIO health and retry the export cron.

**Blob key format for exports:** `exports/{userId}/{exportId}.zip`

---

## References

- Export generator: `src/server/data-export/generate-export.ts`
- Contact portability (vCard/CSV): `src/server/contact-portability.ts`
- Export cron: `src/app/api/cron/data-export/route.ts`
- Expiry cron: `src/app/api/cron/expire-exports/route.ts`
- GDPR erasure context: [gdpr-erasure.md](gdpr-erasure.md)
