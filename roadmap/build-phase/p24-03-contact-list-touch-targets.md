# P24-03 — Contact List Touch Targets & Swipe Actions

## Purpose

Make the contact list rows genuinely comfortable to use on mobile: larger tap targets, swipe-to-archive and swipe-to-favourite gestures, and haptic feedback. The current rows are sized for a mouse pointer (48px compact density); this ticket makes them touch-first without regressing the desktop experience.

## Background

The Phase 16 contact list (P16-02) uses 48px compact rows on desktop and 60px cozy rows on mobile. This ticket keeps the 60px mobile height and adds: (1) accurate touch target measurement — the star icon was too small; (2) swipe gesture implementation using a pointer-events approach that degrades gracefully on desktop; (3) haptic feedback via the Vibration API where supported.

## Scope

**In scope:**
- Mobile row height: 60px (already in P16-07; verify and enforce)
- Star/favourite tap target: minimum 44×44px (rightmost portion of the row)
- Right-to-left swipe gesture: reveal Favourite and Archive actions
- Swipe snap logic: 40% width → snap open; < 40% → snap closed
- Haptic feedback: `navigator.vibrate(10)` on swipe action completion
- Archive swipe action: archives contact and shows "Undo" toast (5 seconds)
- Favourite swipe action: toggles favourite, shows brief confirmation

**Out of scope:**
- Desktop hover interactions (unchanged from Phase 16)
- Bulk select on mobile (retained as a tap-the-checkbox interaction)

---

## Design / Implementation Spec

### Swipe gesture implementation

Use pointer events (`pointerdown`, `pointermove`, `pointerup`) rather than touch events — pointer events work on both touch and mouse, and allow `touch-action: pan-y` to preserve vertical scrolling.

`src/app/_components/contact-list/swipeable-row.tsx`:

```tsx
"use client";

interface SwipeableRowProps {
  onArchive: () => void;
  onToggleFavourite: () => void;
  children: React.ReactNode;
}

export function SwipeableRow({ onArchive, onToggleFavourite, children }: SwipeableRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const REVEAL_WIDTH = 160; // px — total width of both action buttons
  const SNAP_THRESHOLD = 0.4; // 40% of reveal width

  const handlePointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    setIsDragging(true);
    rowRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = startX.current - e.clientX;
    // Only allow left swipe (positive delta = swiping right → left)
    setTranslateX(Math.max(0, Math.min(delta, REVEAL_WIDTH)));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (translateX > REVEAL_WIDTH * SNAP_THRESHOLD) {
      setTranslateX(REVEAL_WIDTH); // snap open
    } else {
      setTranslateX(0); // snap closed
    }
  };

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* Action buttons (behind the row) */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0,
        width: REVEAL_WIDTH, display: "flex",
      }}>
        <button onClick={() => { onToggleFavourite(); setTranslateX(0); navigator.vibrate?.(10); }}
          style={{ flex: 1, background: "#17352e", color: "#fff", border: "none" }}>
          ⭐
        </button>
        <button onClick={() => { onArchive(); setTranslateX(0); navigator.vibrate?.(10); }}
          style={{ flex: 1, background: "#b5472f", color: "#fff", border: "none" }}>
          🗑
        </button>
      </div>

      {/* Row content (slides left) */}
      <div
        ref={rowRef}
        style={{
          transform: `translateX(-${translateX}px)`,
          transition: isDragging ? "none" : "transform 200ms ease",
          touchAction: "pan-y", // allow vertical scrolling; horizontal handled by pointer events
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {children}
      </div>
    </div>
  );
}
```

### Favourite tap target

The star icon in the row has a 44×44px hit area regardless of the icon's visual size:

```tsx
<button
  style={{
    width: 44, height: 44,
    display: "flex", alignItems: "center", justifyContent: "center",
    // No visual background — invisible enlarged tap target
  }}
  onClick={(e) => { e.stopPropagation(); onToggleFavourite(); }}
  aria-label="Toggle favourite"
>
  <Star size={16} ... />
</button>
```

### Archive swipe → undo toast

```typescript
async function handleArchive(contactId: string) {
  await archiveContact(contactId);
  toast({
    message: "Contact archived.",
    action: { label: "Undo", onClick: () => restoreContact(contactId) },
    duration: 5000,
  });
}
```

The toast uses the existing toast component. "Undo" calls `restoreContact` which sets `archivedAt = null` and emits an `ActivityEvent`.

### Row height enforcement on mobile

```css
/* In contact-row.css or via Tailwind: */
.contact-row {
  height: 48px; /* desktop compact */
}

@media (max-width: 767px) {
  .contact-row {
    height: 60px; /* mobile cozy */
  }
}
```

---

## Acceptance Criteria

- Contact rows are 60px tall on mobile (≤ 767px); 48px on desktop.
- Swiping left by more than 40% of the action area width snaps the row open, revealing Favourite and Archive buttons.
- Swiping less than 40% snaps the row back to closed.
- Tapping Favourite from the swipe menu toggles the favourite status; the row snaps closed.
- Tapping Archive from the swipe menu archives the contact; an undo toast appears for 5 seconds.
- Haptic feedback fires on action completion (where Vibration API is supported).
- The star/favourite icon has a 44×44px tap target; tapping it does not navigate to the contact detail.
- Vertical scrolling is not blocked by the swipe gesture — `touch-action: pan-y` is applied.
- On desktop, swipe gestures do not interfere with mouse interactions (drag on a row does not trigger swipe).

---

## Risks and Open Questions

- **iOS scroll performance:** pointer-event-based gesture handlers can cause jank on iOS if `will-change: transform` is not set on the sliding element. Add `will-change: transform` to the row content div and remove it after the animation completes.
- **Accessibility:** swipe actions must be accessible without swipe — the existing context menu (long-press or right-click) and the detail panel actions provide alternative paths. Ensure `aria-label` on the action buttons is correct.
- **Conflict with text selection:** on Android, a long-press on text triggers the selection popover, which may conflict with the swipe gesture start. Use a `pointerdown` delay of 150ms before activating the swipe to distinguish from text selection attempts.
