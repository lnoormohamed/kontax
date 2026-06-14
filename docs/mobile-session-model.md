# Mobile session model (PWA + mobile Safari)

## How Auth.js sessions work in Kontax

Kontax uses Auth.js v5 with the **JWT strategy**. There is no server-side session store — the session is a signed JWT stored in a cookie (`authjs.session-token`, HttpOnly, `sameSite=lax`, `secure` in production).

- **30-day absolute lifetime** (`maxAge: 30 * 24 * 60 * 60`).
- **Re-issued after 7 days of activity** (`updateAge: 7 * 24 * 60 * 60`).
- Cookie is per-origin and per-browser profile. Installing the PWA on iOS creates a separate cookie jar from Safari — the user may need to sign in again in the PWA.

## Safari edge-JWT problem and fix

The Next.js middleware runs at the Vercel/Coolify edge (V8 isolate, not Node.js). Some browsers — notably Safari/WebKit — send session cookies that the edge runtime's Web Crypto implementation fails to verify (algorithm mismatch in the edge JWT implementation).

**Effect without the fix:** middleware reads the cookie, fails to decode the JWT, treats the user as unauthenticated, and redirects to `/login`. The user is stuck in a login loop even though their session is valid.

**Fix in `middleware.ts`:**
```ts
// If the cookie is present but can't be decoded at the edge, pass through.
// The page's full Node.js auth() call will decode it correctly.
if (hasCookie && !session) {
  const response = NextResponse.next();
  response.headers.set("x-pathname", req.nextUrl.pathname);
  return response;
}
```

The `x-pathname` header carries the real URL. `redirectToLogin(fallbackPath)` in `src/server/auth/require-page-auth.ts` reads this header when building `?next=`, so the user returns to the right page after a genuine login.

## Service worker caching strategy

See `public/sw.js` and the [PWA/SW Cache runbook](../roadmap/runbooks/pwa-sw-cache.md) for full details. Key points:

- **HTML navigations are always network-first.** The SW never serves a cached authenticated HTML shell. This prevents stale auth state, stale JS chunk references, and broken contacts list after a deploy.
- **Static assets are cache-first.** JS/CSS/image files are content-hashed, so old cached files are harmless — new deploys request new filenames that aren't in cache and go to network.
- **`skipWaiting` + `clients.claim`** ensure a new SW activates immediately on deploy and takes over open tabs. The `SW_UPDATED` message triggers a "New version available" banner via `PwaRegister`.
- **Offline fallback:** `/offline.html` is served for navigation requests when the network is unavailable. It has a "Try again" reload button.

## Error boundary for chunk-load failures

`src/app/error.tsx` is a Next.js App Router error boundary. It catches runtime errors including `ChunkLoadError` / "module factory not available" — the signature error when a PWA tab is open across a deploy and tries to load a JS chunk that no longer exists on the server.

It detects chunk errors by matching error message keywords and shows:
- **Chunk error:** "Kontax was updated — Reload to update" (no "Try again" since resetting state won't help)
- **Other errors:** "Something went wrong — Reload page" + "Try again" (resets React state)

`src/app/global-error.tsx` handles the rare case where the root layout itself crashes; it renders its own `<html>` wrapper.

## Link prefetch on authenticated routes

Next.js 15 App Router prefetches `<Link>` targets in the viewport by default. For authenticated server components, prefetch fetches the RSC payload — not full HTML. Auth redirects at the server component level return a redirect payload (not an error page), which the router handles correctly.

Since the SW does not cache navigation responses, there is no risk of a stale auth-failure page being captured and served. No `prefetch={false}` overrides are needed on authenticated routes.

## Contacts list scroll restore in the PWA

`ContactsWorkspaceTable` saves the scroll position to `sessionStorage` (`kontax:contacts:list-scroll`, 10-minute TTL) when the user taps a contact row. On returning, it reads the key and scrolls the virtualizer to the saved position.

`sessionStorage` persists across client-side navigations (it only clears on tab close or full page reload). Since the PWA uses client-side navigation (Next.js App Router), this survives the list → detail → back flow.

**Requires device verification** — the preview cannot emulate the installed PWA behavior or PWA-specific sessionStorage lifetimes. Test on a real device after install.
