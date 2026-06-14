# Runbook: PWA / Service Worker Cache

## What the SW does

`public/sw.js` runs in the browser and intercepts fetches:

| Request type | Strategy | Cache name |
|---|---|---|
| Static assets (`.js`, `.css`, images, fonts) | Cache-first, populate on miss | `kontax-assets-v6` |
| HTML navigations (`mode === "navigate"`) | **Network-first**, fall back to `/offline.html` when offline | none |
| Everything else (API calls, etc.) | Network only | none |

Key lifecycle behaviour:
- **`skipWaiting`** on install → new SW activates as soon as it's installed, without waiting for existing tabs to close.
- **`clients.claim()`** on activate → new SW immediately takes control of open tabs.
- **`SW_UPDATED` message** → SW broadcasts to all clients after `controllerchange`; `PwaRegister` shows a "New version available — Reload" banner.
- **Old cache pruning** on activate → any cache not in `ALL_CACHES` (the three v6 names) is deleted, so stale v5 caches are removed automatically on first use of a new deploy.

## "module factory not available" — stale-chunk error

**Symptom:** After a Coolify deploy, a PWA tab that was left open shows a blank screen or a white flash followed by a JS error containing `module factory not available`, `ChunkLoadError`, or `Failed to fetch dynamically imported module`.

**Root cause:** The page HTML was fetched before the deploy (old chunk filenames). After the deploy, some new JS modules are requested but the old SW cached asset list doesn't have them, so the fetch goes to network → 404 (old hash no longer exists on server).

**Why this is now mitigated:**
- Navigations are network-first → fresh HTML (with new chunk hashes) is always fetched.
- `skipWaiting` + `clients.claim` → new SW takes over immediately and sends `SW_UPDATED`.
- `PwaRegister` shows a reload banner → user gets new HTML before the stale chunk is requested.
- `src/app/error.tsx` catches any chunk-load errors that slip through and shows "Reload to update" instead of a blank screen.

**If it still happens:**
1. Open DevTools → Application → Service Workers.
2. Click "Unregister" for the Kontax SW.
3. Open Application → Cache Storage → delete all `kontax-*` caches.
4. Reload the page.

## Bumping SW cache version on deploy

Increment all three version strings **together** in `public/sw.js` whenever a deploy changes JS chunk hashes (i.e., any production deploy):

```js
const SHELL_CACHE = "kontax-shell-v7";  // was v6
const PAGE_CACHE  = "kontax-pages-v7";
const ASSET_CACHE = "kontax-assets-v7";
```

This causes the activate handler to delete the old v6 caches, ensuring browsers don't serve stale assets from cache. Not bumping is safe (old v6 assets are still valid since asset filenames are content-hashed) but bumping is the clean practice and keeps the cache small.

## Cookie / proxy config

Kontax runs inside a Coolify LXC container (Proxmox LXC 114) behind a reverse proxy. The relevant Auth.js cookie settings:

| Setting | Value | Why |
|---|---|---|
| `trustHost: true` | Set in both `config.ts` and `config.edge.ts` | Tells Auth.js to trust `x-forwarded-host` / `x-forwarded-proto` from Coolify; without this, Auth.js mis-detects the protocol and either throws `UntrustedHost` or fails to mark the cookie `Secure`. |
| `sameSite` | `"lax"` (Auth.js default) | Allows cookie on top-level navigations; blocks on cross-site sub-resource requests. Correct for PWA on the same domain. |
| `secure` | `true` in production (detected via `trustHost` + forwarded `https` proto) | Cookie is HTTPS-only in prod, HTTP-only in local dev. |
| Cookie name | `authjs.session-token` | The default Auth.js v5 name. |

**Safari / edge-JWT pass-through:** The middleware edge runtime can fail to decode a valid `authjs.session-token` on Safari (missing Web Crypto support for the specific JWT algorithm at the edge). The fix is in `middleware.ts`: when a session cookie is present but can't be decoded at the edge, the request passes through with an `x-pathname` header. The full Node.js `auth()` call in the page component decodes it correctly, and `redirectToLogin()` reads `x-pathname` to preserve the real URL in `?next=`.

## PWA scroll restore

The contacts list saves its scroll position to `sessionStorage` with key `kontax:contacts:list-scroll` before navigating to a contact detail page (see `contacts-workspace-table.tsx`, `saveListScrollPosition`). On returning, the key is read and the virtualizer scrolls back.

`sessionStorage` is per-tab and survives client-side navigation (it only clears on tab close or full reload). Since navigations in the PWA are client-side (Next.js App Router), the scroll position persists correctly.

**Verify on device** (can't be tested in the preview): install the PWA, browse to a contact, go back — the list should be at the same position.
