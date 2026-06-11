# P21-08 — Feature Flags

## Purpose

Feature flags let engineering ship code behind a flag that is off by default, then enable it for specific users or a percentage of users without a code deploy. This is essential for safely rolling out new features, running A/B tests, and giving beta users early access to unreleased functionality.

## Scope

**In scope:**
- `FeatureFlag` Prisma model: key, `enabledForAll`, `enabledUserIds[]`, `rolloutPercent`
- `isFeatureEnabled(key, userId)` utility — called in server components and actions
- `/admin/feature-flags` page — create, toggle, edit flags
- Seeding a `FEATURES` constant listing all known flag keys

---

## Design / Implementation Spec

### Schema change

```prisma
model FeatureFlag {
    id              String   @id @default(cuid())
    key             String   @unique
    description     String?
    enabledForAll   Boolean  @default(false)
    enabledUserIds  String[] // Postgres array
    rolloutPercent  Int      @default(0) // 0-100; 0 = off, 100 = all
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt

    @@index([key])
}
```

Run: `prisma migrate dev --name add-feature-flags`

### `isFeatureEnabled`

```typescript
// src/server/feature-flags.ts

export async function isFeatureEnabled(key: string, userId: string): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({ where: { key } });
  if (!flag) return false;
  if (flag.enabledForAll) return true;
  if (flag.enabledUserIds.includes(userId)) return true;
  if (flag.rolloutPercent > 0) {
    // Deterministic percentage rollout based on userId hash
    const hash = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return (hash % 100) < flag.rolloutPercent;
  }
  return false;
}
```

### `/admin/feature-flags` page

Table of all flags:

| Key | Description | Status | Users | Rollout % | Actions |
|---|---|---|---|---|---|
| `PUBLIC_CARD` | Public contact card feature | Off | 3 specific users | 0% | Edit / Toggle |
| `GOOGLE_SYNC` | Google OAuth sync connector | On for all | — | 100% | Edit / Toggle |

**Create/edit modal:**
- Key (read-only after creation)
- Description
- Toggle: "Enabled for all" checkbox
- Specific users: comma-separated email list
- Rollout percentage: 0-100 slider

### Known flag keys

```typescript
// src/server/feature-flags.ts
export const FEATURES = {
  PUBLIC_CARD:       "PUBLIC_CARD",       // Phase 30
  GOOGLE_SYNC:       "GOOGLE_SYNC",       // Phase 27
  OUTLOOK_SYNC:      "OUTLOOK_SYNC",      // Phase 27
  API_ACCESS:        "API_ACCESS",        // Phase 29
  BIRTHDAY_REMINDERS:"BIRTHDAY_REMINDERS",// Phase 22
} as const;
```

---

## Acceptance Criteria

- `FeatureFlag` model exists; migration applied.
- `isFeatureEnabled` returns true when `enabledForAll` is true.
- `isFeatureEnabled` returns true when `userId` is in `enabledUserIds`.
- Rollout percentage uses a deterministic hash so the same user consistently gets the same result.
- `/admin/feature-flags` page lists all flags and allows creation and editing.
- `FEATURE_FLAG_CHANGED` audit event is emitted on every flag change.
