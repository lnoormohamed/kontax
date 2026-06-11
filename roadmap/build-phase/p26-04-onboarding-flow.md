# P26-04 — Onboarding Flow

## Purpose

Show a first-run checklist card to new users after their first successful login, guiding them through four activation steps: account created (auto-complete), add first contact, connect a sync account, and explore the app. The checklist persists across sessions until dismissed or all steps are completed.

## Background

The P26-DB07 design brief specifies the checklist card in detail. This ticket implements the data model, server actions, and the React component. The checklist is the single most impactful activation lever: users who complete even one additional step beyond account creation have significantly higher 7-day retention.

The onboarding state is persisted in `UserOnboardingState` so it survives across sessions and devices.

## Scope

**In scope:**
- `UserOnboardingState` Prisma model — tracks completed steps and dismissal
- Onboarding checklist card component rendered above the contact list for new users
- Step completion triggers: add first contact (detects first `Contact` row), connect sync (first `SyncAccount` row), explore app (auto-completes after 30 seconds on the contacts page)
- `dismissOnboarding()` and `completeOnboardingStep()` server actions
- Seeded as incomplete for every new user registration

**Out of scope:**
- Family/Teams upgrade onboarding (P26-14)
- Empty states (P26-05 — separate ticket)

---

## Design / Implementation Spec

### `UserOnboardingState` model

```prisma
model UserOnboardingState {
    id                     String    @id @default(cuid())
    userId                 String    @unique
    accountCreatedAt       DateTime  @default(now())
    firstContactCreatedAt  DateTime?
    syncConnectedAt        DateTime?
    appExploredAt          DateTime?
    dismissedAt            DateTime?
    completedAt            DateTime? // set when all steps done
    createdAt              DateTime  @default(now())

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Run: `prisma migrate dev --name add-user-onboarding-state`

Seed on user creation (in the register server action, after user creation):
```typescript
await db.userOnboardingState.create({
  data: { userId: user.id },
});
```

### Step completion triggers

**Step 2 — Add first contact:** in the `createContact` server action, after the first contact is created:
```typescript
await db.userOnboardingState.updateMany({
  where: { userId, firstContactCreatedAt: null },
  data: { firstContactCreatedAt: new Date() },
});
```

**Step 3 — Connect sync:** in `createSyncAccount`, after the first sync account is created:
```typescript
await db.userOnboardingState.updateMany({
  where: { userId, syncConnectedAt: null },
  data: { syncConnectedAt: new Date() },
});
```

**Step 4 — Explore app:** auto-completes after the user has been on the contacts page for 30 seconds. Implemented client-side:
```typescript
// In the contacts page layout:
useEffect(() => {
  if (!onboarding?.appExploredAt) {
    const timer = setTimeout(() => {
      completeOnboardingStep("appExplored");
    }, 30_000);
    return () => clearTimeout(timer);
  }
}, [onboarding?.appExploredAt]);
```

### Onboarding checklist card component

`src/app/contacts/_components/onboarding-checklist.tsx`:

```tsx
// Rendered above the contact list only when:
// - UserOnboardingState.dismissedAt is null
// - UserOnboardingState.completedAt is null (or < 5s ago for completion animation)

const steps = [
  { key: "account", label: "Create your account", completedAt: onboarding.accountCreatedAt, cta: null },
  { key: "contact", label: "Add your first contact", completedAt: onboarding.firstContactCreatedAt, cta: { label: "Add contact", href: "/contacts/new" } },
  { key: "sync", label: "Connect a sync account", completedAt: onboarding.syncConnectedAt, cta: { label: "Connect device", href: "/sync" } },
  { key: "explore", label: "Explore your contacts", completedAt: onboarding.appExploredAt, cta: null }, // auto-completes
];

const completedCount = steps.filter((s) => !!s.completedAt).length;
const progressPct = (completedCount / steps.length) * 100;
```

Progress bar fill: `width: ${progressPct}%`, `transition: width 600ms ease`, `background: #17352e`.

Completion state: when `completedCount === 4`, replace checklist with "✓ You're all set!" card. Auto-dismiss after 5 seconds. Set `UserOnboardingState.completedAt`.

### Server actions

```typescript
export async function dismissOnboarding(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.userOnboardingState.update({
    where: { userId: session.user.id },
    data: { dismissedAt: new Date() },
  });
}

export async function completeOnboardingStep(
  step: "firstContact" | "syncConnected" | "appExplored",
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  const fieldMap = {
    firstContact: "firstContactCreatedAt",
    syncConnected: "syncConnectedAt",
    appExplored: "appExploredAt",
  } as const;
  await db.userOnboardingState.updateMany({
    where: { userId: session.user.id, [fieldMap[step]]: null },
    data: { [fieldMap[step]]: new Date() },
  });
}
```

---

## Acceptance Criteria

- `UserOnboardingState` is created for every new user at registration.
- The checklist card renders above the contact list for users with incomplete, non-dismissed onboarding state.
- Step 1 (account created) is always pre-checked.
- Step 2 (add contact) auto-checks when the user creates their first contact.
- Step 3 (connect sync) auto-checks when the user connects their first sync account.
- Step 4 (explore) auto-checks after 30 seconds on the contacts page.
- The progress bar fills as steps are completed.
- Dismissing the card sets `dismissedAt` and hides the card permanently.
- Completing all steps shows the "You're all set!" completion card, then auto-dismisses.
- The checklist is never shown to users who registered before this feature shipped (seed `dismissedAt = now()` for existing users in a migration).

---

## Risks and Open Questions

- **Existing users migration:** users who registered before P26-04 ships should not see the onboarding checklist. In the migration, backfill `UserOnboardingState` rows for all existing users with `dismissedAt = now()` (treating them as already onboarded).
- **Step 4 "explore" auto-completion in background tabs:** `setTimeout` in a background tab may be throttled by the browser. If the tab is backgrounded, the 30-second timer may not fire. This is acceptable — the step is the lowest-priority and will complete on their next foreground visit.
