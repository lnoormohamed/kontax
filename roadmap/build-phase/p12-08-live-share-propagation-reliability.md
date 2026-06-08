# P12-08 Live Share Propagation Reliability and Error Handling

## Purpose
This ticket hardens the live share propagation system introduced in P12-04 with the reliability infrastructure needed for production: debouncing to batch rapid edits, structured error handling and classification, automatic retry when blocking conditions clear, persistent error state on the `ContactShare` record, and surfacing of propagation status in the share management UI. Without this work, the live sharing feature would silently fail when recipient accounts have issues, leave users without any visibility into why their updates are not reaching recipients, and create a noisy propagation queue when contacts are edited rapidly. The goal is that live sharing either works visibly and reliably, or fails visibly and informatively — never silently.

## Background
Phase 12-04 implemented the basic propagation path: when a `CONTACT_UPDATED`, `CONTACT_MERGED`, or `CONTACT_RESTORED` ActivityEvent is emitted for a contact with active `LIVE_SYNC` shares, `propagateLiveShare(contactId)` is called synchronously. This synchronous call is the MVP starting point. This ticket replaces or wraps that call with a proper background job system.

Phase 12-01 included `lastErrorAt` and `lastErrorCode` fields on `ContactShare` for exactly this purpose. This ticket is the consumer of those fields: it writes to them on failure and clears them on success.

Phase 12-05 defined that the share management UI should show "Last synced N minutes ago" or "Sync paused — recipient account issue." This ticket provides the data that drives those UI states. Without the error tracking defined here, P12-05's error state would always be empty.

The `ActivityEvent` model (Phase 10) already includes `SYNC_PUSHED` as an event type. This ticket ensures `SYNC_PUSHED` events are emitted reliably after every successful propagation and not emitted on failed ones.

## Scope

**In scope:**
- Debounce propagation: 30-second debounce per contact to batch rapid edits before pushing
- Background job wrapper for `propagateLiveShare` (queue-based or timer-based depending on infrastructure)
- Error classification: map exception types to `lastErrorCode` values
- Error persistence: update `lastErrorAt` and `lastErrorCode` on the `ContactShare` record on failure
- Error clearing: clear `lastErrorAt` and `lastErrorCode` on the next successful propagation
- Retry logic: automatic retry when a previously-errored share's blocking condition clears
- Account status check before propagation (locked/suspended recipient)
- Propagation status surface: "Last synced N minutes ago" / "Sync paused" state in the share management UI row (implementing the state defined but not wired in P12-05)
- `lastErrorAt` and `lastErrorCode` inclusion in the share summary API response
- Maximum propagation SLA documentation: best-effort 5-minute target
- Structured logging for all propagation outcomes
- Tests for the debounce, retry, and error classification logic

**Out of scope:**
- Email notifications for propagation failures (future enhancement — only in-app for now)
- Propagation to more than one recipient per contact in a single transaction (already handled by P12-04's loop; this ticket optimizes, not restructures)
- Full job queue infrastructure if none exists — the implementation uses the simplest approach available in the current stack

---

## Design / Implementation Spec

### Debounce Strategy

When `CONTACT_UPDATED`, `CONTACT_MERGED`, or `CONTACT_RESTORED` fires for a contact with active `LIVE_SYNC` shares, do not propagate immediately. Instead, schedule a delayed propagation:

```typescript
// src/server/live-share-propagation.ts

const pendingPropagations = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleLiveSharePropagation(contactId: string): void {
  // Clear any existing scheduled propagation for this contact
  const existing = pendingPropagations.get(contactId);
  if (existing) clearTimeout(existing);

  // Schedule a new propagation after the debounce window
  const timer = setTimeout(() => {
    pendingPropagations.delete(contactId);
    void propagateLiveShareWithErrorHandling(contactId);
  }, PROPAGATION_DEBOUNCE_MS);

  pendingPropagations.set(contactId, timer);
}

const PROPAGATION_DEBOUNCE_MS = 30_000; // 30 seconds
```

This in-process debounce collapses rapid edits into a single propagation push. If the user saves the contact 8 times in 25 seconds, one propagation fires 30 seconds after the last edit.

**Limitation:** In-process debounce does not survive process restart. If the Node.js process restarts between the debounce schedule and the fire time, the propagation is lost. For MVP, document this limitation. The mitigation is the "catch-up propagation" described below.

**Catch-up propagation:** A scheduled background job (e.g. running every 5 minutes via cron or Vercel Cron) checks for `LIVE_SYNC` shares where:
- `status === "ACTIVE"`
- `recipientContactId IS NOT NULL`
- The source contact's `updatedAt` is more recent than `lastPushedAt` (or `lastPushedAt IS NULL`)

For each such share, if the contact was updated more than 60 seconds ago (giving the debounce time to fire normally), trigger a catch-up propagation. This ensures that process restarts or missed debounce fires do not result in permanently stale recipient contacts.

```typescript
// Catch-up job: runs every 5 minutes
async function catchUpPropagations(): Promise<void> {
  const threshold = new Date(Date.now() - 60_000); // 60 seconds ago
  
  const stalledShares = await prisma.$queryRaw<{ contactId: string }[]>`
    SELECT DISTINCT cs."contactId"
    FROM "contact_shares" cs
    JOIN contacts c ON c.id = cs."contactId"
    WHERE cs."shareType" = 'LIVE_SYNC'
      AND cs."status" = 'ACTIVE'
      AND cs."recipientContactId" IS NOT NULL
      AND (
        cs."lastPushedAt" IS NULL
        OR c."updatedAt" > cs."lastPushedAt"
      )
      AND c."updatedAt" < ${threshold}
  `;
  
  for (const { contactId } of stalledShares) {
    void propagateLiveShareWithErrorHandling(contactId);
  }
}
```

### Error Classification

```typescript
type PropagationErrorCode =
  | "RECIPIENT_ACCOUNT_LOCKED"
  | "RECIPIENT_ACCOUNT_SUSPENDED"
  | "RECIPIENT_PLAN_DOWNGRADED"
  | "CONTACT_NOT_FOUND"
  | "RECIPIENT_CONTACT_NOT_FOUND"
  | "PROPAGATION_TIMEOUT"
  | "DATABASE_ERROR"
  | "UNKNOWN";

function classifyPropagationError(error: unknown): PropagationErrorCode {
  if (error instanceof AccountLockedError) return "RECIPIENT_ACCOUNT_LOCKED";
  if (error instanceof AccountSuspendedError) return "RECIPIENT_ACCOUNT_SUSPENDED";
  if (error instanceof PlanDowngradedError) return "RECIPIENT_PLAN_DOWNGRADED";
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return "CONTACT_NOT_FOUND"; // Record not found
    return "DATABASE_ERROR";
  }
  if (error instanceof PropagationTimeoutError) return "PROPAGATION_TIMEOUT";
  return "UNKNOWN";
}
```

These error codes are stored in `ContactShare.lastErrorCode`. The share management UI translates them to human-readable strings:

| Code | UI message |
|---|---|
| `RECIPIENT_ACCOUNT_LOCKED` | "Sync paused — recipient account is locked" |
| `RECIPIENT_ACCOUNT_SUSPENDED` | "Sync paused — recipient account is suspended" |
| `RECIPIENT_PLAN_DOWNGRADED` | "Sync stopped — recipient downgraded to Free. Their copy has been converted to static." |
| `CONTACT_NOT_FOUND` | "Sync error — source contact not found" |
| `RECIPIENT_CONTACT_NOT_FOUND` | "Sync error — recipient's contact was deleted" |
| `PROPAGATION_TIMEOUT` | "Sync paused — temporary error, will retry" |
| `DATABASE_ERROR` | "Sync paused — temporary error, will retry" |
| `UNKNOWN` | "Sync paused — temporary error, will retry" |

### propagateLiveShareWithErrorHandling

This is the wrapper that adds error handling and persistence around P12-04's `propagateLiveShare`:

```typescript
export async function propagateLiveShareWithErrorHandling(
  sourceContactId: string
): Promise<void> {
  // Load all active LIVE_SYNC shares for this contact
  const shares = await prisma.contactShare.findMany({
    where: {
      contactId: sourceContactId,
      shareType: "LIVE_SYNC",
      status: "ACTIVE",
      recipientContactId: { not: null },
    },
  });

  if (shares.length === 0) return;

  const sourceContact = await prisma.contact.findUnique({
    where: { id: sourceContactId },
    include: { identifiers: true },
  });

  if (!sourceContact) {
    logger.warn("propagateLiveShare: source contact not found", { sourceContactId });
    // Mark all shares as errored
    await prisma.contactShare.updateMany({
      where: { id: { in: shares.map(s => s.id) } },
      data: {
        lastErrorAt: new Date(),
        lastErrorCode: "CONTACT_NOT_FOUND",
      },
    });
    return;
  }

  const results = await Promise.allSettled(
    shares.map(share => propagateSingleShare(sourceContact, share))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const share = shares[i];
    
    if (result.status === "fulfilled") {
      logger.info("propagation success", { shareId: share.id });
      await prisma.contactShare.update({
        where: { id: share.id },
        data: {
          lastPushedAt: new Date(),
          lastErrorAt: null,
          lastErrorCode: null,
        },
      });
    } else {
      const errorCode = classifyPropagationError(result.reason);
      logger.error("propagation failed", {
        shareId: share.id,
        errorCode,
        error: result.reason,
      });
      await prisma.contactShare.update({
        where: { id: share.id },
        data: {
          lastErrorAt: new Date(),
          lastErrorCode: errorCode,
        },
      });
    }
  }
}
```

`Promise.allSettled` ensures that a failure for one recipient does not prevent propagation from being attempted for other recipients of the same contact.

### propagateSingleShare

The core propagation function for a single share. This is extracted from P12-04's loop body into its own function for testability:

```typescript
async function propagateSingleShare(
  sourceContact: ContactWithIdentifiers,
  share: ContactShare
): Promise<void> {
  // 1. Check recipient account status
  const recipientUser = await prisma.user.findUniqueOrThrow({
    where: { id: share.recipientUserId! },
    select: { id: true, status: true },
  });

  if (recipientUser.status === "LOCKED") throw new AccountLockedError();
  if (recipientUser.status === "SUSPENDED") throw new AccountSuspendedError();

  // 2. Load recipient's linked contact
  const recipientContact = await prisma.contact.findUnique({
    where: { id: share.recipientContactId! },
    include: { identifiers: true },
  });

  if (!recipientContact) {
    // Recipient deleted their contact — revoke the share
    await prisma.contactShare.update({
      where: { id: share.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    throw new Error("Recipient contact not found — share revoked");
  }

  // 3. Apply shared field updates to recipient contact
  // Do NOT overwrite privateNotes or sharedNotesFromOwner-derived private data
  const sharedFieldUpdates = buildSharedFieldUpdates(sourceContact, recipientContact);

  await prisma.$transaction(async (tx) => {
    // Update contact scalar fields
    await tx.contact.update({
      where: { id: recipientContact.id },
      data: {
        displayName: sourceContact.displayName,
        givenName: sourceContact.givenName,
        familyName: sourceContact.familyName,
        middleName: sourceContact.middleName,
        nickname: sourceContact.nickname,
        organizationName: sourceContact.organizationName,
        jobTitle: sourceContact.jobTitle,
        birthday: sourceContact.birthday,
        avatarUrl: sourceContact.avatarUrl,
        // notes: handled separately (sharedNotesFromOwner if field exists)
        primaryEmail: sourceContact.primaryEmail,
        primaryPhone: sourceContact.primaryPhone,
      },
    });

    // Sync identifiers (phone numbers, emails, addresses, etc.)
    await syncContactIdentifiers(tx, sourceContact, recipientContact);
  });

  // 4. Emit SYNC_PUSHED ActivityEvent on the recipient's side
  await emitActivityEvent({
    userId: share.recipientUserId!,
    contactId: share.recipientContactId!,
    eventType: "SYNC_PUSHED",
    actor: "SHARE",
    actorDetail: sourceContact.displayName ?? "Unknown",
    payload: {
      shareId: share.id,
      sourceContactId: sourceContact.id,
      fieldsUpdated: Object.keys(sharedFieldUpdates),
    },
  });
}
```

### syncContactIdentifiers

Identifier sync is a diff-based operation: add new identifiers from the source, update changed ones, mark removed ones as soft-deleted. This mirrors the pattern used in the CardDAV sync pull path.

```typescript
async function syncContactIdentifiers(
  tx: PrismaTransactionClient,
  sourceContact: ContactWithIdentifiers,
  recipientContact: ContactWithIdentifiers
): Promise<void> {
  const sourceIds = sourceContact.identifiers;
  const recipientIds = recipientContact.identifiers;

  // Match identifiers by kind + normalized value
  // Add new ones, update changed labels, mark removed ones as deleted
  // Never delete recipient-added identifiers (those not in source)
  
  for (const sourceId of sourceIds) {
    const existing = recipientIds.find(
      r => r.kind === sourceId.kind && r.valueNormalized === sourceId.valueNormalized
    );
    if (!existing) {
      await tx.contactIdentifier.create({
        data: {
          contactId: recipientContact.id,
          userId: recipientContact.userId,
          kind: sourceId.kind,
          label: sourceId.label,
          valueRaw: sourceId.valueRaw,
          valueNormalized: sourceId.valueNormalized,
          isPrimary: sourceId.isPrimary,
        },
      });
    } else if (existing.label !== sourceId.label || existing.isPrimary !== sourceId.isPrimary) {
      await tx.contactIdentifier.update({
        where: { id: existing.id },
        data: { label: sourceId.label, isPrimary: sourceId.isPrimary },
      });
    }
  }

  // Mark identifiers present in recipient but not in source as soft-deleted
  // Only delete identifiers that originated from the share (not recipient-added ones)
  // For v1: mark any identifier in recipient that is not in source as deleted
  // (assuming recipient cannot add identifiers to shared contacts per P12-04 edit rights)
  for (const recipientId of recipientIds) {
    const stillInSource = sourceIds.some(
      s => s.kind === recipientId.kind && s.valueNormalized === recipientId.valueNormalized
    );
    if (!stillInSource) {
      await tx.contactIdentifier.update({
        where: { id: recipientId.id },
        data: { deletedAt: new Date() },
      });
    }
  }
}
```

Note: if the product in P12-04 allows recipients to add their own identifiers (e.g. private phone numbers), this sync logic must be updated to preserve recipient-added identifiers. For v1, the edit rights restriction prevents recipients from adding identifiers, so this simpler approach is safe.

### Retry Logic on Account Recovery

When a share is in an error state (`lastErrorAt IS NOT NULL`) due to an account lock or suspension, propagation must resume automatically when the blocking condition clears.

Implementation: include errored shares in the catch-up job's query:

```typescript
const stalledOrErroredShares = await prisma.$queryRaw<{ contactId: string }[]>`
  SELECT DISTINCT cs."contactId"
  FROM "contact_shares" cs
  JOIN contacts c ON c.id = cs."contactId"
  WHERE cs."shareType" = 'LIVE_SYNC'
    AND cs."status" = 'ACTIVE'
    AND cs."recipientContactId" IS NOT NULL
    AND (
      -- Stalled (contact updated but not propagated)
      (
        cs."lastPushedAt" IS NULL
        OR c."updatedAt" > cs."lastPushedAt"
      )
      AND c."updatedAt" < ${stallenessThreshold}
    OR
      -- Previously errored (retry after backoff period)
      cs."lastErrorAt" IS NOT NULL
      AND cs."lastErrorAt" < ${retryThreshold}
    )
`;
```

`retryThreshold`: for retryable errors (PROPAGATION_TIMEOUT, DATABASE_ERROR, UNKNOWN), retry after 5 minutes. For non-retryable errors (RECIPIENT_ACCOUNT_LOCKED, RECIPIENT_ACCOUNT_SUSPENDED), retry after 1 hour (checking whether the account has recovered).

For `RECIPIENT_PLAN_DOWNGRADED` and `RECIPIENT_CONTACT_NOT_FOUND` and `CONTACT_NOT_FOUND`: these are permanent states. Do not retry. Instead, the auto-conversion logic in P12-04 should have already handled `PLAN_DOWNGRADED`. For `CONTACT_NOT_FOUND` on the recipient side, the share should have been revoked. Log these cases and alert if they appear in the catch-up query — they indicate a missed auto-conversion or revocation.

**Exponential backoff** for persistent errors: after 3 consecutive failures, double the retry interval. Cap at 4 hours. Track consecutive failure count using the gap between `lastErrorAt` and `now()` — do not add a separate counter column.

```typescript
function getRetryIntervalMs(lastErrorAt: Date, errorCode: string): number {
  const retryableErrors = new Set([
    "RECIPIENT_ACCOUNT_LOCKED",
    "RECIPIENT_ACCOUNT_SUSPENDED",
    "PROPAGATION_TIMEOUT",
    "DATABASE_ERROR",
    "UNKNOWN",
  ]);
  
  if (!retryableErrors.has(errorCode)) return Infinity; // Don't retry
  
  const errorAgeMins = (Date.now() - lastErrorAt.getTime()) / 60_000;
  
  if (errorAgeMins < 5) return 5 * 60_000;    // Retry after 5 min
  if (errorAgeMins < 30) return 15 * 60_000;  // Retry after 15 min
  if (errorAgeMins < 120) return 60 * 60_000; // Retry after 1 hour
  return 4 * 60 * 60_000;                     // Cap at 4 hours
}
```

### Propagation Status in Share Management UI

The share management UI in P12-05 defined the "Last synced N minutes ago" / "Sync paused" states. This ticket provides the implementation:

The `ShareSummary` type returned by `getContactShares` already includes `lastErrorAt` and `lastErrorCode`. The `AccountShareRow` component in P12-05 must render the error state:

```tsx
// In AccountShareRow, for LIVE_SYNC shares
{share.lastErrorCode ? (
  <span className="share-row-error-state">
    Sync paused · {translateErrorCode(share.lastErrorCode)}
    <InfoIcon aria-label="Learn more" />
  </span>
) : share.lastPushedAt ? (
  <span className="share-row-sync-time">
    Synced {formatRelativeTime(share.lastPushedAt)}
  </span>
) : (
  <span className="share-row-sync-time">
    Awaiting first sync
  </span>
)}
```

`translateErrorCode` maps the machine-readable code to the user-facing string from the error code table above.

The info icon on the error state opens a tooltip or inline explanation: "Contact updates aren't reaching this recipient right now. We'll keep trying. {Specific reason}."

### Maximum Propagation SLA

Document in both the codebase and in the internal API documentation:

> **Live share propagation SLA:** Changes to a contact with active live shares will propagate to recipients within a best-effort window of **5 minutes** under normal conditions. This window assumes:
> - The background catch-up job runs every 5 minutes (or the debounce fires within 30 seconds and the job completes within 90 seconds).
> - Recipient accounts are active and accessible.
> - The database and network are operating normally.
>
> This SLA is **not a guarantee** and is not contractually enforceable. It is an operational target. Network issues, infrastructure events, or recipient account problems can extend propagation time indefinitely. Error states are surfaced to the owner via the share management UI.

This documentation should be in a `docs/sla.md` file or equivalent internal documentation location, not in user-facing copy.

### Structured Logging

Every propagation outcome must produce a structured log entry:

```typescript
// Success
logger.info("live_share_propagation_success", {
  shareId: share.id,
  contactId: sourceContact.id,
  recipientUserId: share.recipientUserId,
  recipientContactId: share.recipientContactId,
  fieldsUpdated: Object.keys(sharedFieldUpdates).length,
  durationMs: endTime - startTime,
});

// Failure
logger.error("live_share_propagation_failure", {
  shareId: share.id,
  contactId: sourceContact.id,
  recipientUserId: share.recipientUserId,
  errorCode,
  errorMessage: error instanceof Error ? error.message : String(error),
  durationMs: endTime - startTime,
});

// Catch-up job run
logger.info("live_share_catchup_job_complete", {
  sharesChecked: stalledOrErroredShares.length,
  propagationsTriggered: triggeredCount,
  durationMs: endTime - startTime,
});
```

These logs enable monitoring dashboards and alerting. If the `live_share_propagation_failure` rate exceeds a threshold (e.g. 5% of propagations in a 1-hour window), an alert should fire. The alerting setup is outside this ticket but the log structure enables it.

### Tests

This ticket must include automated tests for:

1. **Debounce behavior:** two rapid edits within 30 seconds produce exactly one propagation call.
2. **Error classification:** each exception type maps to the correct `PropagationErrorCode`.
3. **Error persistence:** after a failed propagation, `lastErrorAt` and `lastErrorCode` are set on the share record.
4. **Error clearing:** after a successful propagation following a previous failure, `lastErrorAt` and `lastErrorCode` are null.
5. **Catch-up job query:** shares where `updatedAt > lastPushedAt` are included; recently-updated shares (within 60s) are excluded to avoid racing with the debounce.
6. **Identifier sync:** new identifiers are added, changed labels are updated, removed identifiers are soft-deleted.
7. **Account status check:** propagation throws `AccountLockedError` when recipient account status is `LOCKED`.
8. **Recipient contact missing:** propagation revokes the share when `recipientContactId` no longer exists in the database.
9. **`Promise.allSettled` isolation:** a failure for recipient B does not prevent propagation for recipient C on the same contact.

Use Vitest or Jest (whichever the project uses). Mock Prisma calls using the project's existing mock pattern. Do not make real database calls in unit tests.

---

## Acceptance Criteria

- A contact saved 5 times within 25 seconds triggers exactly one propagation push, fired 30 seconds after the last save.
- A failed propagation due to `RECIPIENT_ACCOUNT_LOCKED` sets `lastErrorAt` and `lastErrorCode: "RECIPIENT_ACCOUNT_LOCKED"` on the `ContactShare` record.
- After a subsequent successful propagation, `lastErrorAt` and `lastErrorCode` are both null and `lastPushedAt` is updated.
- The share management UI shows "Sync paused — recipient account is locked" when the error code is `RECIPIENT_ACCOUNT_LOCKED`.
- The share management UI shows "Synced 2 minutes ago" when the last push was 2 minutes ago.
- The catch-up job runs every 5 minutes (via cron) and triggers propagation for stale shares.
- A propagation failure for one recipient does not prevent propagation from being attempted for other recipients of the same contact.
- When the recipient deletes their linked contact, the share is automatically revoked.
- All propagation outcomes (success and failure) produce structured log entries with the fields specified in the logging spec.
- All tests listed in the Tests section pass.
- The propagation SLA is documented in the codebase.

---

## Risks and Open Questions

- **In-process debounce and process restart** — the debounce uses `setTimeout` which does not survive a process restart. The catch-up job is the safety net. Ensure the catch-up job's 60-second staleness threshold gives adequate time for the debounce to fire normally under load. If the process restarts frequently (e.g. due to Vercel's serverless redeployments), the effective debounce behavior is degraded. Consider moving to a persistent queue (BullMQ, Inngest, Trigger.dev) if this becomes a problem.
- **Catch-up job scheduling in Vercel** — Vercel Cron (available on Pro plans) can trigger a serverless function every 5 minutes. If Kontax is deployed on Vercel, confirm the cron job setup. If not on Vercel, use a different scheduler. Document the scheduler implementation in a `src/jobs/README.md`.
- **Propagation latency under load** — if a contact with 50 active live shares is updated, all 50 propagations are attempted within a single catch-up cycle. If each propagation takes 200ms, that is 10 seconds for sequential execution. Use `Promise.allSettled` with a concurrency limit (e.g. 5 concurrent) rather than fully sequential or fully parallel, to avoid overwhelming the database connection pool.
- **`$queryRaw` for catch-up job** — the catch-up job query uses a raw SQL query to compare `updatedAt > lastPushedAt` across two tables. Ensure this query uses the database indexes correctly. Add an `EXPLAIN ANALYZE` to the query comment to document its performance characteristics.
- **`syncContactIdentifiers` and recipient-added identifiers** — the v1 assumption is that recipients cannot add identifiers to shared contacts. If this assumption changes (P12-04 noted it as a future enhancement), the sync logic must be updated to preserve recipient-added identifiers. Tag the relevant code with a `// TODO: update when recipients can add identifiers` comment.
- **Propagation on CONTACT_ARCHIVED and CONTACT_DELETED** — currently the trigger events are CONTACT_UPDATED, CONTACT_MERGED, and CONTACT_RESTORED. What happens when the owner archives or deletes a contact with active live shares? P12-04 defines that the share should be revoked and the recipient's contact converted to static. This event handling is in P12-04 but must be verified here — add a test case for this scenario.

---

## Outcome

Live share propagation is reliable enough for production use: rapid edits are batched, failures are tracked and retried, and both the owner and recipient have clear visibility into sync status — making the live sharing feature trustworthy rather than fragile.
