# Session Continuity & Redirect Policy

*P31-01 deliverable. Keep updated when adding new authenticated routes.*

---

## How authentication works

**Layer 1 — Middleware** (`src/middleware.ts`)

Runs on every request before any page code:

1. Static assets + auth API: always pass through.
2. `pendingTotp=true` sessions: redirect to `/login/verify-2fa` (everywhere except the 2FA page itself).
3. `pendingDeletion=true` sessions: redirect to `/account-pending-deletion`.
4. Public pages (`/login`, `/register`, `/share/…`, etc.): pass through.
5. **No session:** redirect to `/login?next={pathname}` — the `?next=` param preserves the intended destination.
6. **Session cookie present but edge JWT can't decode it** (Safari/PWA edge case): pass to the page with an `x-pathname` header. The page's full Node.js `auth()` makes the final call.
7. Non-ADMIN on `/admin/…`: redirect to `/contacts`.

**Layer 2 — Page-level auth check**

Only fires when the middleware passed through (case 6 above — session cookie present but undecodable at the edge). Pages call `redirectToLogin(fallbackPath)` from `~/server/auth/require-page-auth`, which reads the `x-pathname` header set by the middleware so that `?next=` reflects the real URL, not a hardcoded string.

---

## Redirect catalogue

### Auth-required redirects (middleware)

| Trigger | Destination | Reason |
|---------|-------------|--------|
| No session, any protected route | `/login?next={pathname}` | Gate all app routes |
| `pendingTotp=true` | `/login/verify-2fa` | Enforce 2FA challenge before app access |
| `pendingDeletion=true` | `/account-pending-deletion` | Prevent app use during deletion grace period |
| Non-ADMIN on `/admin/…` | `/contacts` | Role gate; DB re-checked on every admin action |

### Auth-required redirects (page level — Safari/PWA edge case)

All pages use `redirectToLogin(fallbackPath)` which reads `x-pathname`. Fallback paths:

| Page | Fallback |
|------|----------|
| `/contacts` | `/contacts` (hardcoded in page; middleware `?next=` handles the common case) |
| `/contacts/[id]` | reads `x-pathname` (set by middleware) |
| `/merge-suggestions/[id]` | `/merge-suggestions` |
| `/settings` | `/settings` |
| `/settings/account` | `/settings/account` |
| `/settings/devices` | `/settings/devices` |
| `/settings/developer` | `/settings/developer` |
| `/settings/family` | `/settings/family` |
| `/settings/notifications` | `/settings/notifications` |
| `/settings/preferences` | `/settings/preferences` |
| `/settings/profile` | `/settings/profile` |
| `/settings/profile/card` | `/settings/profile/card` |
| `/settings/teams` | `/settings/teams` |
| `/settings/teams/audit` | `/settings/teams/audit` |

### Post-action redirects (server actions)

These happen after a mutation completes — they are intentional navigation, not auth redirects.

| Action | Default destination | Notes |
|--------|---------------------|-------|
| `createContact` | `/contacts/{id}?saved=1` | Caller can override via `redirectTo` form field |
| `updateContact` | `/contacts/{id}?saved=1` | Caller can override |
| `toggleFavoriteContact` | none (revalidatePath) | In-place update; no redirect unless caller passes `redirectTo` |
| `archiveContact` | none (revalidatePath) | From contact detail: stays on page. From list: caller passes `/contacts?tab=people` |
| `restoreContact` | none (revalidatePath) | From archived list: caller passes `/contacts?tab=archived` |
| `permanentlyDeleteContact` | `/contacts` | Always navigates away (contact no longer exists) |
| `mergeContacts` | caller's `redirectTo?merged=1` | Must navigate; merge changes identity |
| `bulkAcceptHighConfidenceContacts` | `/contacts?tab=duplicates&…` | Always navigates to duplicate review list |
| Sync mutations | `/sync?status=…` | All sync pages: stay on `/sync` with a status param |
| Family/team invite accept | `/contacts?tab=people&filter=all` | Intentional: drops user into their now-populated contact list |
| Family/team invite reject | `/contacts` | Intentional |
| `signOutUser` | `/login` | Intentional |

### OAuth redirects (sync)

| Step | Destination | Reason |
|------|-------------|--------|
| Google/Microsoft connect: no session | `/login` | Must be authenticated to start OAuth |
| OAuth consent denied | `/sync?error=google_denied` | Surface error to user |
| OAuth callback: state mismatch | `/login` | CSRF-style check failed; force re-auth |
| OAuth success | `/sync?connected=google` | Return to sync page with success signal |

### Client-side router.push / router.replace

These are UI navigations, not auth redirects — listed for completeness:

| Component | Trigger | Destination |
|-----------|---------|-------------|
| `LoginForm` | Successful login | `?next` param ?? `/contacts` |
| `RegisterForm` | Account created | `?next` param ?? `/contacts` |
| `SearchInput` | Filter changed | `/contacts?{query}` (replace, no scroll) |
| `ContactsTable` (keyboard) | `Enter`/`e` key | `/contacts/{id}` |
| `ContactsTable` (keyboard) | `c` key | `/contacts/new` |
| `Verify2FA` | 2FA passed | `/contacts` |
| `DeleteAccountSection` | Account deleted | `/account-deleted` |
| `ImpersonationBanner` | Exit impersonation | `/admin/users` |

---

## Rules for new routes

1. **New authenticated page**: import `redirectToLogin` from `~/server/auth/require-page-auth` and add `if (!session?.user?.id) return redirectToLogin("/your/path")` at the top.  
   Do NOT use bare `redirect("/login")` — it loses the return destination.

2. **New in-place mutation** (favorite, label toggle, field edit): call `revalidatePath`, do NOT call `redirect()`. Pass `redirectTo` only if the mutation naturally ends on a different page (delete, merge, archive-from-list).

3. **New workflow mutation** (create, delete, merge): call `redirect()` to the logical next destination. Accept an optional `redirectTo` form field via `getRedirectTarget(formData)` so callers can override.

4. **New OAuth flow**: always redirect to `/login` when there's no session; redirect to the feature page (with a status param) on success or failure.
