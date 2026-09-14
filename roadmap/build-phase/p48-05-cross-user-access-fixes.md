# P48-05 — Cross-user access fixes: merge suggestion, avatar delete, sync-job delete, REST `bookId`

**Phase:** 48 · **Workstream:** C · **Priority:** P0 · **Depends on:** —
**Audit severity:** High (×2) + Medium (×2)

## Objective

Close the four confirmed tenant-isolation holes. Each is a one-to-five-line
ownership check; ship together as a hotfix with regression tests.

## Context and steps

1. **Read any user's full contact via manual merge suggestions (High).**
   `src/app/actions/merge.ts:25-54 createManualMergeSuggestion(contactAId,
   contactBId)` upserts with no ownership check on either id.
   `src/server/contact-merge.ts:2028-2076 getMergeSuggestionByIdForUser`
   scopes only on `suggestion.userId` and includes both contacts with
   `mergeReviewContactSelect` (`:1990-2026`: names, emails, phones,
   addresses, birthday, avatar, labels, custom fields, notes).
   `merge-suggestions/[id]/page.tsx:78` renders it.
   → Before the upsert: `db.contact.count({ where: { id: { in: [a,b] },
   userId } }) === 2` else throw. Add `leftContact: { userId },
   rightContact: { userId }` to the `where` of `getMergeSuggestionByIdForUser`
   and `getOpenMergeSuggestionsForUser` as defence in depth. Also apply the
   P48-01 write guard (this action skips the impersonation check).
2. **Delete any user's avatar objects (High).**
   `src/app/api/upload/avatar/route.ts:60-63` passes caller-supplied
   `prevUrl` to `deleteContactPhoto` after only an origin check;
   `src/server/contact-photo-sync.ts:150-158` extracts the key with
   `/\/(avatars\/[^?]+)/` and deletes it plus the thumb.
   → In the route, resolve the key and require
   `key.startsWith(\`avatars/${session.user.id}/\`)`. Preferably also verify
   the URL is the current `avatarUrl` of a record the caller owns.
3. **Unscoped sync-job delete (Medium).** `src/app/actions/sync.ts:2133-2156
   disconnectSyncAccount` continues when the ownership lookup returns null
   (`account?.provider`) and runs `tx.syncJob.deleteMany({ where: {
   syncAccountId, status: { in: ["QUEUED","RUNNING"] } } })` with the raw form
   value. → `if (!account) return { error: "NOT_FOUND" }`; scope the delete
   with `syncAccount: { userId }`.
4. **REST API `bookId` ownership (Medium).** `src/app/api/v1/_lib/schemas.ts:26`
   only requires a cuid; `api/v1/contacts/route.ts:118-126` and
   `[id]/route.ts:83-94` write `Contact.bookId` and
   `ContactBookMembership.addressBookId` unchecked. The UI action checks
   (`actions/contacts.ts:569-581`); the API does not.
   → `db.addressBook.findFirst({ where: { id: bookId, userId, archivedAt:
   null } })` before use; 422 on miss. Return the same error shape for
   "not found" and "not yours" so book ids cannot be probed.

## Acceptance

- User B calls `createManualMergeSuggestion(bOwnContact, aContact)` → error;
  no `MergeSuggestion` row created. Existing suggestions referencing a
  contact B does not own are not returned.
- Avatar upload with `prevUrl` pointing at another user's key → the object
  remains; with the caller's own previous key → deleted as before.
- `disconnectSyncAccount` with another user's `syncAccountId` → error; their
  queued jobs untouched.
- `POST /api/v1/contacts` with another user's `bookId` → 422; the response is
  identical for a non-existent id.
- Four regression tests (P48-13 harness) covering each case with two users.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help
- [x] External · developers — /developers (`bookId` must be owned; 422 semantics)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [ ] Internal · engineering — docs/

## References

- Audit report §High "Read any user's full contact record via manual merge suggestions", "Any user can delete any other user's avatar objects"; §Medium "Unscoped sync-job delete", "REST API accepts any bookId"
