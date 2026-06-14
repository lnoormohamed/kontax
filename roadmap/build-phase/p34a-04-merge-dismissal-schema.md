# P34A-04 — MergeDismissal Schema and Server Action

## Purpose

Persist "Not a duplicate" dismissals per user so that once a user dismisses
a merge suggestion pair, it is never re-surfaced — even if the duplicate
detection job re-runs and would otherwise re-generate it.

## Background

The merge suggestion list at `/?tab=duplicates` currently surfaces the same
pairs repeatedly after each refresh. The dismiss button on
`/merge-suggestions/[id]` sets the suggestion status to `DISMISSED`, which
hides it from the open queue — but only as long as that `MergeSuggestion`
row exists. If the job re-runs and generates a new suggestion for the same
pair, it re-appears.

A separate `MergeDismissal` table keyed to `(userId, contactAId, contactBId)`
is the right fix: the job can check this table and skip already-dismissed
pairs regardless of whether a `MergeSuggestion` row exists.

## Scope

**In scope**
- Add `MergeDismissal` model to `prisma/schema.prisma`.
- Add the corresponding `User` and `Contact` relations (`dismissals` back-ref
  on `User`; `dismissalsAsA` and `dismissalsAsB` on `Contact`).
- Run `prisma db push` (as per the project's no-migrations policy).
- Add `dismissMergeSuggestion(contactAId: string, contactBId: string)` server
  action, callable from the "Not a duplicate" button.

**Out of scope**
- Wiring the dismissal into the duplicate query (P34A-05).
- UI changes to the button itself (it already exists; this ticket only adds
  the backend).

## Design / Implementation Spec

### Prisma model

Add to `prisma/schema.prisma` in the merge-related section (after the
`MergeSuggestion` model):

```prisma
model MergeDismissal {
  id          String   @id @default(cuid())
  userId      String
  contactAId  String
  contactBId  String
  dismissedAt DateTime @default(now())

  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  contact_a Contact @relation("DismissalA", fields: [contactAId], references: [id], onDelete: Cascade)
  contact_b Contact @relation("DismissalB", fields: [contactBId], references: [id], onDelete: Cascade)

  @@unique([userId, contactAId, contactBId])
  @@index([userId])
}
```

Add back-relations to the existing models:
```prisma
// On User model:
dismissals MergeDismissal[]

// On Contact model:
dismissalsAsA MergeDismissal[] @relation("DismissalA")
dismissalsAsB MergeDismissal[] @relation("DismissalB")
```

### ID normalisation

The `@@unique` constraint covers `(userId, contactAId, contactBId)`. Because
two contacts A and B could be stored as (A, B) or (B, A), the server action
must **normalise the order** before inserting:

```ts
// Always store the lexicographically smaller id as contactAId.
const [aId, bId] = [contactAId, contactBId].sort();
```

This means a single `@@unique` is sufficient — no need for a second row with
the reversed order.

### Server action

Location: `src/app/actions/contacts.ts` (existing) or a new file
`src/app/actions/merge.ts` if the contacts actions file is already large.

```ts
"use server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function dismissMergeSuggestion(
  contactAId: string,
  contactBId: string,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const userId = session.user.id;
  const [aId, bId] = [contactAId, contactBId].sort();

  await db.mergeDismissal.upsert({
    where: { userId_contactAId_contactBId: { userId, contactAId: aId, contactBId: bId } },
    update: { dismissedAt: new Date() },
    create: { userId, contactAId: aId, contactBId: bId },
  });
}
```

Using `upsert` prevents a unique-constraint error if the user dismisses the
same pair twice (e.g. via a double-tap on mobile).

### Calling from existing dismiss button

`src/app/_components/merge-suggestion-dismiss-button.tsx` (or
`merge-actions.tsx`) currently calls the DISMISSED status update on
`MergeSuggestion`. After this ticket:
1. Also call `dismissMergeSuggestion(contactAId, contactBId)`.
2. Both operations can run in parallel (`Promise.all`).

The button must receive both `contactAId` and `contactBId` as props. The
merge suggestion review page (`merge-suggestions/[id]/page.tsx`) already
has both IDs in the suggestion data — pass them through.

## Acceptance Criteria

- [ ] `prisma/schema.prisma` contains the `MergeDismissal` model with the
      exact fields and constraints above.
- [ ] `prisma db push` completes without error.
- [ ] `dismissMergeSuggestion` server action is callable and creates a row in
      `MergeDismissal`.
- [ ] Calling it twice for the same pair does not throw (upsert).
- [ ] ID normalisation ensures (A, B) and (B, A) produce the same row.
- [ ] `MergeSuggestionDismissButton` passes contactAId and contactBId and
      calls the new action alongside the existing status update.
- [ ] `tsc --noEmit` passes; no Prisma client type errors.

## Risks / Open Questions

- Confirm the Prisma `onDelete: Cascade` on both Contact relations is
  acceptable — if a contact is hard-deleted, its dismissal rows are also
  deleted. This is the desired behaviour (the pair can't be re-suggested if a
  contact no longer exists).
- If `MergeSuggestion` already stores `contactAId` / `contactBId` (check the
  current schema), confirm the field names match what the dismiss button
  receives.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: document MergeDismissal and ID
      normalisation rule in the merge-suggestions concept doc
