# P26-13 — Empty State Help Links

## Purpose

Enhance every major empty state with a short explanation and a direct link to the relevant `/help` section, replacing the "blank with CTA" pattern with "explain, then invite action." Users who understand what a feature does before attempting it have a much higher success rate.

## Background

P26-05 implemented the core empty states with a primary CTA. This ticket extends them with contextual help links — the `/help` page (P26-12) is now available and can be linked from each empty state. The design brief (P26-DB07) calls out that "each empty state should feel like an invitation, not a dead end."

This is a polish ticket with high activation impact and minimal implementation effort — it adds one or two lines to each existing `EmptyState` component call.

## Scope

**In scope:**
- Add a help link to each of the 4 primary empty states from P26-05: contacts list, activity log, sync connections, shared contacts
- Add help links to 4 settings page empty states: app passwords (no passwords yet), import history (no imports), export history placeholder, merge suggestions (no suggestions)
- Standardise the help link appearance: `font-size: 13px`, `color: #8b938c`, "Learn more about X →", links to `/help#{anchor}`

**Out of scope:**
- New empty states (all are implemented in P26-05)
- In-app tours or overlays

---

## Design / Implementation Spec

### Updated `EmptyState` component

Add an optional `helpLink` prop to the existing `EmptyState` component:

```tsx
interface EmptyStateProps {
  // ... existing props ...
  helpLink?: { label: string; href: string }; // NEW
}

// In the render:
{helpLink && (
  <Link href={helpLink.href} style={{
    fontSize: 13, color: "#8b938c", marginTop: 8,
    textDecoration: "none",
  }}>
    {helpLink.label} →
  </Link>
)}
```

### Updated empty state instances

**Contacts list (no contacts):**
```tsx
<EmptyState
  icon={UserPlus}
  headline="Your contacts will appear here"
  body="Import from Google or Apple, add one by one, or connect a sync account to get started."
  primaryCta={{ label: "Import contacts", href: "/import-export" }}
  secondaryCta={{ label: "Add manually", href: "/contacts/new" }}
  helpLink={{ label: "Learn about importing contacts", href: "/help#import" }}
/>
```

**Activity log (empty):**
```tsx
<EmptyState
  icon={Activity}
  headline="No activity yet"
  body="Every change to your contacts — edits, imports, syncs — is recorded here."
  primaryCta={{ label: "Add your first contact", href: "/contacts/new" }}
  helpLink={{ label: "Learn about the activity log", href: "/help#billing" }}
/>
```

**Sync connections (empty):**
```tsx
<EmptyState
  icon={RefreshCcw}
  headline="Connect your first sync account"
  body="Kontax connects to your existing contacts services via CardDAV — iCloud, Nextcloud, Fastmail, and more."
  primaryCta={{ label: "Connect an account", onClick: openAddAccountPanel }}
  helpLink={{ label: "What is CardDAV? Learn more", href: "/help#carddav" }}
/>
```

**Shared contacts (no shares):**
```tsx
<EmptyState
  icon={ArrowDownLeft}
  headline="Nothing shared with you yet"
  body="When someone shares a contact with you, it will appear here."
  helpLink={{ label: "Learn about contact sharing", href: "/help#sharing" }}
/>
```

**App passwords (Settings → Devices, none created):**
```tsx
<EmptyState
  icon={Key}
  headline="No app passwords yet"
  body="Create an app password to connect Kontax to your iPhone, iPad, or any CardDAV-compatible app."
  primaryCta={{ label: "Create app password", onClick: openCreateDialog }}
  helpLink={{ label: "How to connect your iPhone to Kontax", href: "/help#carddav" }}
/>
```

**Import history (no imports):**
```tsx
<EmptyState
  icon={Upload}
  headline="No imports yet"
  body="Import your contacts from Google, Apple, Outlook, or any CSV file."
  primaryCta={{ label: "Start an import", href: "/import-export" }}
  helpLink={{ label: "Supported import formats", href: "/help#import" }}
/>
```

**Merge suggestions (no duplicates):**
```tsx
<EmptyState
  icon={CheckCircle}
  headline="No duplicates found"
  body="Kontax checks for duplicate contacts automatically. You're all clear."
  helpLink={{ label: "How duplicate detection works", href: "/help#import" }}
/>
```

---

## Acceptance Criteria

- All 7 empty state instances above include the `helpLink` prop with correct href and label.
- Help links open the `/help` page at the correct anchor (verified by navigating to the anchor in a browser).
- The `helpLink` renders below the secondary CTA, in `#8b938c` 13px with "→" arrow.
- The `EmptyState` component prop is optional — existing usages without `helpLink` are unaffected.
- All help links navigate to existing anchors in the P26-12 `/help` page.
