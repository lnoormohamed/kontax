# P26-05 — Empty States

## Purpose

Replace blank or generic "no data" messages on all primary surfaces with contextual empty states: each one explains what the surface is for, why it's empty, and offers a clear first action. Empty states are the single most impactful activation lever after onboarding — a user who sees an empty list with no guidance churn immediately.

## Background

The P26-DB07 design brief specifies four empty state variants. This ticket implements them for: contacts list, activity log, sync connections, and shared contacts. Each follows the same structure (icon, headline, body, CTA) but with copy and CTAs tailored to the surface context.

## Scope

**In scope:**
- Contacts list empty state (no contacts at all)
- Contacts list filtered empty state (search or filter returned no results)
- Activity log empty state
- Sync connections empty state (no sync accounts)
- Shared contacts empty state (no incoming shares)
- A reusable `EmptyState` component that each surface uses with custom props

**Out of scope:**
- Merge suggestions empty state (already handled in P10-05)
- Admin page empty states (scoped to Phase 21)

---

## Design / Implementation Spec

### `EmptyState` component

`src/app/_components/empty-state.tsx`:

```tsx
interface EmptyStateProps {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  headline: string;
  body: string;
  primaryCta?: { label: string; href?: string; onClick?: () => void };
  secondaryCta?: { label: string; href: string };
}

export function EmptyState({ icon: Icon, headline, body, primaryCta, secondaryCta }: EmptyStateProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", textAlign: "center", padding: "64px 32px",
      maxWidth: 380, margin: "0 auto",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: "#f2f4f0", border: "1px solid #e9ece7",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
      }}>
        <Icon size={28} color="#8b938c" strokeWidth={1.5} />
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 600, color: "#1d2823", margin: "0 0 8px" }}>
        {headline}
      </h3>
      <p style={{ fontSize: 14, color: "#5c655e", lineHeight: "1.55", margin: "0 0 24px" }}>
        {body}
      </p>
      {primaryCta && (
        primaryCta.href
          ? <Link href={primaryCta.href} style={primaryCtaStyle}>{primaryCta.label}</Link>
          : <button onClick={primaryCta.onClick} style={primaryCtaStyle}>{primaryCta.label}</button>
      )}
      {secondaryCta && (
        <Link href={secondaryCta.href} style={secondaryCtaStyle}>{secondaryCta.label} →</Link>
      )}
    </div>
  );
}
```

### Contacts list — empty (no contacts)

```tsx
<EmptyState
  icon={UserPlus}
  headline="Your contacts will appear here"
  body="Import from Google or Apple, add one by one, or connect a sync account to get started."
  primaryCta={{ label: "Import contacts", href: "/import-export" }}
  secondaryCta={{ label: "Add manually", href: "/contacts/new" }}
/>
// Below: "Or connect a sync account →" as a tertiary text link
```

### Contacts list — filtered/search empty

When search or filters return no results, show a different state:

```tsx
<EmptyState
  icon={SearchX}
  headline={`No contacts matching "${query}"`}
  body="Try a different name, email, or phone number."
  primaryCta={{ label: "Clear search", onClick: clearSearch }}
/>
```

For filter-only (no search term):
```tsx
<EmptyState
  icon={Filter}
  headline="No contacts match this filter"
  body="Try adjusting or clearing the active filters."
  primaryCta={{ label: "Clear filters", onClick: clearFilters }}
/>
```

### Activity log — empty

```tsx
<EmptyState
  icon={Activity}
  headline="No activity yet"
  body="Start by adding or importing contacts — every change will be recorded here."
  primaryCta={{ label: "Add your first contact", href: "/contacts/new" }}
/>
```

### Sync connections — empty

```tsx
<EmptyState
  icon={RefreshCcw}
  headline="Connect your first sync account"
  body="Kontax connects to your existing contacts services via CardDAV, keeping everything in sync automatically."
  primaryCta={{ label: "Connect an account", onClick: openAddAccountPanel }}
  secondaryCta={{ label: "Learn about CardDAV", href: "/help#carddav" }}
/>
```

### Shared contacts — no incoming shares

```tsx
<EmptyState
  icon={ArrowDownLeft}
  headline="Nothing shared with you yet"
  body="When someone shares a contact with you on Kontax, it will appear here."
  secondaryCta={{ label: "Learn about sharing", href: "/help#sharing" }}
/>
```

### Activity log — Free plan gate (no global feed)

Free users see the activity log route but it's gated. Show a plan-gate empty state:

```tsx
<EmptyState
  icon={Lock}
  headline="Activity log is a Pro feature"
  body="Upgrade to Pro to see a full history of every change, import, and sync across your account."
  primaryCta={{ label: "Upgrade to Pro", href: "/pricing" }}
/>
```

---

## Acceptance Criteria

- All five empty state variants render correctly on their respective surfaces.
- The filtered/search empty state shows the search query in the headline.
- CTAs navigate to the correct routes; the `clearSearch`/`clearFilters` onClick actions work.
- The `EmptyState` component is reusable — adding a new empty state requires only new props, no new component.
- The activity log Free-plan gate empty state renders for Free users.
- All empty states are accessible: icon is `aria-hidden`, headline uses `<h3>`, CTAs are reachable by keyboard.
- Empty states render correctly at mobile widths — single column, centred, padding reduces to 40px 16px.

---

## Risks and Open Questions

- **Contacts list and the onboarding checklist:** when the user has no contacts, both the empty state and the onboarding checklist would appear simultaneously. Resolve by showing only the onboarding checklist when it is active (not dismissed, not completed) — the checklist already points to the first action. Show the standalone empty state only when the onboarding is dismissed or completed.
