# P27-08 — Deduplication on OAuth Import

## Purpose

Before committing imported contacts from Google or Outlook, run the duplicate detection engine (Phase 4/10) against existing Kontax contacts and surface merge suggestions rather than silently creating duplicates. A user who imports 800 Google contacts on top of 800 existing contacts without deduplication ends up with a useless, doubled contact library.

## Background

The Phase 4 duplicate detection engine (P4-01) computes confidence scores based on name, email, and phone matching. The Phase 10 enhanced engine (P10-08) adds additional signals. This ticket calls that engine as part of the OAuth import commit step, creates `MergeSuggestion` rows for detected duplicates, and surfaces a "You may have duplicates" banner after the import completes.

The deduplication does not block the import — contacts are created, and duplicates are surfaced for review rather than requiring pre-import resolution. This is the same model as CSV import.

## Scope

**In scope:**
- Run `generateMergeSuggestions(userId)` (or a targeted subset) after the full OAuth import batch completes
- `SyncJob.duplicatesDetectedCount` field — records how many suggestions were generated
- Post-import banner in the sync connections detail panel: "N potential duplicates found. [Review suggestions →]"
- Link to the merge suggestions page (`/merge-suggestions`)
- Targeted detection: only compare the newly imported contacts against existing contacts (not full re-scan)

**Out of scope:**
- Automatic merging (user must review and confirm — same policy as CSV import)
- Running deduplication on every incremental sync poll (only the initial import)

---

## Design / Implementation Spec

### Deduplication after initial import

At the end of `googleFullImport` (P27-01) and `microsoftFullImport` (P27-04), after all contacts are created:

```typescript
async function runPostImportDeduplication(
  userId: string,
  importedContactIds: string[],
  syncJobId: string,
): Promise<number> {
  // Only compare newly imported contacts against ALL existing contacts
  // to avoid O(n²) on large libraries
  const suggestions = await generateTargetedMergeSuggestions({
    userId,
    targetContactIds: importedContactIds,
  });

  // Create MergeSuggestion rows
  await db.mergeSuggestion.createMany({
    data: suggestions.map((s) => ({
      userId,
      contactIdA: s.contactIdA,
      contactIdB: s.contactIdB,
      confidence: s.confidence,
      confidenceTier: s.confidenceTier,
      reasons: s.reasons,
      status: "PENDING",
    })),
    skipDuplicates: true,
  });

  // Record the count on the sync job
  await db.syncJob.update({
    where: { id: syncJobId },
    data: { duplicatesDetectedCount: suggestions.length },
  });

  return suggestions.length;
}
```

### `generateTargetedMergeSuggestions`

Instead of scanning all contacts, compare only the newly imported contacts against the existing library:

```typescript
async function generateTargetedMergeSuggestions(params: {
  userId: string;
  targetContactIds: string[];
}): Promise<MergeSuggestionInput[]> {
  const targets = await db.contact.findMany({
    where: { id: { in: params.targetContactIds }, userId: params.userId, archivedAt: null },
    select: CONTACT_MERGE_FIELDS,
  });

  const existing = await db.contact.findMany({
    where: {
      userId: params.userId,
      archivedAt: null,
      id: { notIn: params.targetContactIds },
    },
    select: CONTACT_MERGE_FIELDS,
  });

  const suggestions: MergeSuggestionInput[] = [];

  for (const target of targets) {
    for (const candidate of existing) {
      const score = computeMergeScore(target, candidate);
      if (score.confidence >= 0.5) { // MEDIUM or HIGH
        suggestions.push({
          contactIdA: target.id,
          contactIdB: candidate.id,
          confidence: score.confidence,
          confidenceTier: score.tier,
          reasons: score.reasons,
        });
      }
    }
  }

  return suggestions;
}
```

This is O(m × n) where m = imported contacts and n = existing contacts. For typical library sizes (< 5,000), this completes in < 5 seconds. Run asynchronously — it does not block the sync job from completing.

### Post-import banner in the sync connections detail panel

When `SyncJob.duplicatesDetectedCount > 0` for the most recent completed job:

```tsx
{latestJob.duplicatesDetectedCount > 0 && (
  <div style={{
    background: "#f6edd9", border: "1px solid #e9c87b", borderRadius: 10,
    padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
  }}>
    <AlertTriangle size={16} color="#bf8526" />
    <div style={{ fontSize: 13, color: "#7a5a1a" }}>
      <strong>{latestJob.duplicatesDetectedCount} potential duplicates</strong>{" "}
      found from your Google import.
    </div>
    <Link href="/merge-suggestions" style={{ fontSize: 13, color: "#4158f4", marginLeft: "auto" }}>
      Review suggestions →
    </Link>
  </div>
)}
```

### `SyncJob` schema addition

```prisma
// On SyncJob:
duplicatesDetectedCount Int @default(0)
```

Run: `prisma migrate dev --name add-sync-job-duplicate-count`

---

## Acceptance Criteria

- After a full OAuth import, `generateTargetedMergeSuggestions` runs and creates `MergeSuggestion` rows for MEDIUM and HIGH confidence matches.
- `SyncJob.duplicatesDetectedCount` reflects the number of suggestions created.
- The post-import banner appears in the sync connections detail panel when `duplicatesDetectedCount > 0`.
- "Review suggestions →" navigates to `/merge-suggestions`.
- Deduplication does not block the initial import from completing — it runs asynchronously after the contacts are committed.
- Deduplication runs only on the initial full import, not on incremental sync polls.
- `MergeSuggestion.skipDuplicates: true` prevents duplicate suggestion rows if the same pair is detected twice.

---

## Risks and Open Questions

- **Performance on large imports (> 2,000 contacts):** the O(m × n) comparison becomes expensive at scale. For initial imports > 500 contacts, run the deduplication as a background job with a progress indicator, rather than inline in the sync job. Queue it with a 5-minute delay after the import completes. Add a `SyncJob.deduplicationStatus: "PENDING" | "RUNNING" | "DONE"` field to track this.
- **Duplicate detection across multiple imports:** if the user connects both Google and Outlook, and they have overlapping contacts in both, the second import will generate duplicates against both existing contacts and contacts imported from the first source. This is expected behaviour — the merge suggestions page handles cross-source deduplication correctly.
