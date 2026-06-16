# P34F-07 — Family Copy-on-Leave

## Purpose

When a member *leaves* a Family group (not just on full dissolution), give them a
private snapshot copy of the family book — matching the principle that family books are
jointly held and members keep what they had. Today `leaveFamilyGroup` only deletes the
membership row; the leaver loses all shared contacts. This ticket snapshots the book
into a personal `AddressBook` before removing the membership.

Independent of the billing re-anchor (P34F-01..06) — can ship in parallel.

## Background

- `leaveFamilyGroup` (`src/app/actions/family.ts:452`) currently only does
  `db.groupMember.delete(...)` then revalidates — no snapshot.
- The *dissolution* path (Phase 13 / `roadmap/build-phase/p18-11-personal-address-books.md:227`)
  defines the snapshot pattern: create a personal `AddressBook` with `sourceGroupBookId`,
  copy the shared contacts in, suffix slug collisions.
- The copy mechanics already exist in `addContactToFamilyBook` (`family.ts:279`):
  `COPY_SELECT` (the full field list, `family.ts:245`–`272`) and the `tx.contact.create`
  shape (`family.ts:324`). Reuse the same field set so leave-copies are faithful.
- The family book id: `Group.defaultAddressBookId` (set at `family.ts:83`,
  `schema.prisma:966`); also surfaced as `membership.bookId` via
  `getUserFamilyMembership` (`src/server/family-access.ts`).
- Slug uniqueness is enforced by `@@unique([userId, slug])` on `AddressBook`
  (`schema.prisma:1058`).

Distinction to preserve: **leave** = one member → one personal copy; **dissolution** =
whole group → a copy for every member. Both must call one shared snapshot helper.

## Scope

**In scope:**
- `snapshotFamilyBookForUser(tx, args)` helper (new, `src/server/family-snapshot.ts`).
- `uniqueBookSlug(tx, userId, base)` collision-suffix helper.
- `leaveFamilyGroup` calls the helper in a transaction, then deletes membership.
- The dissolution path (where built) reuses the same helper per member.
- Leave confirmation copy update (coordinate with P34F-08).

**Out of scope:**
- Teams leave (`leaveTeam`, `teams.ts:597`) — team books are org-owned; **no copy**;
  explicitly unchanged.
- Re-promotion on re-subscribe (Phase 13 / p18-11 already specs it; `sourceGroupBookId`
  is set here so that flow can find these contacts).

## Design / Implementation Spec

### Shared snapshot helper

```typescript
// src/server/family-snapshot.ts
import type { Prisma } from "../../generated/prisma";
import { slugify } from "~/lib/slug"; // confirm the existing slugify util path

type Tx = Prisma.TransactionClient;

// Same field set as addContactToFamilyBook's COPY_SELECT (family.ts:245).
const COPY_SELECT = {
  fullName: true, firstName: true, middleName: true, lastName: true,
  phoneticFirstName: true, phoneticLastName: true, namePrefix: true, nameSuffix: true,
  nickname: true, email: true, emailEntries: true, phone: true, phoneEntries: true,
  company: true, phoneticCompany: true, jobTitle: true, department: true,
  website: true, websiteEntries: true, birthday: true, address: true, addressEntries: true,
  significantDates: true, relatedPeople: true, customFields: true, notes: true,
} as const;

async function uniqueBookSlug(tx: Tx, userId: string, base: string): Promise<string> {
  const root = slugify(base) || "family";
  let slug = root;
  for (let i = 2; ; i++) {
    const clash = await tx.addressBook.findUnique({
      where: { userId_slug: { userId, slug } },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${root}-${i}`;
  }
}

export async function snapshotFamilyBookForUser(
  tx: Tx,
  args: { groupId: string; bookId: string; targetUserId: string; groupName: string },
): Promise<string /* personal AddressBook id */> {
  const slug = await uniqueBookSlug(tx, args.targetUserId, args.groupName);
  const personalBook = await tx.addressBook.create({
    data: {
      userId: args.targetUserId,
      name: args.groupName,
      slug,
      isDefault: false,
      sourceGroupBookId: args.bookId,
    },
  });

  const shared = await tx.groupContact.findMany({
    where: { groupAddressBookId: args.bookId },
    select: { contact: { select: COPY_SELECT } },
  });

  for (const { contact } of shared) {
    await tx.contact.create({
      data: { userId: args.targetUserId, bookId: personalBook.id, ...contact },
    });
  }
  return personalBook.id;
}
```

(`...contact` spreads the `COPY_SELECT` fields directly; JSON fields like
`emailEntries` pass through as-is, matching `addContactToFamilyBook`. If the create
needs the `jsonOrUndef` coercion used at `family.ts:274`, apply it identically.)

### `leaveFamilyGroup` update

**Before** (`family.ts:452`): finds the member, rejects owner, deletes the member,
revalidates.

**After:**
```typescript
export const leaveFamilyGroup = async (formData: FormData) => {
  const userId = await requireUserId();
  const groupId = str(formData, "groupId");

  const member = await db.groupMember.findFirst({
    where: { groupId, userId, inviteStatus: "ACCEPTED" },
    select: { id: true, role: true },
  });
  if (!member) throw new Error("You're not a member of that group.");
  if (member.role === "OWNER") {
    throw new Error("The owner can't leave. Transfer ownership or delete the group.");
  }

  const group = await db.group.findUnique({
    where: { id: groupId },
    select: { name: true, type: true, defaultAddressBookId: true },
  });
  if (group?.type !== "FAMILY") throw new Error("Not a family group."); // teams → leaveTeam

  await db.$transaction(async (tx) => {
    if (group.defaultAddressBookId) {
      await snapshotFamilyBookForUser(tx, {
        groupId,
        bookId: group.defaultAddressBookId,
        targetUserId: userId,
        groupName: group.name,
      });
    }
    await tx.groupMember.delete({ where: { id: member.id } });
  });

  revalidatePath("/contacts");
  revalidatePath("/settings/family");
};
```

### Dissolution reuse

Where the Phase 13 dissolution flow exists (or when built), iterate members and call
`snapshotFamilyBookForUser` per member, then archive/clear the group book — instead of
duplicating copy logic. Set `groupAddressBook.dissolvedToBookId` on the owner's copy
per p18-11 (`:244`).

### UI

Update the Leave confirmation (P34F-08 owns the final copy): *"Leave {family}? A
private copy of the family contacts will be saved to your account."*

## Acceptance Criteria

- Leaving a Family group creates a personal `AddressBook` named after the group, with
  `sourceGroupBookId` set, containing a faithful copy (COPY_SELECT fields) of every
  shared contact.
- Slug collisions are suffixed (`smith-family`, `smith-family-2`, …); no
  `@@unique([userId, slug])` violation.
- The operation is transactional — membership is deleted only after the snapshot
  succeeds; a failure rolls back both.
- Leaving a family group with an empty book (no contacts) still succeeds (creates an
  empty personal book or skips per decision below).
- Teams `leaveTeam` is unchanged (no copy — org-owned).
- Owner still cannot leave (must transfer/dissolve).
- Unit tests: field fidelity vs `addContactToFamilyBook`, slug collision, transactional
  rollback on injected failure, empty-book leave.

## Risks and Open Questions

- **Empty book.** Decide whether to create an empty personal book or skip the snapshot
  when the family book has zero contacts. Recommend: skip creation if empty (nothing to
  keep) but still allow the leave.
- **Large family books.** Family caps at 6 members (`schema.prisma:965`) so books are
  small; the per-contact create loop is fine. If books grow later, batch inserts.
- **`slugify` util location.** Confirm the existing slugify helper path used elsewhere
  (CardDAV slugs, p18-11) and import it rather than re-implementing.
- **Dissolution flow status.** If Phase 13 dissolution isn't built yet, this ticket
  lands the reusable helper; dissolution must adopt it rather than duplicating.
- **JSON field coercion.** Match `addContactToFamilyBook` exactly (`jsonOrUndef` at
  `family.ts:274`) so JSON columns (`emailEntries`, `addressEntries`, etc.) copy
  identically.
