# P28-02 — Smart List Schema

## Purpose

Define the `SavedFilter` Prisma model that persists smart list data: name, serialised filter state, sort order, and usage tracking. This is the data layer that P28-01 (UI) reads from and writes to.

## Background

The contacts list filter state is currently ephemeral — encoded in URL params and lost on navigation. `SavedFilter` makes it persistent and user-owned. The `filterState` JSON stores the exact URL param object that the contacts list uses, ensuring perfect round-trip fidelity.

## Scope

**In scope:**
- `SavedFilter` Prisma model with all required fields
- Index for efficient per-user listing
- Seed a default "Favourites" smart list for all users (a convenience alias for the existing favourites filter)
- `createSavedFilter`, `updateSavedFilter`, `deleteSavedFilter`, `reorderSavedFilters` server actions

**Out of scope:**
- Smart list UI (P28-01)
- Shared smart lists between users (personal only)

---

## Design / Implementation Spec

### `SavedFilter` model

```prisma
model SavedFilter {
    id          String   @id @default(cuid())
    userId      String
    name        String
    filterState Json     // Serialised ContactFilterState
    sortOrder   Int      @default(0)
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    lastUsedAt  DateTime?
    usageCount  Int      @default(0)

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, sortOrder])
}
```

Run: `prisma migrate dev --name add-saved-filter`

### `ContactFilterState` type

The JSON stored in `filterState` is a serialised version of the URL filter params:

```typescript
interface ContactFilterState {
  q?: string;           // search query
  favourites?: boolean;
  tags?: string[];
  city?: string;
  company?: string;
  sourceType?: string;
  hasPhone?: boolean;
  hasEmail?: boolean;
  bookId?: string;
  // ...extensible — new filters added to the URL are automatically captured
}
```

### Server actions

```typescript
export async function createSavedFilter(input: {
  name: string;
  filterState: ContactFilterState;
}): Promise<SavedFilter> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const maxOrder = await db.savedFilter.aggregate({
    where: { userId: session.user.id },
    _max: { sortOrder: true },
  });

  return db.savedFilter.create({
    data: {
      userId: session.user.id,
      name: input.name.trim(),
      filterState: input.filterState,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
}

export async function updateSavedFilter(input: {
  id: string;
  name?: string;
  filterState?: ContactFilterState;
}): Promise<void> {
  const session = await auth();
  await db.savedFilter.update({
    where: { id: input.id, userId: session!.user!.id },
    data: {
      ...(input.name && { name: input.name.trim() }),
      ...(input.filterState && { filterState: input.filterState }),
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  });
}

export async function deleteSavedFilter(id: string): Promise<void> {
  const session = await auth();
  await db.savedFilter.delete({ where: { id, userId: session!.user!.id } });
}

export async function reorderSavedFilters(
  orderedIds: string[],
): Promise<void> {
  const session = await auth();
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.savedFilter.update({
        where: { id, userId: session!.user!.id },
        data: { sortOrder: index },
      }),
    ),
  );
}
```

### Seed default "Favourites" list

For existing users (and new users in the register action), create a default "Favourites" smart list:

```typescript
await db.savedFilter.create({
  data: {
    userId,
    name: "Favourites",
    filterState: { favourites: true },
    sortOrder: 0,
  },
});
```

This is a convenience — it mirrors the existing "Favourites" tab but allows customisation (the user can rename or delete it).

---

## Acceptance Criteria

- `SavedFilter` model exists; migration applied.
- `createSavedFilter` creates a row and assigns the next `sortOrder`.
- `updateSavedFilter` updates name and/or filterState; increments `usageCount`.
- `deleteSavedFilter` removes the row (ownership verified via `userId`).
- `reorderSavedFilters` updates `sortOrder` for all IDs in the provided order in a transaction.
- All existing users and new users have a default "Favourites" saved filter seeded.
- `filterState` stores a JSON object; no schema enforcement beyond valid JSON (extensible).
