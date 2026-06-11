# P24-08 — PWA Manifest & Offline Shell

## Purpose

Make Kontax installable as a Progressive Web App from the browser, with an offline-capable contact list (read-only from cache) and automatic background sync when the connection is restored. The PWA is the mobile delivery mechanism — no native app is planned.

## Background

The roadmap explicitly states: "No native mobile apps — the web app and native device sync via CardDAV are the delivery mechanism." A high-quality PWA — installed on the home screen with a splash screen, standalone display mode, and an offline contact list — provides the majority of native app UX without the App Store submission overhead. PWABuilder can later submit the PWA to the Microsoft Store and Play Store (with TWA wrapping) if needed.

This ticket depends on P24-07 (performance) because a slow initial load undermines the PWA install prompt — the install prompt is only shown if the app feels fast.

## Scope

**In scope:**
- `manifest.json` at `/public/manifest.json` — name, icons, theme colour, display mode, start URL
- Service worker via `next-pwa` or a custom Workbox config — caches the app shell and the last contact list API response
- Offline contact list: cached contacts are shown read-only when offline; a banner indicates offline state
- Background sync: contact list refreshes automatically when the connection is restored
- PWA install prompt: bottom sheet shown after the user's third session (P24-DB06 design)
- `beforeinstallprompt` event handling (Android/Chrome); iOS install guidance sheet

**Out of scope:**
- Push notifications (Web Push API — deferred; a separate ticket after P22)
- App Store / Play Store submission (a later GTM decision)
- Offline write queue (contacts created offline — deferred; read-only offline is v1)

---

## Design / Implementation Spec

### `manifest.json`

`/public/manifest.json`:

```json
{
  "name": "Kontax",
  "short_name": "Kontax",
  "description": "Your contacts, everywhere.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#17352e",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-180.png", "sizes": "180x180", "type": "image/png" }
  ],
  "screenshots": [
    { "src": "/screenshots/contacts-list.png", "sizes": "390x844", "type": "image/png", "form_factor": "narrow" }
  ]
}
```

Link in `app/layout.tsx`:
```tsx
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#17352e" />
<link rel="apple-touch-icon" href="/icons/icon-180.png" />
```

Required icon assets: `/public/icons/icon-192.png`, `icon-512.png`, `icon-180.png`. All maskable (safe zone: centre 80% of the icon).

### Service worker (Workbox via `next-pwa`)

Install:
```bash
npm install next-pwa
```

`next.config.js`:
```javascript
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      // App shell (pages, JS, CSS)
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "app-shell",
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      // Contact list API response
      urlPattern: /\/api\/contacts(\?.*)?$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "contacts-data",
        expiration: { maxEntries: 5, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 3, // fall back to cache if network takes > 3s
      },
    },
    {
      // Static assets (images, fonts)
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
  ],
});

module.exports = withPWA({ /* ...rest of next config */ });
```

### Offline state detection and banner

```typescript
// src/app/_components/offline-banner.tsx — client component
"use client";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div style={{
      backgroundColor: "#f6edd9",
      borderBottom: "1px solid #d8ddd6",
      padding: "10px 16px",
      fontSize: 13,
      color: "#7a5a1a",
    }}>
      ⚠ You're offline. Showing your last synced contacts.
    </div>
  );
}
```

When offline, the contact list still renders (from the service worker cache). Write actions (create, edit, archive) show a disabled state with a tooltip: "Changes require a connection."

### Background sync on reconnect

```typescript
// Refresh contact list when connection is restored
window.addEventListener("online", () => {
  router.refresh(); // Next.js App Router — re-fetches server component data
});
```

The service worker's `NetworkFirst` strategy for the contacts API automatically updates the cache on the next successful network request.

### PWA install prompt

```typescript
// src/app/_components/pwa-install-prompt.tsx — client component
"use client";

let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
});

export function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const sessionCount = useSessionCount(); // tracks visits in localStorage

  useEffect(() => {
    if (sessionCount >= 3 && deferredPrompt && !localStorage.getItem("pwa-install-dismissed")) {
      setShowPrompt(true);
    }
  }, [sessionCount]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === "accepted") {
        localStorage.setItem("pwa-installed", "true");
      }
    } else {
      // iOS — show guidance sheet
      setShowIosGuidance(true);
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "true");
    setShowPrompt(false);
  };

  if (!showPrompt) return null;
  return <PwaInstallSheet onInstall={handleInstall} onDismiss={handleDismiss} />;
}
```

The `PwaInstallSheet` renders the bottom sheet from P24-DB06:
- App icon (64px)
- "Add Kontax to your home screen"
- Benefit copy: "Access your contacts instantly, even without an internet connection."
- [Install] / [Not now] buttons

iOS guidance sheet (shown when `deferredPrompt` is null — iOS doesn't support programmatic install):

```
To install Kontax:
1. Tap the Share button  [share icon]
2. Scroll down and tap "Add to Home Screen"  [home screen icon]

[Got it]
```

---

## Acceptance Criteria

- `manifest.json` is served at `/manifest.json` with all required fields.
- The app is installable from Chrome on Android — the browser's install button appears and the PWA installs correctly.
- On iOS Safari, the install prompt shows the Share → Add to Home Screen guidance.
- The install prompt is shown after the user's third session and not shown again after dismissal or installation.
- When offline, the contact list shows the last cached contacts and the offline banner.
- Write actions (create, edit) are disabled while offline.
- When the connection is restored, the contact list refreshes automatically.
- The PWA opens in standalone mode (no browser chrome) when launched from the home screen.
- The splash screen uses the correct theme colour (`#17352e`) and app icon.

---

## Risks and Open Questions

- **`next-pwa` compatibility with Next.js App Router:** `next-pwa` has known compatibility issues with the Next.js 13+ App Router, particularly around server components and the RSC payload cache. Verify compatibility with the current Next.js version before committing to `next-pwa`. Alternatives: `@ducanh2912/next-pwa` (actively maintained fork) or a custom Workbox service worker registered via a `next.config.js` `headers` export.
- **Service worker update strategy:** when a new version of Kontax deploys, the service worker must update. Use `skipWaiting: true` in the Workbox config to activate the new service worker immediately (rather than waiting for all tabs to close). Show a "New version available — reload to update" banner when the service worker updates.
- **HTTPS requirement:** service workers only work on HTTPS. Verify that all staging and production environments use HTTPS, and that `localhost` is treated as a secure context (it is, by default).
