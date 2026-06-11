# P24-04 — Contact Detail Mobile Layout

## Purpose

Rebuild the contact detail page for mobile: a single-column stacked layout with a sticky name header on scroll, a floating action button for edit access, and all tabs (Details, Sharing, History) in a scrollable horizontal tab bar. The desktop master-detail shell (P17-02) is unchanged; this ticket adds a responsive branch for mobile.

## Background

The P17-02 contact detail page uses a master-detail shell with a left rail (avatar + key fields) and a right content area with tabs. On mobile, this collapses poorly — the left rail takes too much vertical space, and the tab area doesn't fit. The mobile layout should feel like a native contacts app: avatar + name hero at the top, all fields scrolled below, edit via a floating button.

## Scope

**In scope:**
- Mobile contact detail layout (< 768px): full-width, single column
- Sticky compact header that appears after scrolling past the hero section (name + back button + Edit button)
- Floating action button (FAB) for Edit — fixed, bottom-right, above the bottom nav
- Horizontal scrollable tab bar (Details / Sharing / History)
- Touch-optimised field rows: 48px minimum tap target for phone/email tap-to-call/email

**Out of scope:**
- Desktop layout (unchanged — P17-02)
- Edit form (P24-05)
- Sharing tab UI (P12-05 / P12-07)

---

## Design / Implementation Spec

### Layout structure

```tsx
// src/app/contacts/[id]/page.tsx — responsive branch
<div className="md:hidden">
  <MobileContactDetail contact={contact} />
</div>
<div className="hidden md:block">
  <DesktopContactDetail contact={contact} /> {/* unchanged P17-02 */}
</div>
```

### `MobileContactDetail` component

```
┌──────────────────────────────────────────────┐
│  [sticky compact header — appears on scroll] │
│  ← Contacts          Jane Smith      [Edit]  │
├──────────────────────────────────────────────┤
│  [HERO — scrolls away]                       │
│                                              │
│         [Avatar 80px]                        │
│         Jane Smith                           │
│         Product Manager · Acme Corp          │
│                                              │
│    [Call] [Message] [Email] [More ▾]        │
│                                              │
├──────────────────────────────────────────────┤
│  [TABS — sticky below compact header]        │
│  Details    Sharing    History               │
│  ─────                                       │
├──────────────────────────────────────────────┤
│  [TAB CONTENT — scrollable]                  │
│  Phone numbers                               │
│    +1 415 555 0100  (Mobile)  [→ Call]       │
│  Email                                       │
│    jane@acme.com  (Work)  [→ Mail]           │
│  ...                                         │
└──────────────────────────────────────────────┘
                              [FAB ✏ Edit]
```

### Hero section

- Avatar: 80px circle, centred, `margin: 24px auto 12px`.
- Name: `font-size: 24px`, `font-weight: 700`, centred.
- Subtitle: job title + company, `font-size: 14px`, `color: #5c655e`, centred.
- Quick action row: 4 icon buttons — Call, Message, Email, More. Each 56×56px, `border-radius: 14px`, `border: 1px solid #d8ddd6`, icon 22px `color: #17352e`. Displayed in a row, spaced evenly, `margin: 16px 20px`.

### Sticky compact header

Appears when the hero section scrolls above the viewport (detected via `IntersectionObserver` on the hero element):

```tsx
const heroRef = useRef<HTMLDivElement>(null);
const [showCompactHeader, setShowCompactHeader] = useState(false);

useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => setShowCompactHeader(!entry.isIntersecting),
    { threshold: 0 },
  );
  if (heroRef.current) observer.observe(heroRef.current);
  return () => observer.disconnect();
}, []);
```

Compact header: `height: 52px`, fixed at top (below `env(safe-area-inset-top)`), `background: #ffffff`, `border-bottom: 1px solid #d8ddd6`, `z-index: 40`.
- Left: `← Contacts` (14px, `color: #5c655e`)
- Centre: name (17px, 700)
- Right: "Edit" text button (14px, 600, `color: #4158f4`)

### Tab bar

Horizontal, full-width, sticky below the compact header (or top on initial load):

```css
.mobile-tab-bar {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid #d8ddd6;
  position: sticky;
  top: 52px; /* compact header height */
  z-index: 30;
  background: #ffffff;
}
```

Each tab: 80px minimum width, 44px height, `font-size: 14px`, `font-weight: 600`. Active: `color: #17352e`, 2px bottom border `#17352e`. Inactive: `color: #8b938c`.

### Field rows

Each field (phone, email, address) is a 56px row for easy tapping:

```
┌──────────────────────────────────────────────────┐
│  +1 415 555 0100                    Mobile  [→]  │
└──────────────────────────────────────────────────┘
```

- The `→` icon is a Lucide `Phone` (for phone), `Mail` (for email), `ExternalLink` (for website).
- Tapping the entire row triggers the action: `tel:`, `mailto:`, or opens the URL.
- Long-press on a field row → copy to clipboard. Show "Copied" toast.

### Floating action button (FAB)

```tsx
<Link href={`/contacts/${contact.id}/edit`}
  style={{
    position: "fixed",
    bottom: "calc(72px + env(safe-area-inset-bottom))", // above bottom nav
    right: 16,
    width: 52,
    height: 52,
    borderRadius: "50%",
    backgroundColor: "#17352e",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 40,
  }}
  aria-label="Edit contact"
>
  <Pencil size={20} />
</Link>
```

---

## Acceptance Criteria

- On ≤ 767px, the mobile layout renders; on ≥ 768px, the P17-02 desktop layout renders.
- The hero (avatar, name, subtitle, action row) is visible on load; scrolling reveals field content below.
- The compact sticky header appears after scrolling past the hero, and disappears on scroll back.
- The tab bar is horizontally scrollable and sticks below the compact header while scrolling field content.
- Phone and email field rows have a minimum 56px tap target height and trigger `tel:` / `mailto:` on tap.
- The FAB is visible above the bottom nav on all scroll positions.
- The FAB navigates to the edit form (P24-05).
- The Details, Sharing, and History tabs all render correctly in their mobile layouts.

---

## Risks and Open Questions

- **IntersectionObserver and sticky headers:** the `top: 52px` on the tab bar assumes the compact header is always 52px. If the compact header height changes (safe-area adjustments), the sticky offset must update. Use a CSS variable or a ref-measured value rather than a hardcoded pixel.
- **History tab on mobile:** the history timeline (P10-04) was designed for desktop widths. On mobile, the diff expander may overflow. Defer history tab mobile layout refinement to P24-04 polish if needed, and add a horizontal-scroll container as a temporary fix.
