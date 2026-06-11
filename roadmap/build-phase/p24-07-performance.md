# P24-07 — Performance (Virtualised List, Lazy Load, Mobile Bundle)

## Purpose

Ensure the contact list remains fast with large contact libraries (1,000–10,000 contacts) on mobile, where memory and CPU are constrained. The three primary optimisations are: virtual scrolling for the contact list, lazy-loading of avatar images, and a smaller JavaScript bundle for mobile breakpoints.

## Background

The current contact list renders all visible rows in the DOM without virtualisation. At 500+ contacts, the DOM has hundreds of nodes, scroll performance degrades on mid-range Android devices, and initial render takes multiple seconds on slow connections. The Phase 11 Free-plan limit is 500 contacts, but Pro/Family/Teams users have unlimited contacts — the list must handle 5,000+ contacts smoothly.

## Scope

**In scope:**
- Virtual scrolling for the contact list using `@tanstack/react-virtual` (already present in many Next.js codebases; check if it's a dependency)
- Avatar image lazy loading using native `loading="lazy"` or `IntersectionObserver`
- Bundle analysis: identify and eliminate the heaviest mobile-irrelevant modules from the initial bundle
- `Content-Visibility` CSS property for non-visible sections

**Out of scope:**
- Server-side pagination (the list already uses cursor pagination for data fetching — this ticket is rendering performance only)
- Image CDN or avatar resizing (deferred to a future media ticket)

---

## Design / Implementation Spec

### Virtual scrolling

Install `@tanstack/react-virtual` if not already present:

```bash
npm install @tanstack/react-virtual
```

`src/app/_components/contact-list/virtual-contact-list.tsx`:

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualContactListProps {
  contacts: ContactRow[];
  rowHeight: number; // 60px mobile, 48px desktop
}

export function VirtualContactList({ contacts, rowHeight }: VirtualContactListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10, // render 10 extra rows above and below the visible area
  });

  return (
    <div ref={parentRef} style={{ height: "100%", overflow: "auto" }}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ContactRow contact={contacts[virtualRow.index]!} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Group headers:** section headers (alphabetical letters) are also rows in the virtualised list. Add `isGroupHeader: boolean` to the row type and render them differently. Their height is 28px; include in the `estimateSize` callback:

```typescript
estimateSize: (index) => contacts[index].isGroupHeader ? 28 : rowHeight,
```

### Avatar lazy loading

Replace `<img src={avatarUrl} />` with `loading="lazy"` and a `decoding="async"` attribute:

```tsx
<img
  src={avatarUrl ?? "/default-avatar.svg"}
  loading="lazy"
  decoding="async"
  width={36}
  height={36}
  style={{ borderRadius: "50%", objectFit: "cover" }}
/>
```

For avatars in the virtual list, also add `IntersectionObserver`-based loading to prevent loading avatars for rows that are in the DOM but not yet in view:

```typescript
// In the ContactRow component:
const { ref, inView } = useInView({ threshold: 0, rootMargin: "200px" });
const src = inView ? avatarUrl : undefined;
```

### `content-visibility` for off-screen sections

On pages with multiple content sections (settings, contact detail), apply:

```css
.content-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 200px; /* estimated height */
}
```

This tells the browser to skip rendering off-screen sections until they scroll into view. Reduces initial paint time significantly on long pages.

### Bundle analysis

Run:
```bash
ANALYZE=true next build
```

Identify bundles > 100kb that are loaded on the initial mobile route. Common culprits:
- Date formatting libraries (use `Intl.DateTimeFormat` built-in instead of `date-fns` where possible)
- Icon libraries (ensure only named imports are used — `import { X } from "lucide-react"` not `import * as Icons`)
- Chart or visualisation libraries not used on mobile

For libraries that are only needed on specific routes, use Next.js dynamic imports with `ssr: false`:

```typescript
const HeavyComponent = dynamic(() => import("./heavy-component"), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

### Performance targets

After this ticket, measure with Lighthouse Mobile (simulated 4G, Moto G4):
- **Time to Interactive (TTI):** < 3.5s on the contacts list route
- **Total Blocking Time (TBT):** < 300ms
- **DOM nodes on initial render (contact list):** < 500 regardless of contact count

---

## Acceptance Criteria

- With 2,000 contacts, the contact list scrolls at 60fps on a mid-range Android device (Chrome, Pixel 4a or equivalent).
- DOM node count on the contact list page does not increase proportionally with contact count (virtualisation confirmed via browser DevTools).
- Group headers render correctly in the virtual list at their correct positions.
- Avatar images are not loaded until the row is near the viewport.
- `content-visibility: auto` is applied to off-screen settings sections and contact detail sections.
- The initial JavaScript bundle size for the contacts list route is < 200kb gzipped (measured with `@next/bundle-analyzer`).

---

## Risks and Open Questions

- **Virtual list and swipe actions (P24-03):** the `SwipeableRow` component uses `useRef` for gesture tracking. When rows are unmounted and remounted by the virtualiser (as the user scrolls), the swipe state resets. This is expected and acceptable — the user is not swiping a row that is off-screen. Confirm no state corruption occurs when a row is mid-swipe and then virtualised away.
- **Sticky group headers with virtualisation:** sticky alphabetical group headers require either CSS `position: sticky` or explicit virtualiser support. `@tanstack/react-virtual` supports sticky rows via the `sticky` option — use it. Alternatively, implement headers as non-sticky and rely on the scroll position to show the current letter in a floating indicator (iOS Contacts style). Decide before implementation.
