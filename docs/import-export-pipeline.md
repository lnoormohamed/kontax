# Import / export pipeline

**Cross-cutting subsystem.** How contacts get in and out of Kontax — CSV/vCard import, contact export, and the full account data export (GDPR ZIP).

---

## Import pipeline (CSV & vCard)

Import is a synchronous, multi-step user flow. No background jobs. Data is never written until the user confirms at the commit step.

### Phases

```
1. Upload     → file is parsed in memory (not stored)
2. Classify   → column layout detected or manually mapped
3. Dedup      → matches flagged against existing contacts
4. Preview    → user reviews field mapping + dedup results
5. Commit     → contacts written to DB in a transaction
```

### Phase 1: Parse

- **vCard**: parse `BEGIN:VCARD ... END:VCARD` blocks. Both vCard 2.1 and 3.0 are supported. Multi-contact `.vcf` files (concatenated blocks) are imported as a batch.
- **CSV**: detect delimiter (comma/tab/semicolon), detect encoding (UTF-8 assumed; BOM stripped), read header row.

### Phase 2: Column classification

For CSV, Kontax auto-detects the export layout:
- **Google Contacts**: recognises `Given Name`, `Family Name`, `E-mail 1 - Value`, `Phone 1 - Value`, etc.
- **Apple Contacts / macOS**: recognises `First Name`, `Last Name`, `E-mail`, `Phone`.
- **Outlook / Windows Contacts**: recognises `First Name`, `Last Name`, `E-mail Address`, `Business Phone`.

If the layout is not recognised, the user maps columns to Kontax fields manually in a drag-and-drop UI. A successfully mapped layout can be saved as a named preset for future imports.

### Phase 3: Dedup check

For each row, Kontax compares against existing contacts by:
1. Exact email match (case-insensitive).
2. Exact phone match (normalised E.164).
3. Name fuzzy-match (same first + last name, ≥80% similarity).

Matched rows are flagged in the preview as: **Skip** (don't import), **Merge** (merge fields into existing), or **Import anyway** (create a separate contact).

### Phase 4: Preview

Shows the first N rows with resolved field mapping and dedup flags. The user can adjust column mapping here. Import does not proceed until the user clicks Commit.

### Phase 5: Commit

Runs in a Prisma transaction:
- Creates `Contact` rows for each non-skipped row.
- For merge rows: updates the matched `Contact` (keeping existing fields if the import value is empty).
- Creates one `ActivityEvent` per contact with `eventType=CONTACT_CREATED` or `CONTACT_UPDATED` and `source=IMPORT`.
- Returns a summary: created / updated / skipped counts.

---

## Contact export

The basic export (CSV or vCard) is synchronous for all address book sizes:

```
GET /api/export?format=vcf|csv&bookId=...&labelId=...
```

The server streams the response directly — no background job, no blob storage. For large address books this may take a few seconds.

The exporter uses `src/server/contact-portability.ts`:
- **vCard**: vCard 3.0 format, one `BEGIN:VCARD ... END:VCARD` block per contact.
- **CSV**: UTF-8 with BOM for Excel compatibility. Headers match the Google Contacts export layout for maximum compatibility.

---

## Full account data export (GDPR ZIP)

The GDPR data export is triggered from Settings → Account → Your data → Request export. For accounts with many contacts it may run as a background job.

### ZIP contents

| File | Contents |
|------|---------|
| `contacts.vcf` | All contacts (including archived) in vCard 3.0 format |
| `contacts.csv` | Same contacts as a spreadsheet |
| `activity-log.csv` | All `ActivityEvent` rows for the user |
| `billing-summary.txt` | Plan, status, period end; note re Stripe portal for invoices |
| `account.json` | Profile (name, email, createdAt), settings, notification preferences |

The generator is `src/server/data-export/generate-export.ts`. It uses the `archiver` library to stream all files into a ZIP. For large accounts, the ZIP is written to MinIO blob storage (`exports/{userId}/{exportId}.zip`) and a time-limited download link is emailed (48-hour expiry).

### Expiry cron

`POST /api/cron/expire-exports` (nightly) deletes blobs and marks `DataExport` rows as `EXPIRED` after `expiresAt`.

---

## What is not exported

- Sync account credentials (never stored in plaintext; app passwords are one-way hashed).
- Other users' contacts that were shared to this user (those belong to the other user).
- Admin audit log entries (available to admins separately).

---

## References

- Import UI flow: `src/app/import/` (pages + server actions)
- Contact portability (vCard/CSV serialisation): `src/server/contact-portability.ts`
- Export generator: `src/server/data-export/generate-export.ts`
- Export cron: `src/app/api/cron/data-export/route.ts`
- Expiry cron: `src/app/api/cron/expire-exports/route.ts`
- GDPR context: [gdpr-erasure.md](../roadmap/runbooks/gdpr-erasure.md)
