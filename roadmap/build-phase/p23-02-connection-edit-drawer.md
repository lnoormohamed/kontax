# P23-02 — Connection Edit Drawer

## Purpose

Give users a settings panel for each sync connection — accessible via a gear icon on the connection card — where they can adjust sync direction, conflict policy, and book allowlist without going through the initial connect flow. The initial connect flow stays simple (credentials → connect → done). Advanced settings are a return visit for users who want to tune behaviour.

## Background

The sync connections page (design brief `07-sync-connections.md`) shows a detail panel per connection with action buttons. Currently, "Edit credentials" is the only configurable surface. This ticket adds a **Settings** section below the credential form in the same detail panel, writing to `SyncAccountSettings` (P23-01). The approach decision from the roadmap: settings live on the connection edit panel, not in the create flow.

## Scope

**In scope:**
- Gear icon (⚙) on each connection card in the left column — opens the settings section in the right detail panel
- Settings section within the account detail panel: sync direction, conflict policy, sync frequency override
- `updateSyncAccountSettings(syncAccountId, patch)` server action
- Optimistic UI update on save; revert on error
- Re-authentication check before save (P23-06)
- Changes logged to `ActivityEvent` (P23-06)

**Out of scope:**
- Book allowlist UI (P23-03 — rendered as a sub-section within this drawer but implemented separately)
- Conflict queue (P23-05)

---

## Design / Implementation Spec

### Gear icon placement

In the account list left column, each account row gains a gear icon on hover:

```
┌─────────────────────────────────┐
│ [☁] iCloud        ●    ⚙       │
│     2 min ago                   │
└─────────────────────────────────┘
```

The ⚙ icon is `Lucide Settings`, 14px, `color: #8b938c`. Hover on the icon: `color: #1d2823`. Click: selects the account AND scrolls the right detail panel to the settings section.

### Settings section in the detail panel

Below the action buttons and above the sync job history, a collapsible "Connection settings" section:

```
┌──────────────────────────────────────────────────────────┐
│  CONNECTION SETTINGS                              [▾]     │
│                                                          │
│  Sync direction                                          │
│  ● Two-way  ○ Import only  ○ Export only                 │
│                                                          │
│  Conflict resolution                                     │
│  ● Server wins  ○ Kontax wins  ○ Review manually         │
│                                                          │
│  Sync frequency                                          │
│  [Every 60 minutes ▾]                                    │
│                                                          │
│  Address books ›  (→ P23-03)                             │
│  All books synced                                        │
│                                                          │
│  [Save settings]                                         │
└──────────────────────────────────────────────────────────┘
```

Collapsed by default. Expanded on gear icon click.

**Sync direction** — three radio options:
- **Two-way:** contacts sync in both directions. Default.
- **Import only:** Kontax pulls from the remote but never pushes. Useful for read-only sources.
- **Export only:** Kontax pushes to the remote but ignores remote changes. Useful for backup targets.

**Conflict resolution** — three radio options:
- **Server wins:** remote changes take precedence. Safe default.
- **Kontax wins:** local Kontax changes take precedence. Use when Kontax is the master.
- **Review manually:** creates a conflict queue entry for each conflict. Review in the Conflicts section.

**Sync frequency** — dropdown: `Every 15 minutes`, `Every 30 minutes`, `Every 60 minutes` (default), `Every 6 hours`, `Manual only`. Maps to `syncFrequencyMinutes`: 15, 30, 60, 360, `null`.

**Address books** — a summary line ("All books synced" or "3 of 5 books") with a "›" disclosure that expands into the P23-03 book allowlist UI.

### `updateSyncAccountSettings` server action

```typescript
export async function updateSyncAccountSettings(input: {
  syncAccountId: string;
  syncDirection?: SyncDirection;
  conflictPolicy?: ConflictPolicy;
  syncFrequencyMinutes?: number | null;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  // Verify ownership
  const account = await db.syncAccount.findUniqueOrThrow({
    where: { id: input.syncAccountId, userId: session.user.id },
  });

  await db.syncAccountSettings.upsert({
    where: { syncAccountId: input.syncAccountId },
    create: {
      syncAccountId: input.syncAccountId,
      ...input,
    },
    update: {
      ...(input.syncDirection && { syncDirection: input.syncDirection }),
      ...(input.conflictPolicy && { conflictPolicy: input.conflictPolicy }),
      ...(input.syncFrequencyMinutes !== undefined && {
        syncFrequencyMinutes: input.syncFrequencyMinutes,
      }),
    },
  });
}
```

### Re-authentication and audit logging

Before saving, check P23-06's re-auth guard. After saving, emit an `ActivityEvent` with `eventType: "SYNC_SETTINGS_CHANGED"` (or the closest existing type). See P23-06 for implementation.

---

## Acceptance Criteria

- Gear icon appears on hover on each account card in the left column.
- Clicking the gear icon expands the settings section in the right panel.
- Sync direction, conflict policy, and sync frequency controls render with the current saved values.
- Saving updates `SyncAccountSettings` via the server action; the UI reflects the saved state.
- An optimistic update shows immediately; any server error reverts the UI and shows an error toast.
- The "Address books" row links to the P23-03 allowlist sub-section.
- `EXPORT_ONLY` direction shows a warning: "Changes from the remote will be ignored. Make sure Kontax is your authoritative source."

---

## Risks and Open Questions

- **Direction change mid-sync:** if a sync job is in progress when the user changes direction from `TWO_WAY` to `IMPORT_ONLY`, the in-progress push phase should complete before the new setting takes effect. The server action should check `SyncJob.status` and warn the user if a job is running.
- **Conflict policy change with an existing manual queue:** if the user switches from `MANUAL` to `SERVER_WINS`, existing unresolved `SyncConflict` rows should be auto-resolved using server-wins. Add this cleanup step to the server action.
