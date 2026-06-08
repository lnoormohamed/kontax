# P14-08 Design Brief: Teams Plan Surfaces

## Purpose
This ticket is a design brief for the product designer responsible for the Teams plan visual language. It does not contain implementation code. Instead, it describes the product surfaces, interaction patterns, key states, and design principles that the designer must produce assets for — from the team creation onboarding through the workspace, management page, permission matrix, and audit log. The engineer implementing P14-07 will build against the designs produced from this brief.

## Background
Kontax's existing visual design (Phases 1–13) is a consumer-grade contacts app: clean, minimal, whitespace-rich, and approachable. The Teams plan serves a different user archetype — a team admin, office manager, or operations lead who manages shared contact databases for a small business or team. These users are comfortable with denser information, expect table-based layouts, and prioritize trust and reliability over consumer-grade friendliness. The design language for Teams surfaces should evolve from the existing consumer style toward a professional, density-tolerant aesthetic, while staying in the same design system.

## Scope

### In scope
- Team creation onboarding flow.
- Workspace: private + family + team sections, book badges on contact rows, empty states.
- Address book tab/section within the workspace: contact list, filter controls, add/import actions, read-only states.
- Team management page: Members, Address Books, Sync Accounts, Audit Log tabs.
- Per-book permission matrix (admin view).
- Audit log: filter bar, event row, diff expansion, CSV export button.
- Admin vs member view differentiation throughout.
- User with simultaneous Family + Team membership.
- Empty states for all new surfaces.
- Mobile-responsive workspace sidebar (Teams is primarily desktop but sidebar must work at 768px).

### Out of scope
- Billing/paywall screens for upgrading to Teams — handled by billing team.
- CardDAV connect-device instructions — P14-09.
- Email templates — separate design system.
- Native mobile app — out of Phase 14 scope.

## Design / Implementation Spec

### 1. Design Principles for Teams Surfaces

#### 1.1 Professional and Trust-Inspiring
Teams data is often business-critical. The design must signal reliability: consistent spacing, no decorative clutter, precise typography, and clear affordances for destructive actions (confirmation dialogs, not just undo).

#### 1.2 Role-Sensitive Without Being Confusing
The same page (e.g., Address Books tab) looks different for an ADMIN and a MEMBER. The difference should be obvious from context — admins see action buttons, members see read-only indicators — without requiring users to navigate to a "your permissions" page to understand what they can do.

#### 1.3 Density Tolerance
Teams users manage more information (multiple books, 25 members, permission matrices, audit events). The design must support higher information density than personal Kontax views. Use tighter vertical rhythm in list rows (reduce row height from consumer default), compact table cells, and collapsible sections.

#### 1.4 Clear Data Provenance
A contact row in a team book must unambiguously communicate: "this contact is in the Clients book of Acme Corp." Contact rows in personal and team sections must never look identical — the team/book attribution must be visible at a glance.

#### 1.5 Safety for Destructive Actions
Archive, delete, remove member, and transfer ownership must have visually distinct confirmation flows. Use a "danger zone" pattern for the most destructive actions (delete book, transfer ownership, cancel subscription) — red borders, explicit text entry to confirm.

---

### 2. Team Creation Onboarding

#### 2.1 Entry Point
Settings > Subscription > "Upgrade to Teams" → Teams plan purchase → redirects to Team creation.

Or: Settings > Teams > "Create your team" (shown when user has Teams plan but no team yet).

#### 2.2 Team Creation Form
Full-screen centered card (not a modal — this is a meaningful moment):

```
[Kontax logo / Teams badge]

Create your team workspace

Team name  ________________________
           This will be visible to all team members.

[ Create Team ]

By creating a team, you agree to the Teams plan terms.
```

Clean, single-field form. "Teams badge" — a subtle icon or label in the header indicating this is a Teams plan feature. After creation, animate into a brief "success" state before redirecting.

#### 2.3 Post-Creation Welcome State
After team creation, the user lands on the team management page with a welcome banner:

```
🎉 Your team "Acme Corp" is ready!

Next steps:
1. [ Invite team members ]
2. [ Create more address books ]
3. [ Connect a CardDAV sync account ]

[ Dismiss ]
```

This is an inline banner (not a modal) that the user can dismiss. It does not appear on subsequent visits.

---

### 3. Workspace Design

#### 3.1 Sidebar Structure

The sidebar must communicate three distinct ownership levels simultaneously:

```
● My Contacts             [243]    Personal indicator (solid circle, blue)
▼ The Johnsons            [18]     Family indicator (family icon, green)
  └── Shared Contacts
▼ Acme Corp               [67]     Team indicator (building icon, orange/amber)
  ├── Main                [12]
  ├── Clients             [47]
  └── + New book                   (admin only, small, muted)
```

**Visual differentiation:**
- Personal section: blue accent, no icon (default).
- Family section: green accent, family/home icon.
- Team section: orange or amber accent, building/office icon.

The accent color must be consistent across the sidebar, contact row badges, and the management page header. This creates a "mental color map" — the user associates the color with the ownership level.

**Section headers:**
- Section name (bold, slightly larger than book entries).
- Contact count or member count.
- Collapse chevron (animated).
- Gear icon next to team name (links to management page).

**Book entries:**
- Book name (regular weight).
- Contact count.
- Active state: left-border highlight in the section's accent color.

#### 3.2 Contact Row in Team Books

Standard contact row (name, primary phone/email) plus:
- A tag/pill showing the book name in the team's accent color: `[Clients]` or `📁 Clients`.
- The tag is compact (max 80px wide, truncates with ellipsis).
- In a book-scoped view (user has selected the Clients book), the tag is redundant — hide it or show only the team name.

**Example (search results across sections):**
```
● John Doe                    📞 +1 (555) 123-4567    [Personal]
🏢 John Doe (Acme Corp)       📞 +1 (555) 987-6543    [Clients]
```

Search results from different sections must never be silently merged. Group by section with a section header.

#### 3.3 Empty States

| State | Illustration suggestion | Message |
|---|---|---|
| Team section, no books | Office building outline, empty | "Your team workspace is empty. Create an address book to get started." |
| Book selected, no contacts | Empty contacts icon | "No contacts in [Book Name] yet. Add a contact or import from a file." |
| Book selected, VIEW permission | Lock icon | "You have view-only access to [Book Name]. Contact your team admin to request edit access." |
| Team section, member not yet in any book | Person with question mark | "You don't have access to any address books yet. Ask your team admin." |
| Archived book selected | Archive box icon | "[Book Name] is archived. Contacts in this book are read-only." |

---

### 4. Address Book Tab / Section

The right panel when a team book is selected.

#### 4.1 Panel Header (ADMIN/OWNER view)
```
Clients                                [ 🔍 Search ] [ + Add Contact ]  [ ⋮ ]
Acme Corp · 47 contacts                             [ Import ]
```
⋮ dropdown: Rename book, Archive book, Export contacts, Manage permissions.

#### 4.2 Panel Header (MEMBER with EDIT view)
```
Clients                                [ 🔍 Search ] [ + Add Contact ]
Acme Corp · 47 contacts
```
No "Rename", "Archive", or "Manage permissions" actions.

#### 4.3 Panel Header (MEMBER with VIEW view)
```
Clients                                [ 🔍 Search ]
Acme Corp · 47 contacts · View only
```
No add, import, or management actions. "View only" label is prominent.

#### 4.4 Filter Controls
```
[ All contacts ▼ ] [ Added by: All ▼ ] [ Sort: Name ▼ ]
```
Filters are shown in a compact row below the header. The "Added by" filter shows member names (team members only, not personal).

---

### 5. Team Management Page

#### 5.1 Page Header
```
⚙ Team Settings

Acme Corp                              [ADMIN badge if acting as admin]
Teams plan · 12 of 25 members
```

A subtle page header with the team name, plan badge, and member count. The "ADMIN badge" is shown only to OWNER/ADMIN users.

#### 5.2 Tab Bar
```
[ Members · 12 ] [ Address Books · 3 ] [ Sync Accounts · 1 ] [ Audit Log ]
```
Count badges on Members and Address Books tabs show active counts. Sync Accounts shows linked account count.

Tabs that require admin access (Sync Accounts, Audit Log) appear slightly muted for MEMBER role with a lock icon, not hidden.

#### 5.3 Members Tab Design

**Member list row:**
```
[ Avatar ] Alice Smith     alice@acme.com    [OWNER]              Active    —
[ Avatar ] Bob Jones       bob@acme.com      [ADMIN]              Active    [···]
[ Avatar ] Carol Wu        carol@acme.com    [MEMBER]             Active    [···]
[ Avatar ] David Lee       david@acme.com    [MEMBER]  Pending    —         [···]
```

Role badges:
- OWNER: deep blue pill, no action menu.
- ADMIN: lighter blue or teal pill.
- MEMBER: grey pill.

Status:
- Active: no badge (active is the default state).
- Pending: orange "Pending" badge.
- Revoked: muted, struck-through row (keep visible for audit context).

Action menu [···] per row (contextual by acting user role):
- For ADMIN viewing a MEMBER: "Make Admin", "Remove from team".
- For OWNER viewing an ADMIN: "Make Member", "Remove from team".
- For OWNER viewing themselves: "Transfer Ownership" (moved to a dedicated section, not inline).

**Invite section:**
Below the member list, a prominent "+ Invite a team member" button (primary CTA for the tab). Inviting opens a slide-over panel (not a modal) from the right: allows inviting multiple people at once (add more email rows).

**Danger zone (OWNER only):**
At the bottom of the Members tab, a "Danger Zone" section (red border, collapsed by default):
```
▶ Transfer Ownership
  Change the team owner and billing anchor.
```
Expand reveals the transfer form.

#### 5.4 Address Books Tab Design

**Book list:**
Standard table layout:
```
Name        Contacts    Description              Status    Actions
Main        12          —                        Active    [ ··· ]
Clients     47          External clients         Active    [ ··· ]
Vendors      8          Partner orgs             Active    [ ··· ]
                                                 ────────────────────
Old Prspcts  3          Archived Q4 2025         Archived  [ Unarchive ] [ Delete ]
```

Active and archived books separated by a divider or section header.

Action menu [···] for active books (ADMIN/OWNER): Rename, Archive, Manage permissions.
For archived books (OWNER only): Unarchive, Delete.

**Per-book permission section:**
Clicking "Manage permissions" expands an inline panel below the book row (or navigates to a sub-page for large teams). Shows the permission matrix.

#### 5.5 Permission Matrix Design

For a book with ≤10 members, show the full matrix inline:

```
Permissions for Clients                        [ Reset all to EDIT ]

Member              Permission
──────────────────────────────
Alice Smith (Owner) EDIT (fixed)
Bob Jones    Admin  [ EDIT ▼ ]
Carol Wu     Member [ VIEW ▼ ]
Eve Turner   Member [ NONE ▼ ]
```

The OWNER row uses a lock icon and "fixed" label instead of a dropdown. Other rows use a compact Select component (EDIT | VIEW | NONE). Changes auto-save with a brief "Saved ✓" indicator on the row.

For teams with >10 members, show a paginated table with 10 rows per page.

**NONE permission visual**: a row with NONE permission should look distinctly "inactive" — grey out the member name and permission dropdown to signal "this person cannot see this book."

**"Reset all to EDIT"** button at the top-right: opens a confirmation popover: "Set all members to EDIT for [Book Name]? This will override all current permissions." Confirm button is red.

#### 5.6 Sync Accounts Tab Design

```
Sync Accounts

Google Workspace             Clients      ✓ Last synced 2h ago     [ Sync Now ] [ ··· ]
Nextcloud Contacts           Vendors      ⚠ Conflict · 2 contacts  [ Resolve ]  [ ··· ]

[ + Connect a CardDAV account ]
```

Sync status indicators:
- ✓ (green): Last sync successful.
- ⚠ (amber): Conflict requires attention.
- ✗ (red): Sync error — error message shown on hover.
- ↺ (blue spinner): Sync in progress.
- — (grey): Never synced.

Connect account button opens a slide-over panel from the right.

#### 5.7 Audit Log Tab Design

See P14-05 for the detailed query and filter spec. Design focus here:

**Filter bar:**
```
[ Member: All ▼ ] [ Book: All ▼ ] [ Type: All ▼ ] [ From: __ ] [ To: __ ] [ Reset ]
                                                                               [ Export CSV ]
```
Compact, single-row filter bar. All filters are select dropdowns or date pickers. "Export CSV" is a secondary button, right-aligned.

**Event row:**
```
[Avatar] Alice Smith · Clients        CONTACT UPDATED    Jun 8, 2026  2:32 PM
         "John Doe" — phone changed
         [ Show diff ▼ ]
```

- Avatar/initials with the section's accent color.
- Actor name and book context in a single line.
- Event type badge (see P14-05 color coding).
- Timestamp right-aligned.
- Short description below actor line.
- "Show diff" is a disclosure triangle — expands inline (not a modal).

**Diff expansion:**
```
▼ Hide diff
  ─────────────────────────────────────────
  phone[0].number
    Before: +1 (555) 123-4567
    After:  +1 (555) 987-6543
  ─────────────────────────────────────────
```

Clean monospace or code-like styling for the diff values. Use green/red background on changed values (optional — only if design system supports it without accessibility issues).

**Pagination:**
Cursor-based pagination presented as "Load more" button at the bottom of the list, not traditional page numbers. Show event count: "Showing 50 of 3,204 events. Load 50 more."

---

### 6. Admin vs Member View Summary

| Surface | OWNER/ADMIN sees | MEMBER sees |
|---|---|---|
| Workspace sidebar team section | All books + gear icon + "New book" | Only visible books (per permission) + gear icon |
| Book contact panel | Add/Import/More menu | Search only (if VIEW) or Add/Import (if EDIT) |
| Management page Members tab | Full member list + invite + role actions | Full member list, no actions |
| Management page Books tab | Book list + manage permissions | Book list, no actions |
| Management page Sync tab | Full sync management | "Admin access required" state |
| Management page Audit tab | Full audit log + export | "Admin access required" state |
| Permission matrix | Editable per-member dropdowns | Not shown |
| Danger zone (Members tab) | Visible (collapsed) | Hidden |

---

### 7. Simultaneous Family + Team Membership

A user with both a Family group and a Team must see:

**Sidebar:**
Three distinct sections, each with a different accent color and icon. The Family section must not be confused with the Team section. Consider:
- Family: green + people/home icon.
- Team: orange/amber + building icon.
- Both sections share the same sidebar hierarchy pattern (collapse/expand, sub-items for books).

**Contact rows in search:**
Results from personal contacts, the family book, and team books must be visually distinct. Use section labels and the accent colors to group results.

**Workspace breadcrumb:**
```
My Contacts > Search: "John"

My Contacts (3)
  ──────────────
  [result rows]

Family (1)
  The Johnsons — Shared Contacts
  ──────────────
  [result row]

Team (2)
  Acme Corp — Clients
  ──────────────
  [result rows]
```

---

### 8. Typography and Spacing Guidance

- Section headers: font-weight 600, 14px, letter-spacing 0.5px, all-caps (consistent with existing settings sections).
- Contact row (compact): 48px min height (vs 56px consumer default). Reduce vertical padding.
- Table rows (management page): 44px row height, 16px horizontal padding.
- Danger zone: red (#E53E3E or design system danger color) border, 8px border-radius, red heading, 12px padding.
- Badges (role, status): 12px font, 4px 8px padding, rounded-full.
- Permission matrix dropdown: compact select (28px height) to fit multiple rows in view.

---

### 9. Deliverables Required from Designer

1. **Team creation form** — desktop, full-screen centered state.
2. **Workspace sidebar** — all three sections visible (personal + family + team), collapsed state, expanded state.
3. **Workspace contact panel** — team book selected, EDIT permission view, VIEW permission view.
4. **Search results** — cross-section search showing three groups.
5. **Team management page** — all four tabs:
   - Members tab: active member list, pending member, invite modal/slide-over.
   - Address Books tab: book list, permission matrix expanded.
   - Sync Accounts tab: connected accounts, connect slide-over.
   - Audit Log tab: filter bar, event list, diff expanded.
6. **Empty states** — all states listed in Section 3.3.
7. **Permission matrix** — full matrix for 8 members × 3 books. NONE permission visual. Reset confirmation popover.
8. **Danger zone** — transfer ownership, delete book confirmation (with text entry).
9. **Role badges** — all three roles, all status states.
10. **Event type badges** — all six categories (CONTACT, ADDRESS_BOOK, MEMBER, IMPORT, SYNC, PERMISSIONS) with color coding.

## Acceptance Criteria

- [ ] Designs delivered for all 9 deliverable sets listed in Section 9.
- [ ] Admin and member views are clearly differentiated without requiring separate pages for each.
- [ ] Contact rows in team books have a visible book/team attribution tag.
- [ ] The workspace sidebar distinguishes personal, family, and team sections with distinct visual treatments.
- [ ] The permission matrix design accommodates up to 25 members × 20 books without UI breakdown.
- [ ] The audit log event row and diff expansion are designed.
- [ ] Destructive actions (delete, remove member, transfer ownership) have prominent confirmation designs with text-entry confirmation where specified.
- [ ] Empty states are designed for all surfaces.
- [ ] Designs are provided at 1x and 2x, mobile-responsive sidebar at 768px.
- [ ] Design tokens (colors, spacing) are documented in the design system file.
- [ ] Handoff annotations are complete for all interactive states (hover, active, disabled, loading).

## Risks and Open Questions

- **Color choice for accent system**: The existing design system may not have three distinct accent colors reserved for personal/family/team. The designer must check against existing palette and accessibility (4.5:1 contrast ratio for text on accent backgrounds). If the palette is too limited, a pattern/texture alternative (e.g., different icon shapes) may be needed.
- **Permission matrix for 25 members × 20 books**: A full matrix table (25 rows × 20 cols = 500 cells) is likely impractical. Explore alternatives: "view by book" (one book at a time, 25 rows) vs "view by member" (one member, 20 rows). Present both options to engineering for feedback.
- **Density vs accessibility**: Compact row heights (44–48px) may create small touch targets on tablet. Confirm minimum touch target size (48×48px recommended by WCAG). Adjust if needed.
- **Audit log diff for large diffs**: If a contact has 50 fields and all change in one import, the diff expansion could be very long. Design a "show first 5 changed fields, then 'show all'" pattern.
- **Role badge placement**: ADMIN badge in the workspace header (P14-07 spec) may feel intrusive. Consider making it only visible on the management page, not the workspace header.

## Outcome
The designer has a complete, unambiguous brief covering all Teams plan surfaces with sufficient detail to produce implementation-ready designs, ensuring the visual language correctly differentiates the professional Teams experience from the existing consumer product.
