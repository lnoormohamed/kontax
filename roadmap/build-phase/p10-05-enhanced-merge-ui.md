# P10-05 Enhanced Merge: Field-Level Selection and Bulk Accept

## Purpose
The current merge UI presents two full contact cards and asks the user to pick one to keep. This is too coarse — in practice, one contact may have a better phone number while the other has a better email address, and the user wants to keep the best of each. The field-level merge UI introduced by this ticket gives users precise control over the final contact. Additionally, high-confidence duplicate suggestions are trustworthy enough to accept in bulk, and the existing UI requires opening each suggestion individually. Bulk accept speeds up a large import or sync cleanup dramatically. Finally, once contacts are merged, there is currently no way to undo the decision — adding a 30-day undo window with visible "merged contacts" history removes the anxiety of accidentally merging the wrong contacts.

## Background
The MergeSuggestion model stores `leftContactId`, `rightContactId`, `confidence` (HIGH/MEDIUM/LOW), `score`, `signals` (JSON), and `reasons` (JSON). The MergeDecision model stores the outcome (ACCEPTED/REJECTED/REVERSED) and `source` (who made the decision). The merge flow archives the "absorbed" contact and writes the surviving contact's fields.

The ActivityEvent model from P10-01 provides the event types CONTACT_MERGED, CONTACT_MERGE_UNDONE, and CONTACT_ARCHIVED needed to record merge operations. This ticket's merge actions must emit these events.

The existing merge UI is in the duplicates tab of the main workspace. The exact component location needs to be confirmed during implementation, but it is within the Duplicates section.

Field-level merge requires knowing which fields differ between the two contacts. For fields with the same value on both, auto-merge (pick either one). For fields with different values, present both and require a choice. For multi-value fields (phoneNumbers, emailAddresses, addresses), the merge can keep both lists, keep one, or union them — present each array field as a separate decision.

## Scope

### In Scope
- Replacing the "keep left or keep right" merge UI with a field-level merge review screen
- Auto-merging identical fields silently
- Field-level selection for all structured Contact fields
- Multi-value field handling: keep A's list, keep B's list, or merge both lists
- Bulk accept action for HIGH confidence suggestions
- Bulk accept confirmation dialog showing the number of pairs
- "Merged contacts" section in the duplicates tab
- Per-merge undo button with 30-day availability window
- Undo confirmation dialog
- Emitting ActivityEvent events for all merge and undo operations
- "Merged by" label in the merged contacts section (user-initiated vs. bulk)
- Updating `lastMutatedBy` on Contact records as part of merge and undo (P10-03 integration)

### Out of Scope
- Changing how MergeSuggestions are generated (P10-08)
- The signal detail panel on suggestions (P10-08)
- Reversing merges beyond 30 days
- Merging more than two contacts at once (not planned for Phase 10)
- Auto-merging without user confirmation (not planned)

## Design / Implementation Spec

### Field-Level Merge UI

When the user opens a merge suggestion, instead of seeing two contact cards with "Keep left / Keep right" buttons, they see a side-by-side field comparison:

```
[Left contact name]          [Right contact name]
[Left source badge]          [Right source badge]

First name:    John [○]      John [●] ← identical, auto-selected
Last name:     Smith [○]     Smyth [●] ← differs, user must choose
Phone:         [○] 555-1234  [●] 555-1234, 555-5678 ← multi-value
Email:         [●] j@work    [○] j@home ← pre-selected but editable
Company:       [○] Acme      [○] Acme Corp ← user must choose

[Cancel]                     [Merge]
```

**Auto-merge rules:**
- If both values are equal (using deep equality for arrays), mark the field as "auto-merged" — show it in a collapsed state with a checkmark, not requiring user input
- If only one side has a value and the other is null/empty, auto-select the non-null side

**Pre-selection rules for differing values:**
- Pre-select the left contact for all differing scalar fields (matching the existing "keep left" default behavior)
- For multi-value fields where both sides have values: show a three-way choice — "Keep [left]", "Keep [right]", "Keep both (merge lists)"
- Deduplicate merged arrays: if both sides have the same phone number, the union list should not contain it twice

**Field ordering:**
Show fields in this order: full name (if present) / first+last name, phone numbers, email addresses, company, job title, addresses, birthday, notes, website URLs, social profiles. Other fields follow alphabetically.

**Merge button state:**
The Merge button is disabled until all differing non-optional fields have a selection. Null/empty fields are considered resolved (no choice needed).

#### Multi-value Field UI

For phoneNumbers, emailAddresses, addresses, and websiteUrls, the choice is:

```
Phone numbers:
  Left: 555-1234
  Right: 555-5678 · 555-9999

  [○] Use left's phones (555-1234)
  [○] Use right's phones (555-5678, 555-9999)
  [●] Keep all (555-1234, 555-5678, 555-9999) ← default for multi-value
```

Deduplication happens automatically when "Keep all" is selected — phone numbers are compared after normalization (E.164, see P10-08 for normalization details).

### Merge Server Action

**Location**: `src/app/actions/merges.ts` (new file if not existing) or within the existing contacts actions.

```typescript
interface FieldResolution {
  field: string;
  chosenFrom: "left" | "right" | "both";
  mergedValue?: unknown; // For "both" — the union of left and right values
}

interface AcceptMergeInput {
  suggestionId: string;
  fieldResolutions: FieldResolution[];
}

async function acceptMerge(input: AcceptMergeInput): Promise<{ survivorId: string }> {
  // 1. Load suggestion, verify it is OPEN and belongs to user
  // 2. Load both contacts
  // 3. Build the final contact state from fieldResolutions
  // 4. Begin transaction:
  //    a. Update surviving contact with merged field values
  //    b. Set lastMutatedBy = MANUAL, lastMutatedByDetail = null on surviving contact
  //    c. Archive absorbed contact (set archivedAt)
  //    d. Set mergedIntoContactId on absorbed contact
  //    e. Update MergeSuggestion status to MERGED
  //    f. Create MergeDecision record
  //    g. Emit CONTACT_MERGED event on surviving contact (P10-02 integration)
  //    h. Emit CONTACT_ARCHIVED event on absorbed contact (P10-02 integration)
  // 5. Return survivorId
}
```

**Determining surviving vs absorbed contact:**

- By default, keep the left contact as the survivor and archive the right contact
- The field resolutions may result in the final contact looking more like the right — but the surviving contact ID is still the left contact's ID
- This is a UX simplification. The user is not asked which "container" to keep — the left contact is always the container, and the field values flow in from whichever side was chosen

**Building merged field values:**

```typescript
function buildMergedContact(
  left: Contact,
  right: Contact,
  resolutions: FieldResolution[]
): Partial<Contact> {
  const result: Partial<Contact> = {};
  
  for (const resolution of resolutions) {
    const field = resolution.field as keyof Contact;
    if (resolution.chosenFrom === "left") {
      result[field] = left[field];
    } else if (resolution.chosenFrom === "right") {
      result[field] = right[field];
    } else if (resolution.chosenFrom === "both") {
      // For array fields only
      result[field] = deduplicateArrayField(field, left[field], right[field]);
    }
  }
  
  return result;
}
```

### Bulk Accept Action

**Trigger**: A "Bulk accept" button in the duplicates tab, visible when there is at least one HIGH confidence suggestion in OPEN status.

**Confirmation dialog:**
```
Merge {N} duplicate pairs?

These are all high-confidence matches. Each pair will be merged,
keeping the contact that was added first.

[Cancel]   [Merge {N} pairs]
```

**Implementation:**

```typescript
async function bulkAcceptHighConfidenceSuggestions(userId: string): Promise<{
  mergedCount: number;
  failedCount: number;
}> {
  const suggestions = await prisma.mergeSuggestion.findMany({
    where: {
      userId,
      status: "OPEN",
      confidence: "HIGH",
    },
    include: { leftContact: true, rightContact: true },
  });

  let mergedCount = 0;
  let failedCount = 0;

  for (const suggestion of suggestions) {
    try {
      await prisma.$transaction(async (tx) => {
        // Auto-resolve all fields: left wins for scalar diffs, "both" for multi-value
        const autoResolutions = computeAutoResolutions(
          suggestion.leftContact,
          suggestion.rightContact
        );
        
        await applyMerge(tx, {
          survivorId: suggestion.leftContactId,
          absorbedId: suggestion.rightContactId,
          fieldResolutions: autoResolutions,
          userId,
          suggestionId: suggestion.id,
        });
      });
      mergedCount++;
    } catch (error) {
      // Log but continue — a single failed merge should not stop the bulk operation
      console.error(`Failed to merge suggestion ${suggestion.id}:`, error);
      failedCount++;
    }
  }

  return { mergedCount, failedCount };
}
```

**Auto-resolution for bulk accept:**

For scalar fields: left wins if both have values; take whichever is non-null if only one side has a value.
For multi-value fields: always "both" (union merge) — bulk accept should be conservative and keep all data.

Each merge in a bulk accept emits its own individual CONTACT_MERGED and CONTACT_ARCHIVED events. There is no single "bulk merged" event type. This is intentional so each merge is individually undoable.

**Bulk accept failure handling:**

If some merges fail in a bulk accept:
- Show a summary: "Merged {N} pairs. {M} could not be merged and have been skipped."
- Failed pairs remain as OPEN suggestions
- Do not show an error page — partial success is acceptable

### "Merged Contacts" Section

A new collapsible section in the duplicates tab below the open suggestions list:

```
Merged Contacts  ▲  (12)
─────────────────────────
John Smith  ←  J. Smith          3 days ago   [Undo]
Jane Doe  ←  Jane D.             1 week ago   [Undo]
Emily Chen  ←  Emily C.          2 weeks ago  [Undo]
...
[Show older merges]
```

**Data source**: Query MergeDecision with status ACCEPTED joined to ActivityEvent for CONTACT_MERGED events, within the last 30 days.

**Alternative**: Query ActivityEvent directly for CONTACT_MERGED events within the last 30 days for the user.

**Recommended approach**: Query ActivityEvent for CONTACT_MERGED events — this is consistent with P10-02's approach and avoids coupling to MergeDecision joins.

```typescript
const recentMerges = await prisma.activityEvent.findMany({
  where: {
    userId,
    eventType: "CONTACT_MERGED",
    createdAt: { gte: thirtyDaysAgo },
  },
  orderBy: { createdAt: "desc" },
  take: 20,
  include: { contact: true }, // The surviving contact
});
```

The `payload.absorbedContactName` from the CONTACT_MERGED event provides the absorbed contact's name.

**Undo button visibility:**

The undo button is visible for 30 days after the merge. After 30 days, the row remains visible in the section but the undo button is replaced with a muted "Expired" label. The 30-day window starts from the `createdAt` of the CONTACT_MERGED event.

### Merge Undo Action

**Trigger**: "Undo" button on a merged contact row in the "Merged contacts" section.

**Undo confirmation dialog:**
```
Undo this merge?

This will:
• Restore "[Absorbed contact name]" as a separate contact
• Revert "[Surviving contact name]" to its pre-merge state
• Re-open the duplicate suggestion

This cannot be undone.

[Cancel]   [Undo merge]
```

**Implementation:**

```typescript
async function undoMerge(
  userId: string,
  mergeEventId: string
): Promise<void> {
  const mergeEvent = await prisma.activityEvent.findUnique({
    where: { id: mergeEventId },
  });
  
  if (!mergeEvent || mergeEvent.userId !== userId) {
    throw new Error("Not found");
  }
  
  const payload = mergeEvent.payload as ContactMergedPayload;
  const survivorId = mergeEvent.contactId!;
  const absorbedId = payload.absorbedContactId;
  
  // Check 30-day window
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (mergeEvent.createdAt < thirtyDaysAgo) {
    throw new Error("Undo window has expired");
  }
  
  await prisma.$transaction(async (tx) => {
    // 1. Restore absorbed contact (clear archivedAt and mergedIntoContactId)
    await tx.contact.update({
      where: { id: absorbedId },
      data: { archivedAt: null, mergedIntoContactId: null },
    });
    
    // 2. Revert surviving contact's fields to pre-merge state
    //    Read the pre-merge state from the CONTACT_UPDATED event that was emitted at merge time
    //    If no CONTACT_UPDATED event exists (fields were identical), no reversion needed
    const preMergeUpdateEvent = await tx.activityEvent.findFirst({
      where: {
        contactId: survivorId,
        eventType: "CONTACT_UPDATED",
        createdAt: mergeEvent.createdAt, // Same transaction, same timestamp
      },
    });
    
    if (preMergeUpdateEvent) {
      const diffs = (preMergeUpdateEvent.payload as ContactUpdatedPayload).diffs;
      const revertData: Record<string, unknown> = {};
      for (const diff of diffs) {
        revertData[diff.field] = diff.before;
      }
      await tx.contact.update({ where: { id: survivorId }, data: revertData });
    }
    
    // 3. Reopen the MergeSuggestion if it still exists
    await tx.mergeSuggestion.updateMany({
      where: {
        OR: [
          { leftContactId: survivorId, rightContactId: absorbedId },
          { leftContactId: absorbedId, rightContactId: survivorId },
        ],
        status: "MERGED",
      },
      data: { status: "OPEN" },
    });
    
    // 4. Emit CONTACT_MERGE_UNDONE event on surviving contact
    await emitEvent(tx, {
      userId,
      contactId: survivorId,
      eventType: "CONTACT_MERGE_UNDONE",
      actor: "USER",
      payload: {
        restoredContactId: absorbedId,
        originalMergeEventId: mergeEventId,
      },
    });
    
    // 5. Emit CONTACT_RESTORED on the absorbed (now restored) contact
    await emitEvent(tx, {
      userId,
      contactId: absorbedId,
      eventType: "CONTACT_RESTORED",
      actor: "USER",
      payload: {},
    });
    
    // 6. Emit CONTACT_UPDATED if fields were reverted on surviving contact
    if (preMergeUpdateEvent) {
      const revertDiffs = (preMergeUpdateEvent.payload as ContactUpdatedPayload).diffs
        .map(d => ({ field: d.field, before: d.after, after: d.before }));
      await emitEvent(tx, {
        userId,
        contactId: survivorId,
        eventType: "CONTACT_UPDATED",
        actor: "USER",
        payload: { diffs: revertDiffs },
      });
    }
  });
}
```

**Pre-merge state recovery challenge:**

The undo relies on the CONTACT_UPDATED event that was emitted during the original merge to know the pre-merge field values. This assumes that the merge emit a CONTACT_UPDATED event alongside the CONTACT_MERGED event. P10-02 must be implemented such that when a merge modifies the surviving contact's fields, a CONTACT_UPDATED event is always emitted in the same transaction. If this is not the case, undo cannot safely revert field values and must fall back to a "best effort" revert based on the `fieldResolutions` payload of the CONTACT_MERGED event.

**Fallback approach for undo:**

If no CONTACT_UPDATED event is found for the surviving contact at the time of the merge, use the `fieldResolutions` in the CONTACT_MERGED event payload. For each field where `chosenFrom === "right"`, revert to the absorbed contact's value. This requires reading the absorbed contact's field values — which are still present on the (archived) contact record unless it was hard-deleted.

### Updated MergeSuggestion Query for Duplicates Tab

The duplicates tab query must now:
1. Exclude MERGED and STALE suggestions from the main suggestions list (these go in the "Merged contacts" section or are hidden)
2. Include OPEN suggestions sorted by confidence (HIGH first) then by score descending
3. Include a separate query for the "Merged contacts" section (CONTACT_MERGED events in last 30 days)

### Integration with P10-08

P10-08 adds a signal detail panel to each suggestion. The merge UI must reserve space for the signal detail panel in the suggestion card. P10-08 will wire the panel content — P10-05 only needs to ensure the merge review screen has a "Why was this suggested?" expandable section that P10-08 can populate.

## Acceptance Criteria

- Opening a merge suggestion shows the field-level comparison screen, not the "keep left or keep right" card-level UI
- Fields that are identical on both contacts are shown in a collapsed "auto-merged" state
- Fields that differ show both values with a selection control
- Multi-value fields (phoneNumbers, emailAddresses, addresses) offer "Keep left", "Keep right", and "Keep both" options
- "Keep both" deduplicates values correctly
- The Merge button is disabled until all differing fields have a selection
- Accepting the merge writes the correct field values to the surviving contact
- Accepting the merge emits CONTACT_MERGED on the surviving contact and CONTACT_ARCHIVED on the absorbed contact in the same transaction
- Bulk accept button appears when at least one HIGH confidence OPEN suggestion exists
- Bulk accept confirmation dialog shows the correct count of pairs
- Bulk accept merges all HIGH confidence OPEN suggestions
- Bulk accept emits individual CONTACT_MERGED + CONTACT_ARCHIVED events per pair, not a single bulk event
- Each pair in a bulk accept can be undone independently after the bulk operation
- "Merged contacts" section appears in the duplicates tab
- "Merged contacts" section shows merges from the last 30 days
- Undo button is visible for merges within the 30-day window
- Undo button is replaced with "Expired" for merges older than 30 days
- Clicking Undo shows a confirmation dialog
- Confirming undo restores the absorbed contact (clears archivedAt and mergedIntoContactId)
- Confirming undo reverts the surviving contact's fields to their pre-merge state
- Confirming undo re-opens the MergeSuggestion
- Confirming undo emits CONTACT_MERGE_UNDONE, CONTACT_RESTORED, and CONTACT_UPDATED events
- TypeScript compilation passes with no new errors
- Merge and undo operations are transactional — no partial state if the transaction fails

## Risks and Open Questions

- **Pre-merge state recovery**: The undo relies on a CONTACT_UPDATED event being emitted during the original merge. This creates a dependency on P10-02 instrumentation being correct. If the merge does not emit CONTACT_UPDATED (e.g., because the fields being merged were null→value changes that the diff algorithm treats differently), undo may not fully revert. This must be tested explicitly.
- **Bulk accept for large suggestion lists**: A user with 500 HIGH confidence suggestions from a large import could trigger 500 individual merge transactions. Consider chunking bulk accept into batches of 50 with progress feedback, rather than firing all at once.
- **"Keep both" for phone/email deduplication**: The deduplication logic must normalize before comparing. A contact with "555-1234" and one with "+1 555-1234" should be treated as the same phone number. This normalization is being developed in P10-08. For P10-05, implement basic string equality deduplication and upgrade to normalized comparison once P10-08 lands.
- **Surviving contact ID**: Always keeping the left contact as the survivor is a simplification. Some users may prefer to keep the more recently updated contact, or the one with more data. Consider adding a "which contact to keep" option in the field-level merge UI, or document the left-survives convention clearly in the UI ("The first contact's ID is preserved").
- **Merge undo after subsequent edits**: If the surviving contact is edited after the merge, undoing the merge reverts those edits too. This is the stated behavior ("reverts to pre-merge state"), but it may surprise users. The undo confirmation dialog must warn "This will also revert any edits made to [name] since the merge."
- **MergeSuggestion re-open on undo**: When a merge is undone, the suggestion is re-opened. This may cause it to appear in the suggestions list again. The suggestion should be regenerated by P10-08's auto-stale mechanism rather than just re-opened with potentially outdated signal data.

## Outcome

Users can review and accept merge suggestions at the field level with full control over each field's final value, bulk-accept high-confidence duplicates with one action, and undo any merge within a 30-day window from a dedicated "merged contacts" history section.
