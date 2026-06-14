# Session-expiry recovery pattern

## How session expiry is detected

Sessions are JWT, 30-day absolute lifetime, re-issued after 7 days of activity.
When a JWT expires (or is explicitly invalidated via `sessionVersion` bump),
`auth()` returns `null`.

### In server components (page-level)

`redirectToLogin(fallbackPath)` in `src/server/auth/require-page-auth.ts` is
called at the top of every authenticated page component when `auth()` returns
null. It:

1. Reads the real pathname from the `x-pathname` header (set by middleware's
   Safari pass-through) or falls back to the hardcoded `fallbackPath`.
2. Checks `cookies()` for `authjs.session-token`.
   - **Cookie present → session expired** — redirects to `/login?next=<path>&expired=1`
   - **Cookie absent → never logged in** — redirects to `/login?next=<path>`

### In the middleware

The middleware passes through requests that have a session cookie but no decodable
session (to handle Safari's edge-JWT limitation). Expiry detection at the middleware
level is left to the page, which has the full Node.js `auth()`.

## Login page differentiation

`/login` reads `expired=1` from the search params and passes `expired={true}` to
`AuthCard`. The `AuthCard` renders two distinct banners:

| Condition | Banner |
|---|---|
| `expired=1` present | **"Your session ended"** — "Sign back in and you'll return right where you left off." |
| `next` present, no `expired` | "Sign in to access this page." |
| Neither | No banner (fresh login) |

The `next` param preserves the intended destination in both cases. After
successful login, `window.location.assign(next ?? "/contacts")` sends the user
back.

## Structured server-action result type

`src/lib/action-result.ts` exports `ActionResult<T>`:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "SESSION_EXPIRED" | "STEP_UP_REQUIRED" | "ERROR"; message?: string }
```

Use this when a server action should return a structured failure the client can
branch on — instead of calling `redirect()` (which throws and navigates away)
or throwing an untyped error.

**When to use `ActionResult`:**
- Mutating actions where the UI should stay mounted on failure (contact save, settings changes)
- Any action that may fail due to session expiry mid-workflow
- Pairs with P31-02's step-up auth (`STEP_UP_REQUIRED`)

**When NOT to use `ActionResult`:**
- Delete/logout (redirect away is the correct success path)
- Simple read fetches (throw is fine)
- Workflow completions that always navigate (import, account deletion)

## Contact editor: session-expiry during save

`contact-inline-editor.tsx` detects session-expiry in the `save()` catch block
by inspecting the `digest` field on the thrown error:

```ts
const isSessionExpired = digest.includes("NEXT_REDIRECT") && digest.includes("/login");
```

When detected, `saveError` is set to `"SESSION_EXPIRED"` (a sentinel) and a
distinct inline banner renders:

> **Your session ended** — Your edits are still here. Sign back in to save them.

The `href` links to `/login?next=<current path>&expired=1`. After re-login, the
user returns to the contact page. The edit form stays mounted with the draft
intact (not cleared), so the user can re-attempt the save immediately.

## Unsaved-work guard

`contact-inline-editor.tsx` already registers a `beforeunload` listener while
`dirty === true` in edit mode:

```ts
useEffect(() => {
  if (mode !== "edit" || !dirty) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [mode, dirty]);
```

This covers tab-close and browser-level reload. For in-app navigation (clicking
away while editing), an in-app "Discard changes?" modal is shown via
`confirmDiscard` state.

## What `redirect()` vs. `throw` vs. `ActionResult` means for the UI

| Pattern | Effect in the browser | When to use |
|---|---|---|
| `redirect("/login?...")` in a server component | Browser follows the redirect; page unmounts | Auth-required page protection |
| `redirect()` in a server action | Next.js issues a client-side redirect; mounted UI is lost | Workflow completions that navigate (delete, logout) |
| `throw` in a server action | Error propagates; error.tsx catches it if unhandled | Unexpected failures |
| `return { ok: false, reason: "SESSION_EXPIRED" }` | Client branches; UI stays mounted | Mutations where keeping context matters |
