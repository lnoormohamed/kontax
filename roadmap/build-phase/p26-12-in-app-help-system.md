# P26-12 — In-App Help System

## Purpose

Build a `/help` FAQ page and a shared `HelpTooltip` component that surfaces contextual explanations at the point of confusion — CardDAV setup, 2FA, import field mapping, and family group creation are the four features that most commonly generate "how do I…" support emails. Inline help reduces support volume and increases feature adoption.

## Background

P26-DB07 specifies both the `/help` page structure and the `HelpTooltip` style. This ticket implements them. The `/help` page is a public route (accessible without login) and is linked from empty states (P26-13) and relevant settings pages. The `HelpTooltip` is an in-app component placed on settings fields, sync connection inputs, and other areas where users get confused.

## Scope

**In scope:**
- `/help` FAQ page: 4 sections (CardDAV & Sync, Import & Export, Account & Security, Plans & Billing), grouped disclosures with anchor IDs
- `HelpTooltip` client component: `?` trigger button, popover with explanatory text and optional "Learn more →" link
- Initial placement: CardDAV server URL field (sync connections), 2FA backup codes (settings), import source profile selector, family group invite
- Page search: client-side search that filters FAQ items by keyword

**Out of scope:**
- A full knowledge base or documentation site (deferred — the FAQ is the v1 format)
- Support ticketing integration (deferred)
- Localisation (English only for v1)

---

## Design / Implementation Spec

### `/help` FAQ page

`src/app/(public)/help/page.tsx` — server component, fully static.

Page structure:
```tsx
<div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
  <h1>Help & FAQ</h1>
  <HelpSearch /> {/* client component — filters items */}
  <HelpSection id="carddav" title="CardDAV & Sync" items={CARDDAV_FAQS} />
  <HelpSection id="import" title="Import & Export" items={IMPORT_FAQS} />
  <HelpSection id="security" title="Account & Security" items={SECURITY_FAQS} />
  <HelpSection id="billing" title="Plans & Billing" items={BILLING_FAQS} />
</div>
```

`HelpSection`:
```tsx
function HelpSection({ id, title, items }: { id: string; title: string; items: FaqItem[] }) {
  return (
    <section id={id} style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.06em", color: "#8b938c", marginBottom: 12 }}>
        {title}
      </h2>
      {items.map((item) => (
        <details key={item.id} id={item.id}>
          <summary style={{ fontSize: 15, color: "#4158f4", cursor: "pointer", padding: "10px 0" }}>
            {item.question}
          </summary>
          <div style={{ fontSize: 14, color: "#5c655e", lineHeight: 1.6, padding: "8px 0 16px 16px" }}>
            {item.answer}
          </div>
        </details>
      ))}
    </section>
  );
}
```

Initial FAQ content (non-exhaustive — add as support tickets reveal common questions):

**CardDAV & Sync:**
- "What is CardDAV?" — brief explanation; Kontax server URL; supported apps
- "How do I connect iCloud to Kontax?" — step-by-step with app password instructions
- "How do I connect Nextcloud / Fastmail / Radicale?" — generic CardDAV setup
- "Why are my contacts not syncing?" — common causes (auth error, wrong URL, app password scope)

**Import & Export:**
- "How do I export from Google Contacts?" — Takeout link, CSV format selection
- "What CSV columns are supported?" — links to the field mapping step
- "How do I undo an import?" — rollback window, archive semantics

**Account & Security:**
- "How do I set up two-factor authentication?" — TOTP app setup, QR code, recovery codes
- "What is a session?" — explains active sessions panel and revocation
- "What happens if I delete my account?" — 30-day grace period, data export

**Plans & Billing:**
- "What's included in the free plan?" — link to /pricing
- "How does Family sharing work?" — group creation, member invites, shared book
- "How do I cancel my subscription?" — Stripe portal link

### `HelpTooltip` component

`src/app/_components/help-tooltip.tsx` — client component:

```tsx
"use client";

interface HelpTooltipProps {
  content: string; // explanatory text
  learnMoreHref?: string; // /help#anchor
}

export function HelpTooltip({ content, learnMoreHref }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <span style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-label="Help"
        style={{
          width: 18, height: 18, borderRadius: "50%",
          border: "1px solid #d8ddd6", background: "#f2f4f0",
          color: "#8b938c", fontSize: 11, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >?</button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#1d2823", color: "#ffffff",
          borderRadius: 10, padding: "12px 14px",
          maxWidth: 240, fontSize: 13, lineHeight: 1.5,
          zIndex: 100, whiteSpace: "normal",
        }}>
          {content}
          {learnMoreHref && (
            <Link href={learnMoreHref} style={{ display: "block", color: "#dff0e7",
              textDecoration: "underline", marginTop: 8, fontSize: 12 }}>
              Learn more →
            </Link>
          )}
          {/* Arrow */}
          <div style={{
            position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
            width: 8, height: 8, background: "#1d2823", rotate: "45deg",
          }} />
        </div>
      )}
    </span>
  );
}
```

### Initial placements

1. **Sync connections — Server URL field:**
   ```tsx
   <label>Server URL <HelpTooltip content="Your CardDAV server URL. For iCloud: https://contacts.icloud.com/" learnMoreHref="/help#carddav" /></label>
   ```

2. **Settings → Security — 2FA backup codes:**
   ```tsx
   <HelpTooltip content="Save these codes in a safe place. Each code can only be used once. If you lose your 2FA device, use a backup code to sign in." learnMoreHref="/help#security" />
   ```

3. **Import — Source profile selector:**
   ```tsx
   <HelpTooltip content="Selecting the right source helps Kontax automatically map columns. Google Contacts uses 'Given Name', Apple uses 'First Name'." learnMoreHref="/help#import" />
   ```

4. **Family group — Invite member:**
   ```tsx
   <HelpTooltip content="Invited members get access to your shared address book. They keep their own private contacts separately." learnMoreHref="/help#billing" />
   ```

### Client-side search

In `HelpSearch`, filter FAQ items by `q.toLowerCase()` match in `question` or `answer` text:
```typescript
const filtered = allItems.filter(
  (item) =>
    item.question.toLowerCase().includes(q) ||
    item.answer.toLowerCase().includes(q),
);
```

Results shown inline, replacing the section layout when `q` is non-empty.

---

## Acceptance Criteria

- `/help` renders all 4 sections with disclosure items; each section has an anchor ID.
- Clicking a FAQ `<summary>` expands the answer; clicking again collapses it.
- Client-side search filters items and shows results from all sections.
- `HelpTooltip` renders the `?` trigger; clicking/tapping opens the popover; clicking outside closes it.
- All 4 initial `HelpTooltip` placements are in place on their respective pages.
- `/help` is publicly accessible without login.
- "Learn more →" links in tooltips navigate to the correct `/help#{anchor}` anchor.

---

## Risks and Open Questions

- **FAQ content maintenance:** FAQ answers will go stale as the product evolves. Add a `lastReviewedAt` date to each FAQ item in the data file and display it as "Last updated: [date]" on the page. This makes content staleness visible.
- **`<details>` / `<summary>` and animation:** native `<details>` elements do not support CSS animation for the expand/collapse transition. For a polished feel, replace with a controlled state component using `max-height` animation. This is a P2 polish task — ship with native `<details>` first.
