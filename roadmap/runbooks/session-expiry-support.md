# Runbook: Session expiry — support & diagnostics

## Symptoms a user reports

| Symptom | Likely cause |
|---|---|
| "I keep getting logged out" | Session expired (30-day limit reached), or `sessionVersion` bumped (password change, impersonation ended, account deletion cancelled) |
| "I was editing a contact and got signed out" | Session expired mid-edit; contact editor should show the in-line recovery prompt |
| "I see a blank screen after clicking something" | Chunk-load error (stale PWA) or unhandled error — see `error.tsx` recovery UI |
| "The login page says 'Your session ended'" | Normal expiry recovery flow; user should sign back in |
| "I signed in but landed on the login page again" | Possible redirect loop; check Safari edge-JWT scenario (P31-03) |

## Session lifetime

- **30-day absolute max** (`maxAge`). Sessions are NOT renewed after 30 days regardless of activity.
- **7-day activity-based re-issue** (`updateAge`). An active user's token is refreshed every 7 days; the 30-day clock restarts.
- **Immediate invalidation** triggers (all bump `sessionVersion`):
  - Password change (`changePassword`)
  - Account deletion scheduled (`scheduleAccountDeletion`)
  - Account deletion cancelled (`cancelAccountDeletion`)
  - Admin impersonation start/end

## What the user sees when a session expires

1. They navigate to any authenticated route.
2. The page's `auth()` returns `null`. `redirectToLogin()` detects the session cookie is still present → adds `expired=1`.
3. Login page shows: **"Your session ended — sign back in and you'll return right where you left off."**
4. After sign-in, `window.location.assign(next)` sends them back to the original page.

If they were mid-edit in the contact editor, the save fails with the inline banner: **"Your session ended — your edits are still here. Sign back in to save them."** The edit form stays mounted with the draft intact.

## What to check for "keep getting logged out"

1. **Check sessionVersion**: `SELECT "sessionVersion", "updatedAt" FROM "User" WHERE id = '<uid>'`. A recently-bumped version means something invalidated the session (see triggers above).
2. **Check last login**: `SELECT * FROM "ActivityEvent" WHERE "userId" = '<uid>' AND "eventType" = 'USER_LOGIN' ORDER BY "createdAt" DESC LIMIT 5;`
3. **30-day limit**: If `createdAt` of their JWT (in the cookie) is > 30 days ago, the token is simply expired. Tell them to sign in again.
4. **Multi-device logout**: If user changed password on one device, all other sessions are invalidated. Expected behaviour.

## Checking if a specific session cookie is valid

1. Copy the `authjs.session-token` cookie value from DevTools.
2. Decode the JWT payload (base64-decode the middle segment). Check `exp` field (Unix timestamp). If `exp < now()` the token is expired.
3. Check that `jti` is not revoked by comparing `sessionVersion` in the JWT against the DB value. (Auth.js `jwt` callback does this on every request.)

## Redirect loop debugging

If the user reports a loop between `/contacts` and `/login`:

1. Is there a valid session cookie? If yes and middleware still redirects → Safari edge-JWT scenario; check that the `x-pathname` pass-through is in place in `middleware.ts`.
2. Is `AUTH_TRUST_HOST=true` set in the Coolify environment? Without it, Auth.js can mis-detect the protocol and drop the cookie on every response.
3. Check Coolify deploy logs for `UntrustedHost` errors.
