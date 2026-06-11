# P21-DB04 Design Brief: Admin Dashboard

## Purpose

This brief specifies the visual design and interaction patterns for all admin surfaces in Phase 21. Admin UI prioritises clarity and density over aesthetics — admins need to scan data quickly and take confident actions on real user accounts.

## Background

Admin surfaces live under `/admin/**` and are accessible only to users with `role = ADMIN`. They use the same Kontax light palette as the main app but with a distinct admin chrome (sidebar with an "Admin" badge) so it is immediately obvious when an admin is in the admin section vs the normal app.

## Scope

### In scope

1. Admin layout shell (sidebar, header)
2. User search page
3. User detail panel — all sections
4. Platform metrics page
5. Feature flags management page
6. Audit log page
7. Action confirmation dialogs (suspend, delete, plan override, impersonation start)
8. Impersonation banner

### Out of scope

- Email templates (Phase 20 / DB-03)
- Normal user-facing UI

---

## Design / Implementation Spec

### 1. Admin Layout Shell

**Sidebar (240px wide, fixed):**
- Top: Kontax wordmark + "Admin" badge chip (red background, white text, 11px)
- Navigation links: Users, Metrics, Feature Flags, Audit Log
- Active link: left accent bar (4px blue), bold text
- Bottom: "Exit admin" link → returns to normal app

**Header bar (full width, 52px height):**
- Left: current page title
- Right: admin user's name + avatar

**Body:** `flex: 1`, padding 24px, light grey background (`#f4f4f5`).

---

### 2. User Search Page

Full-width search input at the top. Results table below.

**Results table columns:**
- Email (link to detail panel)
- Name
- Plan (pill: Free/Pro/Family/Teams with colour coding)
- Status (pill: Active/Grace/Locked)
- Joined date
- (Empty state: "No users found for '{query}'")

**Plan pill colours:**
- Free: gray-100, gray-600
- Pro: blue-50, blue-700
- Family: purple-50, purple-700
- Teams: green-50, green-700

---

### 3. User Detail Panel

Two-column layout on wide screens: left column (details), right column (actions).

**Left column sections:**

Account overview (card):
```
[Avatar 48px]  user@example.com
               John Smith
               Pro · Active  ●

Created: June 1, 2026
Last active: 2 hours ago
Email status: OK
```

Subscription (card):
```
Plan: Pro Monthly
Status: Active
Period ends: July 15, 2026
Cancel at period end: No
```

Usage (card with progress bars):
```
Contacts     423 / unlimited  ████░░░░░░
Sync accts   2 / 5            ████░░░░░░
App pwds     3 / 5            ██████░░░░
Imports/mo   Unlimited
```

Group membership (card, only if in a group):
```
Family group: Smith Family
Role: Owner
Members: 4 / 6
```

Recent activity (collapsible, shows 10 rows):
```
[icon] Contact "Jane Doe" updated  · 2 hours ago
[icon] Import completed (42 contacts) · Yesterday
```

Active sessions (collapsible, shows 5 rows):
```
Chrome on macOS · 91.108.4.5 · Active 2h ago
Safari on iPhone · 185.92.1.4 · Active 1d ago
```

**Right column (action panel):**

```
Actions
──────────────────────────────────

[Override plan]   (secondary button)
                  Current: Pro
                  ⚑ Overridden Jun 11 if applicable

[Suspend account]  (red outline button)

[Schedule deletion]  (red outline button)

[View as user]     (secondary — opens impersonation)
```

---

### 4. Platform Metrics Page

Single-column layout with stat cards grouped by category.

**Stat card:**
```
┌──────────────────────────────┐
│  1,247                       │
│  Total users                 │
│  ↑ 42 this week              │
└──────────────────────────────┘
```

Width: ~200px each, displayed in a responsive grid (3 per row on desktop).

**Plan breakdown:** horizontal bar chart showing Free/Pro/Family/Teams proportions. Each segment is labelled with count and percentage.

**Error rate indicators:** amber (warning) when failure rate 5-15%; red (critical) when > 15%.

---

### 5. Feature Flags Page

Table with toggle switches in the "Status" column. Clicking "Edit" opens a slide-over panel (not a modal — there are enough fields to warrant more space).

**Toggle states:**
- Off: gray toggle, "Disabled" label
- On for specific users: blue toggle, "N users" label
- On for all: green toggle, "All users" label
- Rollout: yellow toggle, "N%" label

---

### 6. Audit Log Page

Dense table, no cards. Paginated (50 rows per page).

**Columns:** Timestamp, Admin, Action, Target user, Details (truncated, expandable on click).

**Filter bar:** action type dropdown, date range picker, search by target user email.

**Row expand:** clicking a row shows the full `details` JSON in a monospace font block.

---

### 7. Confirmation Dialogs

All use the same 400px modal pattern. Destructive actions (suspend, delete) have a red primary button. Plan override has a blue primary button.

**Suspend confirmation:**
```
Suspend account?
This will immediately sign out the user and block all login.

Reason *
[                                        ]

[Cancel]  [Suspend account]  ← red
```

**Delete confirmation:**
```
Schedule account deletion?
The user will be permanently deleted in 30 days.

Reason *
[                                        ]

[Cancel]  [Schedule deletion]  ← red
```

**Plan override:**
```
Override plan
Select plan: [Pro ▾]
Reason *
[                                        ]

[Cancel]  [Apply override]  ← blue
```

---

### 8. Impersonation Banner

Pinned at the very top of the app (above the normal navigation), full-width, 44px height.

```
👁  Viewing as user@example.com (read-only)              [End impersonation ×]
```

Background: `#1e3a5f` (dark blue). Text: white. The [End impersonation] button is a white outline button.

---

## Acceptance Criteria

- Designer can produce all admin page mockups without a follow-up meeting.
- All table states are specified: empty, loading, error, populated.
- All confirmation dialog variants (suspend, delete, override) are specified.
- Action button states (loading, error, success) are specified for each action.
- Plan pill colours and status pill colours are specified with Tailwind token names.
- The impersonation banner is visually distinct from the rest of the UI.
