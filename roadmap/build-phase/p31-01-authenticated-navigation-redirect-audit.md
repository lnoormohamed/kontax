# P31-01 — Authenticated Navigation Redirect Audit

## Purpose

Inventory and classify every redirect that can fire for a logged-in user, then
remove the ones that bounce ordinary in-place actions to `/login` or force a full
navigation where a `revalidatePath` would do. This is the foundation ticket for
Phase 31 — P31-02/03/04 build on its classification.

## Background

Auth redirects come from three layers today:

1. **Middleware** (`src/middleware.ts`) — gates every non-public route. It already
   carries a Safari/PWA workaround: when an `authjs.session-token` cookie is
   present but the *edge* `auth()` can't decode it, it passes through with an
   `x-pathname` header and lets the full Node `auth()` on the page decide, to
   avoid a `/contacts ⇄ /login` bounce. Logged-out requests get
   `/login?next=<pathname>`.
2. **Server actions** — many take a `redirectTo` FormData field and call
   `redirect(redirectTo)` on success (e.g. the bulk `*ContactsBulk` actions,
   archive/restore/delete). These cause a full navigation even for tap-in-place
   actions.
3. **`auth()` guards** — server components / actions that throw or redirect when
   `session?.user?.id` is missing.

The problem: a stale or slow edge-session read, or a same-page `redirect()` used
as a success path, surfaces to the user as a surprise login screen or a jarring
full-page nav.

## Scope

**In scope**
- A complete inventory of redirect sources: every `redirect(`, `NextResponse.redirect`,
  `redirectTo`/`getRedirectTarget`, and `auth()`-guard bounce across
  `src/middleware.ts`, `src/app/**`, `src/server/**`, and `src/app/actions/**`.
- A classification of each as one of: **ordinary-nav**, **workflow-completion**,
  **destructive-completion**, **auth-required**, **re-auth-required**.
- Removing same-page redirects from tap-in-place mutations where `revalidatePath`
  already refreshes the view (favorite/unfavorite, in-list archive/restore).
- A short concept doc capturing the policy so future tickets don't regress.

**Out of scope**
- Step-up auth (P31-02), PWA/cookie hardening (P31-03), session-expired UX (P31-04).

## Design / Implementation Spec

### Classification table (deliverable)
Produce a table (in the concept doc) with columns: *source location · trigger ·
current behavior · classification · action*. Example rows:

| Source | Trigger | Class | Action |
| --- | --- | --- | --- |
| `middleware.ts` §4 | no session, no cookie | auth-required | keep (`?next=`) |
| `middleware.ts` §4 | cookie present, edge can't decode | — | keep pass-through workaround |
| `archiveContactsBulk` `redirect(redirectTo)` | bulk archive | destructive-completion | keep (list refresh is the workflow) |
| `toggleFavoriteContact` | favorite tap | ordinary-nav | **remove** — `revalidatePath` only |

### Rules to apply
- **Tap-in-place** (favorite, inline edits) → no `redirect()`; rely on
  `revalidatePath` + optimistic UI. The row components already hold optimistic
  state (e.g. `optimisticFavorite`); ensure the server path doesn't navigate.
- **Workflow transitions** (delete-to-list, import-to-history, setup-complete,
  external protocol) → keep the redirect.
- **Auth-required** → keep the `?next=`-preserving bounce, but only when there is
  genuinely no session (defer the "expired session" UX to P31-04).

### Replace, don't just delete
Where a redirect was compensating for stale UI, replace it with `revalidatePath`
and/or an optimistic state rather than removing it outright (see Risks).

## Acceptance Criteria
- A complete redirect inventory + classification exists in the concept doc.
- Contact list → detail → back never triggers `/login` (desktop + mobile).
- Favorite/unfavorite from list and detail never triggers a login or full nav.
- Every remaining redirect is classified and justified.
- Desktop and mobile behavior match for ordinary authenticated routes.

## Risks / Open Questions
- Some redirects mask stale UI state; removing them may require an optimistic or
  loading state to avoid a flash of old data.
- The middleware Safari workaround must be preserved exactly — it prevents an
  infinite bounce; the audit should document *why* it exists.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: "Session continuity & redirect policy" (the classification table + rules)
