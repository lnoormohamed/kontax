# P24-02 — Responsive Navigation

## Purpose

Replace the desktop sidebar navigation with a bottom navigation bar on mobile (≤ 767px), and add a collapsing top header for secondary screens. This is the structural foundation that every subsequent P24 ticket builds on — swipe actions, touch targets, and the mobile detail layout all assume the bottom nav shell is in place.

## Background

The current app shell has a left sidebar that collapses to icons below 1024px (Phase 16). On mobile, this sidebar is hidden entirely, leaving users with no navigation. P16-07 added a bottom nav placeholder, but it is not wired to routing or styled to the locked design. This ticket implements the full mobile navigation system as specified in P24-DB06.

## Scope

**In scope:**
- Bottom navigation bar component (`BottomNav`) — Contacts, Activity, Sync, Settings tabs with icons, active state, and notification badges
- Mobile app shell layout: bottom nav + sticky top header, content area fills `100dvh` between them
- Compact top header for secondary screens (back button + page title + optional action)
- Responsive breakpoint: `< 768px` triggers mobile layout; `≥ 768px` restores sidebar
- Routing: each bottom nav tab navigates to its route; active tab reflects the current URL
- Badge wiring: unread notification count on Activity, sync error count on Sync

**Out of scope:**
- Touch interactions on the contact list rows (P24-03)
- Individual screen mobile layouts (P24-04, P24-05)

---

## Design / Implementation Spec

### `BottomNav` component

`src/app/_components/bottom-nav.tsx` — client component (needs `usePathname` for active state).

```tsx
const TABS = [
  { label: "Contacts", icon: LayoutList, href: "/" },
  { label: "Activity", icon: Activity, href: "/activity" },
  { label: "Sync", icon: RefreshCcw, href: "/sync" },
  { label: "Settings", icon: Settings, href: "/settings" },
] as const;
```

Styles:
```tsx
// Bottom nav container
style={{
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  height: "calc(56px + env(safe-area-inset-bottom))",
  paddingBottom: "env(safe-area-inset-bottom)",
  backgroundColor: "#ffffff",
  borderTop: "1px solid #d8ddd6",
  display: "flex",
  zIndex: 50,
}}

// Each tab button
style={{
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  color: isActive ? "#17352e" : "#8b938c",
  position: "relative",
  minWidth: 44,
  minHeight: 44,
}}
```

Active dot:
```tsx
{isActive && (
  <span style={{
    position: "absolute",
    top: 6,
    width: 4,
    height: 4,
    borderRadius: "50%",
    backgroundColor: "#17352e",
  }} />
)}
```

### Mobile app shell layout

Update `src/app/layout.tsx` (or the AppShell component) to use a responsive layout:

```tsx
// In the main layout:
<div style={{
  // On mobile: fixed bottom nav + content fills remaining height
  // On desktop: sidebar + content
}}>
  {/* Desktop: sidebar */}
  <aside className="hidden md:block ...">
    <Sidebar />
  </aside>

  {/* Content area */}
  <main style={{
    // Mobile: paddingBottom to clear the bottom nav (56px + safe area)
    // Desktop: no padding
    paddingBottom: "calc(56px + env(safe-area-inset-bottom))",
  }} className="md:pb-0">
    {children}
  </main>

  {/* Mobile: bottom nav */}
  <div className="md:hidden">
    <BottomNav unreadCount={unreadCount} syncErrorCount={syncErrorCount} />
  </div>
</div>
```

Use Tailwind's `md:` breakpoint (768px) consistently.

### Mobile top header

`src/app/_components/mobile-header.tsx`:

```tsx
interface MobileHeaderProps {
  title?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
}
```

- **Home screen (contacts list):** Kontax wordmark left; bell + search icon right. No back button.
- **Secondary screen:** `← [backLabel]` left (14px, `color: #5c655e`); page title centred (17px, 700); optional action right.

Height: 52px, `border-bottom: 1px solid #d8ddd6`, `background: #ffffff`, `position: sticky`, `top: 0`, `z-index: 40`.

iOS safe area: `padding-top: env(safe-area-inset-top)`.

### `100dvh` fix

Replace all `height: 100vh` with `height: 100dvh` (dynamic viewport height, supported in iOS 16+ and Chrome 108+). For older browsers, provide a fallback:

```css
height: 100vh; /* fallback */
height: 100dvh;
```

This prevents the iOS URL bar from covering bottom content.

### Badge wiring

Pass `unreadCount` and `syncErrorCount` as props from the server component that renders the shell. Both are fetched server-side on each navigation:

```typescript
// In the server layout:
const [unreadCount, syncErrorCount] = await Promise.all([
  db.userNotification.count({ where: { userId, readAt: null, dismissedAt: null } }),
  db.syncAccount.count({ where: { userId, status: { in: ["ERROR", "AUTH_FAILED"] } } }),
]);
```

---

## Acceptance Criteria

- Bottom nav renders on viewports ≤ 767px; sidebar renders on ≥ 768px.
- All four tabs navigate to the correct routes.
- The active tab shows the green dot and colour change.
- Unread notification count badge renders on the Activity tab (hidden when count = 0).
- Sync error count badge renders on the Sync tab (hidden when count = 0).
- Content area does not overlap with the bottom nav on any mobile screen.
- iOS safe area insets are applied: content is not hidden behind the notch or home indicator.
- `100dvh` is used throughout — no iOS URL-bar clipping of bottom content.
- The compact top header renders on all secondary screens with a working back button.

---

## Risks and Open Questions

- **Tailwind `md:` breakpoint vs 768px:** confirm that the project's Tailwind config uses `md: 768px` (the default) and not a custom value. If the config is customised, update the breakpoint to match.
- **Back gesture (iOS swipe-back):** iOS Safari supports a swipe-from-left-edge gesture for browser back. This conflicts with any left-to-right swipe gesture added in P24-03. Ensure swipe actions on contact list rows are right-to-left (not left-to-right) to avoid conflict.
