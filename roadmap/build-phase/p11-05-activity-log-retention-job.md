# P11-05 Activity Log Retention Enforcement Job

## Purpose
This ticket implements the nightly background job that prunes `ActivityEvent` rows from the database according to each user's plan retention policy. It enforces the activity log retention tiers defined in P11-01: Free users have no global feed (per-contact history is limited at query time, not by deletion), Pro users retain 90 days, Family users retain 365 days, and Teams users are never pruned. The job runs per-user so individual accounts can be paused or skipped without affecting others, and it records its own outcome as a SYSTEM ActivityEvent for auditability.

## Background
The `ActivityEvent` model (or equivalent — referred to throughout as `ActivityEvent` based on Phase 10 naming conventions and P11-01 language) is the event log for contact changes, imports, merges, syncs, exports, billing transitions, and sharing events. As the user base grows, unbounded event accumulation will become an operational cost issue. More importantly, the retention window is a product feature: Pro users are buying 90-day history, Family users 365-day history, and Free users are buying nothing beyond per-contact point-in-time history at query time.

The current codebase does not have an `ActivityEvent` model in the Prisma schema reviewed for Phase 11. The schema review in preparation for this ticket found that the model is either named differently (e.g., `AuditEvent` was in the P1-01 blueprint but as a security audit model, not a user-facing activity log) or has not been implemented yet. This ticket must clarify which model represents user-facing activity events before it can be fully implemented.

**Pre-condition for this ticket:** The `ActivityEvent` (or equivalent) model must exist in the schema with at minimum: `id`, `userId`, `contactId` (nullable), `eventType`, `source`, `createdAt`. If the model does not exist, a schema migration to add it is in scope for this ticket as a prerequisite step.

## Scope
### In scope
- Background job function that, when invoked, iterates over all users with active subscriptions (or no subscription for Free users) and prunes `ActivityEvent` rows older than their plan's `activityLogRetentionDays` value.
- Per-user execution loop: the job processes one user at a time, not a single bulk delete across all users.
- Retention logic:
  - `activityLogRetentionDays === 0` (Free): delete all global feed events. Per-contact history rows are kept but limited at query time — this is handled separately (see section 6).
  - `activityLogRetentionDays === 90` (Pro): delete events older than 90 days.
  - `activityLogRetentionDays === 365` (Family): delete events older than 365 days.
  - `activityLogRetentionDays === null` (Teams): skip entirely. No deletion for this user.
- SYSTEM ActivityEvent emitted after each user's pruning run, recording the count of deleted events.
- Job invocation mechanism: an HTTP endpoint or cron utility callable by an external scheduler (e.g., Vercel Cron, GitHub Actions, Inngest, or any cron service configured for the deployment environment).
- Error handling: a pruning failure for one user must not abort the job for subsequent users. Errors are collected and reported at the end.

### Out of scope
- Per-contact history query-time limit (showing only the last 10 events for Free users) — this is a query modification in the contact detail view, not a deletion task. It is gated in the server action or route that loads per-contact history.
- Retention for group shared address book activity logs — the `activityLogRetentionDays` field on the group subscription covers this but the group activity log model is a Phase 13/14 concern. The retention job should be designed to accommodate a group log table in a future extension without rewriting the core loop.
- Deletion of `AuditEvent` rows (security audit trail, append-only, never deleted by product jobs).
- Export artifact cleanup — separate job (mentioned in BILLING_OPERATIONAL_JOBS in billing.ts).

---

## Design / Implementation Spec

### 1. ActivityEvent model prerequisite

Before writing the retention job, confirm the model. Check `prisma/schema.prisma` for any of: `ActivityEvent`, `ActivityLog`, `ContactActivityEvent`, `UserEvent`. If none exists, add the following to the schema as part of this ticket's migration:

```prisma
enum ActivityEventSource {
    USER
    SYNC
    IMPORT
    MERGE
    SYSTEM
    SHARING
    BILLING
}

model ActivityEvent {
    id          String               @id @default(cuid())
    userId      String
    user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
    contactId   String?
    contact     Contact?             @relation(fields: [contactId], references: [id], onDelete: SetNull)
    eventType   String               -- e.g., "contact.updated", "import.completed", "merge.accepted"
    source      ActivityEventSource  @default(USER)
    payload     Json?                -- optional structured detail about the event
    createdAt   DateTime             @default(now())

    @@index([userId, createdAt])
    @@index([contactId, createdAt])
    @@index([userId, source, createdAt])
}
```

The `User` model must add `activityEvents ActivityEvent[]`.

The `Contact` model must add `activityEvents ActivityEvent[] @relation(...)`.

If the model already exists with different field names, document the actual field names and adapt the retention job accordingly.

### 2. Job file location and naming

The retention job should live at:

```
src/jobs/activity-log-retention.ts
```

If a `src/jobs/` directory does not exist, create it. This establishes the convention for background job files going forward.

### 3. Core retention function

```typescript
// src/jobs/activity-log-retention.ts

import { db } from "~/server/db";

export type RetentionJobResult = {
  processedUsers: number;
  prunedUsers: number;
  skippedUsers: number;   // Teams users or users with null retention
  totalEventsDeleted: number;
  errors: Array<{ userId: string; error: string }>;
  startedAt: Date;
  completedAt: Date;
};

export const runActivityLogRetentionJob = async (): Promise<RetentionJobResult> => {
  const startedAt = new Date();
  const result: RetentionJobResult = {
    processedUsers: 0,
    prunedUsers: 0,
    skippedUsers: 0,
    totalEventsDeleted: 0,
    errors: [],
    startedAt,
    completedAt: startedAt,
  };

  // Load all users along with their effective activityLogRetentionDays.
  // For group members, the retention days come from the group owner's subscription
  // (same resolution logic as getUserBillingContext).
  // For simplicity in Phase 11, load all active User IDs and resolve retention per user.

  const users = await db.user.findMany({
    select: {
      id: true,
      lifecycleState: true,
    },
    where: {
      lifecycleState: { not: "LOCKED" }, // Skip locked accounts entirely
    },
  });

  for (const user of users) {
    result.processedUsers++;

    try {
      const retentionDays = await resolveRetentionDaysForUser(user.id);

      if (retentionDays === null) {
        // Teams: unlimited retention, skip.
        result.skippedUsers++;
        continue;
      }

      if (retentionDays === 0) {
        // Free: delete all global feed events (events not linked to a specific contact).
        // Per-contact events are kept but limited at query time.
        const deleted = await pruneGlobalFeedEvents(user.id);
        if (deleted > 0) {
          result.prunedUsers++;
          result.totalEventsDeleted += deleted;
          await emitSystemEvent(user.id, "activity_log.pruned", {
            deletedCount: deleted,
            reason: "free_plan_global_feed_clear",
          });
        }
        continue;
      }

      // Pro (90 days) or Family (365 days): delete events older than retentionDays.
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);

      const deleted = await pruneEventsOlderThan(user.id, cutoff);
      if (deleted > 0) {
        result.prunedUsers++;
        result.totalEventsDeleted += deleted;
        await emitSystemEvent(user.id, "activity_log.pruned", {
          deletedCount: deleted,
          cutoffDate: cutoff.toISOString(),
          retentionDays,
        });
      }
    } catch (error) {
      result.errors.push({
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  result.completedAt = new Date();
  return result;
};
```

### 4. resolveRetentionDaysForUser

This function resolves the effective `activityLogRetentionDays` for a user, considering group membership:

```typescript
const resolveRetentionDaysForUser = async (userId: string): Promise<number | null> => {
  // First: check for own active subscription
  const ownSub = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
    },
    orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
    select: { activityLogRetentionDays: true },
    take: 1,
  });

  if (ownSub) {
    return ownSub.activityLogRetentionDays ?? 0; // null from DB = not yet set, treat as Free
  }

  // Second: check for group membership
  const membership = await db.groupMember.findFirst({
    where: {
      userId,
      inviteStatus: "ACCEPTED",
    },
    select: {
      group: {
        select: {
          subscription: {
            select: { activityLogRetentionDays: true },
          },
        },
      },
    },
  });

  if (membership?.group?.subscription) {
    return membership.group.subscription.activityLogRetentionDays ?? 0;
  }

  // No subscription and no group membership: Free defaults
  return 0;
};
```

### 5. Prune helper functions

```typescript
/** Delete all ActivityEvent rows for a user that are not linked to a contactId
 *  (global feed events). Per-contact events are kept. */
const pruneGlobalFeedEvents = async (userId: string): Promise<number> => {
  const { count } = await db.activityEvent.deleteMany({
    where: {
      userId,
      contactId: null, // global feed events have no contact association
      source: { not: "SYSTEM" }, // keep SYSTEM events (e.g., pruning records themselves)
    },
  });
  return count;
};

/** Delete all ActivityEvent rows for a user that are older than the cutoff date.
 *  Never deletes SYSTEM events (they are the audit trail for the job itself). */
const pruneEventsOlderThan = async (userId: string, cutoff: Date): Promise<number> => {
  const { count } = await db.activityEvent.deleteMany({
    where: {
      userId,
      createdAt: { lt: cutoff },
      source: { not: "SYSTEM" },
    },
  });
  return count;
};
```

### 6. Per-contact history query-time limit for Free users

This is not a deletion operation — it is a change to the query that loads per-contact activity history in the contact detail view. The relevant server action or route handler (wherever `activityEvent.findMany({ where: { contactId } })` is called) must apply a plan-aware limit:

```typescript
const perContactEvents = await db.activityEvent.findMany({
  where: { contactId, userId },
  orderBy: { createdAt: "desc" },
  // Apply per-contact limit for Free users. For Pro+, no limit (take: undefined).
  ...(billingContext.entitlements.activityLogRetentionDays === 0
    ? { take: 10 }
    : {}),
});
```

This change must be made in the server action that loads contact detail data. It is not part of the nightly job. It is documented here because P11-01 describes it as a retention behavior and this ticket is the implementation owner.

### 7. emitSystemEvent helper

```typescript
const emitSystemEvent = async (
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  await db.activityEvent.create({
    data: {
      userId,
      eventType,
      source: "SYSTEM",
      contactId: null,
      payload,
    },
  });
};
```

SYSTEM events are always written regardless of the user's retention policy. They are explicitly excluded from the delete queries by the `source: { not: "SYSTEM" }` condition. This means SYSTEM events accumulate indefinitely. A separate operational job to clean up very old SYSTEM events (e.g., older than 2 years) should be added to `BILLING_OPERATIONAL_JOBS` as a note — it is not in scope for Phase 11.

### 8. Job invocation endpoint

The job must be callable by an external scheduler. Create a Next.js API route (or equivalent) at:

```
src/app/api/jobs/activity-log-retention/route.ts
```

The endpoint must:
1. Validate the request comes from the job scheduler (not from arbitrary HTTP traffic). Use a `CRON_SECRET` environment variable (already used in many Next.js cron patterns). Check the `Authorization: Bearer <secret>` header.
2. Call `runActivityLogRetentionJob()`.
3. Return the `RetentionJobResult` as JSON.
4. Return HTTP 200 on success, HTTP 500 on uncaught error.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { runActivityLogRetentionJob } from "~/jobs/activity-log-retention";

export const maxDuration = 300; // 5 minutes — adjust for expected user count

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runActivityLogRetentionJob();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Note on Vercel Cron:** If the app runs on Vercel, a `vercel.json` cron configuration must be added to invoke this endpoint nightly:

```json
{
  "crons": [
    {
      "path": "/api/jobs/activity-log-retention",
      "schedule": "0 2 * * *"
    }
  ]
}
```

The schedule `0 2 * * *` means 2:00 AM UTC daily. Choose a low-traffic time for the deployment timezone.

**Note on Vercel Cron authentication:** Vercel Cron requests include a `x-vercel-signature` header in some configurations. The current implementation uses a simpler `CRON_SECRET` header approach which is compatible with any scheduler (Vercel Cron, GitHub Actions, Inngest, etc.).

### 9. Downgrade timing: pruning on next run, not immediately

P11-01 specifies: "Users who downgrade: prune on next job run after downgrade confirmed, not immediately."

The retention job already handles this naturally — it reads the current `activityLogRetentionDays` from the database at job run time. When a user downgrades (Stripe webhook fires, subscription row updated), the `activityLogRetentionDays` field on their subscription is updated to the new tier's value. The next nightly run reads this value and prunes accordingly.

No special "downgrade flag" is needed. The nightly job is the prune authority.

However, there is an edge case: a user who upgrades from Pro to a higher plan (Pro → Family or Pro → Teams) should have their events preserved even if the nightly job runs between the upgrade moment and the next day. This is handled correctly because the job reads the current subscription (the upgraded one) at run time — events will not be pruned.

### 10. Batch size and performance

For large installations with many users, processing all users in a single job run could be slow or cause memory pressure. Add a batch size limit:

```typescript
// Process users in batches of 500
const BATCH_SIZE = 500;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const batch = await db.user.findMany({
    select: { id: true, lifecycleState: true },
    where: { lifecycleState: { not: "LOCKED" } },
    skip: offset,
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" }, // consistent ordering for pagination
  });

  if (batch.length < BATCH_SIZE) {
    hasMore = false;
  }

  for (const user of batch) {
    // ... process user ...
  }

  offset += batch.length;
}
```

For Phase 11 with a small user base, a single query is acceptable. Add the batching pattern from the start so it is ready for growth.

### 11. deleteMany performance

`db.activityEvent.deleteMany` with a date filter and user ID will use the `@@index([userId, createdAt])` index defined in section 1. Ensure this index is present — without it, the delete becomes a sequential scan per user.

For very large event tables in the future, consider batching the deletes within a single user's operation too (e.g., delete 1000 events at a time in a loop) to avoid long-running transactions. For Phase 11, a single `deleteMany` per user is sufficient.

### 12. Monitoring and alerting

The job returns a `RetentionJobResult` with an `errors` array. After the job completes:
- If `errors.length > 0`, the HTTP response still returns 200 but includes the errors in the JSON body.
- The calling scheduler should inspect the response body for errors and trigger an alert (email, Slack, etc.) if any user-level errors occurred.
- The SYSTEM ActivityEvent written after each user's pruning provides a per-user record in the database that can be queried for operational visibility.

A future observability enhancement (out of scope for Phase 11) would be to emit a structured log line or metric per job run for monitoring dashboards.

### 13. Testing the job

Unit tests should cover:

1. **Free user with global feed events**: run job, confirm global feed events (contactId = null) are deleted, confirm per-contact events remain.
2. **Pro user with events spanning 90 days**: run job, confirm events older than 90 days are deleted, events within 90 days remain.
3. **Family user with events spanning 365 days**: run job, confirm events older than 365 days are deleted, events within 365 days remain.
4. **Teams user**: run job, confirm zero deletions.
5. **User with no subscription**: treated as Free, same as case 1.
6. **Group member**: resolves retention from group owner's subscription, correct retention applied.
7. **Error in one user does not abort processing for subsequent users**: mock a DB error for user N, confirm users N+1, N+2, etc. are still processed.
8. **SYSTEM events are never deleted**: create a SYSTEM event older than the retention window, run job, confirm it remains.
9. **Idempotency**: run job twice in the same day, confirm second run deletes zero events (since events in the first run were already deleted and no new old events exist).
10. **Per-contact query-time limit**: the contact detail server action returns at most 10 events for a Free user even if more than 10 events exist for that contact.

Integration tests:
- Deploy the job endpoint locally, call it via HTTP with a valid `CRON_SECRET`, confirm the JSON response matches the expected shape.

---

## Acceptance Criteria
- `ActivityEvent` model (or equivalent) exists in the Prisma schema with `id`, `userId`, `contactId` (nullable), `eventType`, `source`, `payload`, `createdAt` and the indexes specified.
- `src/jobs/activity-log-retention.ts` exports `runActivityLogRetentionJob` and returns a `RetentionJobResult`.
- Free users: after job run, all global feed events (contactId = null) are deleted. Per-contact events remain.
- Pro users: after job run, all events with `createdAt < (now - 90 days)` are deleted. Events within 90 days remain.
- Family users: after job run, all events with `createdAt < (now - 365 days)` are deleted. Events within 365 days remain.
- Teams users: job skips them entirely. Zero deletions.
- SYSTEM-source events are never deleted by the pruning queries.
- Each pruning run emits a SYSTEM ActivityEvent with the count of deleted events.
- A failure for one user (e.g., DB timeout) does not abort the job for subsequent users. The error is captured in the result's `errors` array.
- The job endpoint at `/api/jobs/activity-log-retention` returns 401 without a valid `CRON_SECRET`, 200 on success, 500 on uncaught error.
- The per-contact query-time limit is applied in the contact detail server action: Free users see at most 10 events per contact.
- All 10 unit test cases described in section 13 pass.

## Risks and Open Questions
- If the `ActivityEvent` model does not yet exist in the schema, this ticket includes a schema migration. Confirm the model's existence and current naming before beginning implementation to avoid a redundant migration.
- The `resolveRetentionDaysForUser` function performs two DB queries per user (own subscription check, then group membership check). For a large user base, this is `2N` queries per job run. A single JOIN query that resolves both in one round-trip would be more efficient at scale. For Phase 11, two queries per user is acceptable.
- Vercel Cron has a 10-second maximum invocation time on hobby plans. If the user base grows, the job may time out. Ensure the deployment uses a plan with sufficient execution time (`maxDuration: 300` as set in the route) or consider moving the job to an external scheduler (Inngest, Trigger.dev, GitHub Actions) before the user base grows to a point where the job approaches that limit.
- The retention job must not delete events that are currently being referenced by another operation (e.g., an in-flight activity log export). Prisma's `deleteMany` does not use row locks, but because activity events are not FKed from other tables (they are leaf nodes), this is not a practical risk in Phase 11.
- SYSTEM events accumulating without bound will eventually be a table bloat issue. The technical debt of cleaning up old SYSTEM events (older than 2 years, say) should be noted in `BILLING_OPERATIONAL_JOBS` in `billing.ts`.
- Group shared address book events (Phase 13/14) will need their own retention logic. The job is designed with extension in mind (per-user loop with a separate resolver function) so adding a group log pruning pass in Phase 13/14 should be straightforward.

## Outcome
A nightly background job enforces the activity log retention policy for all users, prunes event rows per plan tier, records its actions as auditable SYSTEM events, and handles errors gracefully without interrupting other users' pruning runs.
