# P24-05 — Create/Edit Form on Mobile

## Purpose

Deliver the create and edit contact forms as full-screen bottom-sheet modals on mobile, with keyboard-aware scrolling so the focused field is never hidden behind the iOS or Android virtual keyboard. The desktop form (P17-01 create, P17-02 edit) is unchanged; this is a responsive mobile branch.

## Background

The current create form (`/contacts/new`) and edit form (`/contacts/[id]/edit`) render inline on mobile — form fields render at desktop widths and the page scrolls normally. The iOS keyboard hides the bottom ~40% of the viewport without adjusting layout, causing the active field and the submit button to be invisible when typing. This is a P0 finding anticipated by the P24-01 audit.

## Scope

**In scope:**
- Mobile create and edit forms as full-screen bottom sheets (not route changes — overlays on the current route)
- Collapsible field sections: Basic Info always open; Phone, Email, Addresses, More collapsed by default
- Keyboard-aware scroll: focused field always visible 24px above the keyboard top edge
- "Next" field advancement via keyboard return key
- Sticky save bar at the bottom, above the keyboard
- Form validation (required fields) with inline error messages

**Out of scope:**
- Desktop form (unchanged — P17-01, P17-02)
- Image upload / avatar change (deferred to a later avatar-specific ticket)

---

## Design / Implementation Spec

### Bottom sheet container

`src/app/_components/mobile-form-sheet.tsx`:

```tsx
interface MobileFormSheetProps {
  title: string;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  children: React.ReactNode;
}
```

The sheet slides up from the bottom on mount (`transform: translateY(0)`, animated from `translateY(100%)`), and slides down on close.

```tsx
style={{
  position: "fixed",
  inset: 0,
  backgroundColor: "#ffffff",
  zIndex: 60,
  display: "flex",
  flexDirection: "column",
  paddingTop: "env(safe-area-inset-top)",
}}
```

**Header bar (fixed):**
- Height: 52px. Handle bar centred at top (4px × 40px, `background: #d8ddd6`, `margin: 8px auto`).
- Title: `font-size: 17px`, `font-weight: 700`, centred.
- `×` close icon: top-right, 44×44px tap target.

**Scrollable field area:** `flex: 1`, `overflow-y: auto`, `padding: 0 16px 16px`.

**Sticky save bar (bottom):**
```tsx
style={{
  padding: "12px 16px",
  paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
  borderTop: "1px solid #d8ddd6",
  backgroundColor: "#ffffff",
}}
```

Save button: full width, `height: 48px`, `background: #4158f4`, "Save contact". Loading spinner while `isSaving`.

### Keyboard-aware scrolling

Use the `visualViewport` API (supported iOS 13+, Chrome 61+) to track the keyboard height:

```typescript
useEffect(() => {
  const scrollableEl = scrollRef.current;

  const handleViewportResize = () => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const keyboardHeight = window.innerHeight - viewport.height - viewport.offsetTop;

    if (keyboardHeight > 0 && scrollableEl) {
      // Find the focused element and scroll it into view
      const focused = document.activeElement as HTMLElement;
      if (focused && scrollableEl.contains(focused)) {
        const focusedRect = focused.getBoundingClientRect();
        const keyboardTop = viewport.height + viewport.offsetTop;
        const gap = 24; // px above keyboard

        if (focusedRect.bottom > keyboardTop - gap) {
          scrollableEl.scrollBy({
            top: focusedRect.bottom - (keyboardTop - gap),
            behavior: "smooth",
          });
        }
      }
    }
  };

  window.visualViewport?.addEventListener("resize", handleViewportResize);
  return () => window.visualViewport?.removeEventListener("resize", handleViewportResize);
}, []);
```

The sticky save bar is repositioned to sit directly above the keyboard using `visualViewport.offsetTop` as a transform offset.

### Collapsible field sections

```tsx
function FieldSection({ title, defaultOpen = false, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "14px 0",
          borderBottom: "1px solid #d8ddd6", background: "none",
          fontSize: 15, fontWeight: 600, color: "#1d2823",
        }}
      >
        {title}
        <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
      </button>
      {open && <div style={{ paddingTop: 12 }}>{children}</div>}
    </div>
  );
}
```

Usage:
```tsx
<FieldSection title="Basic Info" defaultOpen>
  {/* First name, Last name, Company, Job title */}
</FieldSection>
<FieldSection title="Phone numbers">
  {/* Phone fields + Add phone */}
</FieldSection>
<FieldSection title="Email addresses">
  {/* Email fields + Add email */}
</FieldSection>
<FieldSection title="Addresses">
  {/* Address fields */}
</FieldSection>
<FieldSection title="More">
  {/* Birthday, notes, custom fields, etc. */}
</FieldSection>
```

### "Next" field advancement

Set `returnKeyType="next"` (or `enterKeyHint="next"`) on all non-last text inputs:

```tsx
<input
  enterKeyHint={isLastFieldInSection ? "done" : "next"}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !isLastFieldInSection) {
      e.preventDefault();
      nextFieldRef.current?.focus();
    }
  }}
/>
```

The last field in the form uses `enterKeyHint="done"` and triggers form submission.

### Routing approach on mobile

On mobile, the create form is a full-screen overlay, not a route change. The URL still updates (using `router.push` with `shallow` or the Next.js parallel routes / intercepting routes pattern) so the back button works correctly.

On desktop, `/contacts/new` renders the P17-01 page component directly.

---

## Acceptance Criteria

- On mobile (≤ 767px), tapping "New contact" or the FAB opens the full-screen bottom sheet.
- On desktop (≥ 768px), the existing route-based form renders (unchanged).
- The "Basic Info" section is expanded by default; all other sections are collapsed.
- Tapping a section header expands or collapses it.
- When a text field is focused and the virtual keyboard appears, the field scrolls above the keyboard with a 24px gap.
- The Save button is always visible above the keyboard when the keyboard is open.
- Tapping the keyboard's "Next" key advances focus to the next field.
- The form sheet closes on `×` tap or swipe-down gesture (swipe down from the handle bar).
- Form validation errors appear inline beneath the relevant field, not in an alert.

---

## Risks and Open Questions

- **`visualViewport` support on older iOS:** `visualViewport` is available from iOS 13. For iOS 12 (minimal traffic), fall back to a fixed `paddingBottom` of 300px when a keyboard-likely input is focused. The fallback is imprecise but prevents total blocking.
- **Parallel routes vs overlay:** using Next.js App Router parallel routes for the modal enables URL-based deep linking to the create form while keeping the backdrop visible. This is the recommended approach but adds routing complexity. As an alternative, a state-controlled overlay is simpler but breaks direct URL access. Confirm the approach with the team before implementation.
