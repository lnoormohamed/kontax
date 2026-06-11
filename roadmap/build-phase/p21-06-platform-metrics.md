# P21-06 — Platform Metrics Overview

## Purpose

Give internal operators a live view of platform health: how many users, what plan distribution, how active the product is, and whether anything is broken. Without this, operational questions ("how many Pro users do we have?") require manual database queries.

## Scope

**In scope:**
- `/admin/metrics` page with live counts
- User metrics: total users, by plan, by lifecycle state, new signups (7d, 30d)
- Activity metrics: DAU, MAU (approximated from `UserSession.lastActiveAt`)
- Import/sync metrics: import jobs last 24h (success/failed), sync job error rate
- Stripe metrics: MRR approximation (count × plan price), recent subscription events

---

## Design / Implementation Spec

### Metric queries

All queries run server-side on page load. No caching in v1 — these are admin pages with low traffic. Add caching (30-second revalidation) if page loads become slow.

```typescript
// User counts by plan
const planBreakdown = await db.subscription.groupBy({
  by: ["plan"],
  where: { status: { in: ["ACTIVE", "TRIALING"] } },
  _count: { plan: true },
});

// New signups
const newSignups7d = await db.user.count({
  where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
});

// DAU — users with a session active in the last 24h
const dau = await db.userSession.groupBy({
  by: ["userId"],
  where: {
    lastActiveAt: { gte: new Date(Date.now() - 86400000) },
    revokedAt: null,
  },
  _count: { userId: true },
}).then((r) => r.length);

// Import job error rate (last 24h)
const importJobs24h = await db.importJob.groupBy({
  by: ["status"],
  where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
  _count: { status: true },
});

// Sync job error rate (last 24h)
const syncJobErrors = await db.syncJob.count({
  where: {
    status: { in: ["FAILED"] },
    createdAt: { gte: new Date(Date.now() - 86400000) },
  },
});
```

### Metrics page layout

```
Platform Metrics                    Last updated: just now  [Refresh]

Users
────────────────────────────────────
Total users          1,247
  Free                 891  (71%)
  Pro                  298  (24%)
  Family                43   (3%)
  Teams                 15   (1%)

New signups (7 days)   42
New signups (30 days) 138

Activity
────────────────────────────────────
DAU (last 24h)          87
MAU (last 30d)         412

Imports (last 24h)
  Completed             23
  Failed                 2   ⚠

Sync jobs (last 24h)
  Succeeded            156
  Failed                 4   ⚠

Stripe (approx.)
────────────────────────────────────
MRR                  £2,984
```

The `⚠` indicators appear when the failure rate exceeds 5%. They are links to a filtered view of the affected jobs.

---

## Acceptance Criteria

- `/admin/metrics` renders with live counts from the database.
- Plan breakdown shows count and percentage for each tier.
- DAU and MAU are computed from `UserSession.lastActiveAt`.
- Import and sync error rates show a warning indicator when failure rate > 5%.
- The page renders within 3 seconds (add DB indexes if needed).
- `USER_VIEWED` is not emitted for the metrics page — it is a summary, not a user-specific action.
