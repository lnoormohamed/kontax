# P34-02 — Avatar fallback: truly empty contacts

## Purpose

When both `fullName` and `company` are blank or null, show a person-silhouette
icon centred inside the tinted disc instead of an empty circle. This is a visible
defect in production today.

## Background

After P34-01, the avatar fallback chain is: `fullName → company → ???`. The
"???" case — contacts imported with no name data, or contacts created as
placeholders — currently renders a plain tinted disc with nothing inside. There is
no visual affordance that it is a person at all. The fix is to render a
`WorkspaceIcon name="person"` glyph (already in the icon set at
`src/app/_components/workspace-icons.tsx`) centred in the disc, using a stable
hash input (`"?"`) so the tint is deterministic and consistent across page loads.

This ticket depends on P34-01 because it extends the same helper pattern
(primary → company → icon fallback).

## Scope

**In scope**
- In the four contact-avatar call sites updated in P34-01, add a third render
  branch: when both `primary` and `fallback` are empty after trim, render the
  `WorkspaceIcon` glyph instead of the initials string.
- The tint hash uses `"?"` as the stable seed — this produces a fixed colour for
  all truly-empty contacts (acceptable; they all look the same until named).
- Size: icon 16px (or `size={16}`) matching the existing `WorkspaceIcon` sizing
  convention in the codebase. Colour: `#aeb4ac` (the standard muted icon colour
  used throughout `search-results.tsx`).

**Out of scope**
- Rendering a generic grey disc with no tint (product decision: keep tint so
  empty contacts don't look completely unstyled next to named ones).
- Avatar changes for user-account contexts (settings, sidebar, app shell).
- Extracting a shared `ContactAvatar` component.

## Design / Implementation Spec

### Render logic in each ContactAvatar site

The avatar container (a `div` with absolute position and tinted background) already
renders the `getInitials` string as its child. Change each site to:

```tsx
const initials = getInitials(contact.fullName, contact.company); // from P34-01
const [bg, fg] = tintForName(contact.fullName, contact.company); // from P34-01
const isEmpty = initials === "";

// inside the avatar div:
{isEmpty ? (
  <WorkspaceIcon name="person" size={16} strokeWidth={1.6} style={{ color: "#aeb4ac" }} />
) : (
  <span style={{ color: fg }}>{initials}</span>
)}
```

Note: `WorkspaceIcon` is already imported in `search-results.tsx`. It must be
added to the import list in `contacts-workspace-table.tsx` and
`contacts/[id]/page.tsx` if not already present. Check with:
```
grep -n "WorkspaceIcon" src/app/_components/contacts-workspace-table.tsx
grep -n "WorkspaceIcon" src/app/contacts/\[id\]/page.tsx
```

### Tint seed for empty contacts

In `tintForName`, when both `primary` and `fallback` are empty after trim, use
`"?"` as the hash seed (rather than the empty string, which produces `charCodeAt`
of `undefined` = NaN in the current hash loop). Add a guard:

```ts
const src = primary?.trim() || fallback?.trim() || "?";
```

This is already the `"?"` guard proposed in P34-01, so P34-02 does not require
additional changes to `tintForName` itself — only the render branch changes.

### Affected files (same as P34-01)
- `src/app/_components/contacts-workspace-table.tsx`
- `src/app/_components/search-results.tsx`
- `src/app/contacts/[id]/page.tsx` (hero avatar + history inline avatar)

## Acceptance Criteria
- A contact with both `fullName = null` and `company = null` renders the person
  silhouette icon in the tinted disc — not an empty disc, not a broken element.
- The tint colour for all truly-empty contacts is the same fixed colour (hash
  seed `"?"`).
- The silhouette is centred vertically and horizontally within the disc.
- The above hold in: contacts list table, search results overlay, contact detail
  hero, and contact detail history list.
- Contacts with `fullName` populated are unaffected (P34-01 regression check
  still holds).
- No TypeScript errors introduced; `WorkspaceIcon` import added where needed.

## Risks / Open Questions
- If the existing `div` flex/grid centering already handles text centering, the
  icon will also be centred automatically — but confirm at the history inline
  avatar site in `contacts/[id]/page.tsx` (~line 743) where the avatar div may
  be sized differently.
- The `size={16}` value may need tuning per avatar size context (the history list
  uses a smaller disc than the hero). Verify visually at both sizes.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [ ] Internal · engineering — docs/: note avatar fallback chain (fullName →
      company → silhouette icon) in component/UI notes
