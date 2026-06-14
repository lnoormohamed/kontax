# P34B-01 — User preferences schema & helpers

## Purpose

Add a `preferences` JSON column to the `User` model, define the TypeScript
type contract, and provide server-side helpers (`getPreferences`,
`updatePreferences`) plus a NextAuth session callback so that every
authenticated request has `session.user.preferences` populated.

## Background

Today every user gets hardcoded defaults for sort order, view mode, date
format, name display, and week start. There is no persistence layer for
personal UI choices. A single `Json` column is the simplest model that allows
new preference keys to be added in future phases without schema migrations.
The TypeScript type acts as the schema contract; `DEFAULT_PREFERENCES` fills
gaps when a user's stored object is missing keys.

## Scope

**In scope**
- `prisma/schema.prisma`: add `preferences Json? @default("{}")` to the `User`
  model.
- Run `prisma db push` (no migration file — consistent with project convention).
- Create `src/types/preferences.ts` (or `src/lib/preferences.ts`) with the
  `UserPreferences` type and `DEFAULT_PREFERENCES` constant.
- `getPreferences(userId: string): Promise<Required<UserPreferences>>` — reads
  `User.preferences` from the database and deep-merges with `DEFAULT_PREFERENCES`
  so callers always receive a fully-populated object.
- `updatePreferences(userId: string, patch: Partial<UserPreferences>): Promise<void>`
  — server action that shallow-merges the patch into the stored JSON and writes
  it back. Validates keys against the `UserPreferences` type at runtime (strip
  unknown keys).
- NextAuth session callback: call `getPreferences(session.user.id)` and attach
  the result to `session.user.preferences`. Extend the `Session` type in
  `next-auth.d.ts` to include `preferences: Required<UserPreferences>`.

**Out of scope**
- UI controls — see P34B-02 through P34B-07.
- Wiring preferences to contacts list or date formatting — see P34B-08 through
  P34B-10.
- Versioning or migration of old preference JSON shapes — not needed yet.

## Design / Implementation Spec

### Type definition

```typescript
// src/types/preferences.ts
export type UserPreferences = {
  defaultSort?: "name" | "updated";
  defaultViewMode?: "compact" | "cozy";
  dateFormat?: "DD MMM YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  nameDisplayOrder?: "first-last" | "last-first";
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
};

export const DEFAULT_PREFERENCES: Required<UserPreferences> = {
  defaultSort: "name",
  defaultViewMode: "compact",
  dateFormat: "DD MMM YYYY",
  nameDisplayOrder: "first-last",
  weekStartsOn: 1,
};
```

### `getPreferences`

```typescript
export async function getPreferences(userId: string): Promise<Required<UserPreferences>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const stored = (user?.preferences ?? {}) as UserPreferences;
  return { ...DEFAULT_PREFERENCES, ...stored };
}
```

### `updatePreferences`

Implement as a Next.js server action (`"use server"`). Accept a partial patch,
strip any keys not present in `UserPreferences`, merge with the current stored
value, and write back with `prisma.user.update`.

### Session callback

In `src/app/api/auth/[...nextauth]/route.ts` (or `authOptions`):
```typescript
async session({ session, token }) {
  if (session.user?.id) {
    session.user.preferences = await getPreferences(session.user.id);
  }
  return session;
}
```

Extend `next-auth.d.ts`:
```typescript
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      preferences: Required<UserPreferences>;
      // ... existing fields
    };
  }
}
```

## Acceptance Criteria
- `prisma db push` runs without errors and the `preferences` column exists on
  the `User` table as `jsonb`.
- `getPreferences(userId)` returns `DEFAULT_PREFERENCES` for a user with no
  stored preferences.
- `updatePreferences(userId, { defaultSort: "updated" })` persists only the
  patch; other keys retain their previous (or default) values.
- `session.user.preferences` is a fully-populated `Required<UserPreferences>`
  object in every authenticated server component and server action.
- TypeScript compilation passes with no `any` escapes in the new files.

## Risks / Open Questions
- The session callback adds a DB read on every session refresh. If session
  refresh frequency is high, consider caching in the JWT token instead and
  invalidating on `updatePreferences`. Evaluate after measuring; for now the
  simple approach is fine.
- `Json` Prisma type requires a cast when reading — the `as UserPreferences`
  cast is safe only because `updatePreferences` strips unknown keys on write.
  Document this assumption in code comments.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): none required for schema work
- [ ] External · developers — /developers (P29-07): none (not a public API)
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [x] Internal · engineering — docs/: note `UserPreferences` type, merge convention,
      and session callback DB read in the data-model doc
