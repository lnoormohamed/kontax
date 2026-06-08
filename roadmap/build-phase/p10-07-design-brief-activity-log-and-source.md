# P10-07 Design Brief: Activity Log and Source UI

## Purpose
This ticket produces the design brief that the designer needs to create high-fidelity mockups for all new UI surfaces introduced by Phase 10. Without a thorough brief, the designer must make assumptions about layout, interaction patterns, and visual language that may conflict with engineering decisions already made in P10-04, P10-05, and P10-06. The brief is the single source of truth for what needs to be designed — it covers every component, every state (including edge cases), and every interactive transition. A complete brief eliminates back-and-forth between design and engineering during implementation.

## Background
Phase 10 introduces several new UI surfaces:
- Source badge on contact detail (P10-04)
- "Last updated by" line on contact detail (P10-04)
- History tab on contact detail (P10-04)
- Activity tab in the workspace (P10-06)
- Field-level merge review screen (P10-05)
- Bulk merge confirmation dialog (P10-05)
- "Merged contacts" section in duplicates tab (P10-05)
- Undo merge confirmation dialog (P10-05)

The design brief does not produce implementation code. It is a document for the designer. However, the brief must be specific enough that when designs are delivered, implementation can proceed without ambiguity. All interactive states must be specified: hover, focus, active, disabled, empty, loading, error, and any multi-step dialog states.

The existing Kontax visual system uses Tailwind CSS. The design language, color palette, and component patterns should be consistent with the existing app. The brief references the icon set in use (Lucide Icons) and the existing component library patterns.

## Scope

### In Scope
This brief covers the following components and all their states:
1. Source badge component
2. "Last updated by" line
3. History tab on contact detail
4. Global activity feed (Activity tab)
5. Bulk merge confirmation dialog
6. Undo merge confirmation dialog
7. "Merged contacts" section in duplicates tab
8. Field-level merge review screen
9. Actor icon set specification

### Out of Scope
- Visual design of the ActivityEvent data model or API (engineering concern)
- Color tokens or design system changes beyond what is needed for new components
- Mobile-specific layouts (Phase 10 is web-first)
- Dark mode variations (follow existing dark mode patterns)

## Design / Implementation Spec

This section is the brief content itself. All subsections below describe what the designer must specify.

---

### 1. Source Badge Component

**Purpose**: Shows where a contact originally came from. Appears once per contact on the contact detail header.

**Placement**: Below the contact's full name and above the first field section. Left-aligned with the field labels. On mobile, below the contact avatar.

**Visual spec:**

The badge is a small inline chip. It should feel informational but not prominent — it should not compete with the contact name or the edit button.

```
Dimensions:  Height 24px, padding 4px 8px, border-radius 12px
Typography:  12px / 0.75rem, medium weight (500)
Icon:        16x16px, left of text, 4px gap
```

**States per sourceType:**

| sourceType | Icon (Lucide) | Background | Text color | Label |
|---|---|---|---|---|
| MANUAL | `User` | gray-100 | gray-600 | "Added manually" |
| IMPORT_CSV | `FileText` | blue-50 | blue-700 | "Imported from {filename}" |
| SYNC_CARDDAV | `RefreshCcw` | purple-50 | purple-700 | "Synced from {label}" |
| SHARED_STATIC | `ArrowDownLeft` | green-50 | green-700 | "Shared by {name}" |
| SHARED_LIVE | `ArrowDownLeft` with pulse dot | teal-50 | teal-700 | "Live shared by {name}" |
| API | `Code2` | orange-50 | orange-700 | "Added via API" |

**Fallback labels** (when sourceDetail is null):
- IMPORT_CSV: "Imported from file"
- SYNC_CARDDAV: "Synced via CardDAV"
- SHARED_STATIC: "Received via share"
- SHARED_LIVE: "Received via live share"

**SHARED_LIVE pulse indicator**: A 6px dot with an animated pulse (CSS animation: scale 1→1.4→1 at 1.5s interval) to indicate the contact is live-synced.

**Interaction**: The badge is not clickable in Phase 10. No hover state required. Future: clicking could navigate to the sync account settings.

**Overflow handling**: If the filename in sourceDetail is longer than 30 characters, truncate with ellipsis. Full filename on hover via native `title` attribute (not a custom tooltip).

**Dark mode**: Use dark-mode variants of the color pairs: dark:bg-gray-800 / dark:text-gray-400 for MANUAL, etc.

---

### 2. "Last Updated By" Line

**Purpose**: Shows who most recently changed the contact and when.

**Placement**: Immediately below the source badge, above the field sections.

**Visual spec:**

```
[SmallActorIcon] Last updated by [actorLabel] · [relativeTime]

Icon:      14x14px
Font:      12px, regular weight (400), muted color (gray-500 / dark:gray-400)
Gap:       4px between icon and text
```

**Actor icons for this line** (14px, muted color):

| actor | Icon (Lucide) |
|---|---|
| MANUAL | `User` |
| SYNC_CARDDAV | `RefreshCcw` |
| IMPORT_CSV | `FileText` |
| SHARED_STATIC / SHARED_LIVE | `ArrowDownLeft` |
| API | `Code2` |
| SYSTEM | `Settings` |

**Relative time format:**
- < 1 minute: "Just now"
- 1–59 minutes: "N minutes ago" (or "1 minute ago")
- 1–23 hours: "N hours ago"
- Yesterday: "Yesterday"
- 2–6 days: "N days ago"
- 7+ days: absolute date in locale format ("Jun 3, 2025")

**Absolute timestamp tooltip**: On hover over the relative time text, show an absolute timestamp in a standard tooltip: "Monday, June 3, 2025 at 14:32". Use native `title` attribute or a lightweight tooltip.

**Spacing**: 4px vertical gap above this line (from source badge) and 12px below (before field sections).

---

### 3. History Tab on Contact Detail

**Purpose**: Full per-contact change history, reverse-chronological.

**Placement**: A tab alongside the existing contact detail tabs. Suggest tabs: "Details" | "History". The "Details" tab is the current contact detail view. "History" is new.

#### 3a. Tab Bar Design

```
[Details]  [History]
```

Active tab: bottom border accent color (2px), full-opacity label.
Inactive tab: no border, muted label.
Tab bar: full-width, border-bottom separator below tabs.

#### 3b. Event Row Layout

Each row: 44px minimum height, full width.

```
[ActorIcon 20px]  [Summary text]                   [RelativeTime 12px muted]
                  [Expand toggle — only for diffs]
```

**Columns:**
- Actor icon column: 32px wide, icon centered
- Summary column: flex-1, truncated if needed with ellipsis
- Time column: right-aligned, min-width 80px

**Separator**: 1px border-bottom between rows, except the last row. Color: gray-100 / dark:gray-800.

**Hover state**: Entire row background changes to gray-50 / dark:gray-900.

**Expandable rows**: Only CONTACT_UPDATED and SYNC_PULLED rows with diffs have an expand toggle.
- Toggle: `ChevronDown` icon (14px) at the far right, rotating 180° on expand
- On expand: row height expands to show the field diff panel below the summary
- Toggle is keyboard focusable (Tab key) and togglable via Enter/Space

#### 3c. Actor Icons for History Tab

20px icons, colored by actor category:

| Actor | Icon | Color |
|---|---|---|
| USER | `User` | gray-600 |
| SYNC | `RefreshCcw` | purple-500 |
| IMPORT | `Upload` | blue-500 |
| SHARE | `ArrowDownLeft` | green-500 |
| SYSTEM | `Settings` | gray-400 |
| FAMILY_MEMBER | `Users` | teal-500 |
| TEAM_MEMBER | `Briefcase` | indigo-500 |

**Actor icon wrapper**: 28px circle, background 10% opacity of the icon color. E.g., USER gets gray circle (gray-100), SYNC gets purple-50 circle.

#### 3d. Field Diff Expansion Panel

Shown inside the expanded event row, below the summary.

```
  ┌─────────────────────────────────────────┐
  │ Field           Before        →  After   │
  │ First name      Jon              John    │
  │ Phone numbers   555-1234         —       │
  │                 (removed)                │
  └─────────────────────────────────────────┘
```

Visual design:
- Indented 32px from the left (aligns with summary text, not with actor icon)
- Background: gray-50 / dark:gray-900, rounded-md
- 3 columns: Field name (30%), Before value (33%), After value (33%) + arrow between
- Before value: muted text (gray-500). If null/removed: em-dash "—" in muted italic
- After value: default text weight. If null/removed: em-dash in muted italic
- Arrow: `ArrowRight` icon (12px) between Before and After columns, color gray-400
- Long values: truncate at 60 chars with ellipsis. Full value on hover (title attribute)

For multi-value fields (phoneNumbers, emailAddresses):
- Before: list of values, comma-separated or stacked vertically if > 2 items
- After: same format

#### 3e. Empty State (No Events)

```
      [ClockIcon 40px gray-300]
      
      History starts from [date]
      
      Changes made before this date aren't recorded.
      You'll see new changes here as you make them.
```

Typography: "History starts from [date]" in 14px medium weight. Secondary text in 12px muted.
Date format: "June 3, 2025" (no time component).
Vertical centering within the tab panel. Horizontal centering.

#### 3f. Loading State

Show 5 skeleton rows while loading. Each skeleton row:
- Actor icon: 28px circle skeleton (gray-200 animated pulse)
- Summary: 60% width bar, height 12px, gray-200 animated pulse
- Time: 20% width bar, height 12px, gray-200 animated pulse

CSS animation: `animate-pulse` (Tailwind), opacity alternating 100%→50%→100% at 1.5s.

#### 3g. Error State

```
      [AlertCircle icon 32px red-400]
      
      Couldn't load history
      
      [Try again]  (button, secondary style)
```

Centered within tab panel. "Try again" button triggers a re-fetch.

#### 3h. "Load More" Footer

When `hasMore` is true:

```
                [Load older history ↓]
```

Button style: text button, gray-600, no background, centered.
Loading state: spinner replaces arrow: "[Loading…]"
When no more events: show "— Beginning of history —" centered in gray-400 text (no button).

---

### 4. Global Activity Feed (Activity Tab)

#### 4a. Activity Tab in Workspace Navigation

Add "Activity" to the workspace tab bar alongside People, Archived, Duplicates.

For Free users: add a `Lock` icon (14px) or a "Pro" badge chip after "Activity":
```
People  Archived  Duplicates  Activity [PRO badge]
```

"PRO" badge: 10px all-caps text, purple-600 background, white text, 2px 6px padding, border-radius 8px.

For Pro users: no badge, same styling as other tabs.

#### 4b. Locked State (Free Plan)

Full tab panel is replaced with the locked state. Centered vertically in the content area.

```
      [LockKeyhole icon 48px gray-300]
      
      Activity Log
      
      See everything that's happened across your contacts:
      edits, imports, syncs, and merges — all in one place.
      
      [Upgrade to Pro  →]
      
      Already included in your Pro plan.
      
      ─── Pro features: ───
      • 90-day activity history
      • Filter by event type, actor, and date
      • Track every sync and import
```

"Upgrade to Pro" button: primary style. Below the button, a brief features list with check icons.

**Background treatment**: Behind the locked content, show a blurred/faded preview of what the feed would look like (4–5 placeholder rows with blurred text). This creates anticipation without revealing real data.

#### 4c. Filter Bar

Full-width horizontal bar, above the feed, below the tab panel header.

```
[Category ▾]  [Actor ▾]  [Date range ▾]           12 events
```

Filter controls: each is a dropdown trigger button (28px height, small text 12px, light border).
Active filter: bold label, accent color border, close "×" icon to clear that filter.
Disabled state (no events in that category): option is grayed out in the dropdown.

Dropdown style: a popover below the trigger button, max-height 300px, scrollable.
Category dropdown options (with icons):
- All types (default)
- [Pencil] Edits
- [RefreshCcw] Sync activity
- [Upload] Imports
- [Merge] Merges
- [ArrowDownLeft] Shares

Date range popover: two inputs (From, To) with a calendar picker. Quick-select options above: Today, This week, This month, Last 30 days. Apply button in the popover.

Event count: right-aligned in the filter bar. "N events" in 12px muted text. "1,000+ events" when the count is large.

#### 4d. Global Feed Event Row

```
[ActorIconWrapper]  [ContactNameLink]  [Summary]           [RelativeTime]
```

- Height: 48px (slightly taller than per-contact history rows)
- Hover: gray-50 background, cursor pointer → navigate to contact
- ContactNameLink: truncated at 24 chars, blue-600 / dark:blue-400, no underline (underline on hover)
- Summary: gray-600, truncated at 60 chars
- RelativeTime: gray-400, 12px, right-aligned, min-width 80px

**Row for deleted contact** (contactId is null):
```
[ActorIconWrapper]  [Deleted contact]  [Summary]           [RelativeTime]
```
"[Deleted contact]" renders in gray-400 italic, not as a link.

**Loading state for filter changes**: Show 10 skeleton rows (same structure as per-contact history skeletons but 48px height).

#### 4e. Empty State — No Events at All

```
      [Activity icon 48px gray-300]
      
      No activity yet
      
      Changes to your contacts will appear here as you
      edit, import, sync, and merge.
```

#### 4f. Empty State — No Events Matching Filters

```
      [FilterX icon 40px gray-300]
      
      No events match your filters
      
      Try broadening your date range or removing some filters.
      
      [Clear all filters]  (text button)
```

#### 4g. Error State — Feed Load Failed

```
      [AlertCircle 32px red-400]
      
      Couldn't load activity
      
      [Retry]  (secondary button)
```

#### 4h. "Load More" and End of Feed

Same pattern as per-contact history:
- "Load more events ↓" text button when hasMore = true
- "— No more activity —" text when hasMore = false and events exist
- No message shown if the feed is empty (empty state already shown instead)

---

### 5. Field-Level Merge Review Screen

Replaces the current "keep left / keep right" merge screen.

#### 5a. Screen Layout

Full-page or large modal (designer's choice based on existing merge screen pattern).

```
┌─────────────────────────────────────────────────────────────┐
│  Merge Contacts                                     [×]     │
│                                                             │
│  ┌──────────────────┐     ┌──────────────────┐            │
│  │  John Smith      │     │  J. Smith        │            │
│  │  [source badge]  │     │  [source badge]  │            │
│  └──────────────────┘     └──────────────────┘            │
│                                                             │
│  IDENTICAL FIELDS (auto-merged)  ▲                         │
│  ─────────────────────────────                             │
│  ✓ First name: John                                        │
│  ✓ Email: john@acme.com                                    │
│                                                             │
│  CHOOSE FOR EACH FIELD                                      │
│  ─────────────────────────────                             │
│  Last name      [○ Smith]     [● Smyth]                    │
│  Phone numbers  [○ 555-1234]  [○ 555-5678]  [● Keep both] │
│  Company        [○ Acme]      [● Acme Corp]                │
│                                                             │
│  [Cancel]                               [Merge →]          │
└─────────────────────────────────────────────────────────────┘
```

#### 5b. Identical Fields Section

Collapsed by default. A "Show auto-merged fields (N)" disclosure that expands to show the list.

When expanded:
```
✓ First name      John
✓ Email           john@acme.com
✓ Birthday        March 15, 1990
```

Check icon in green-500. Field name in gray-500. Value in gray-700.

#### 5c. Field Choice Controls

Each differing scalar field:
```
[Field label]     [○] [left value]    [○] [right value]
```

Radio-button style selection. Selected option: filled dot, accent border, text at full opacity.
Unselected option: empty dot, neutral border, text at 70% opacity.

Each differing multi-value field:
```
[Field label]     [○] Use [Left]'s list
                  [○] Use [Right]'s list
                  [●] Keep all (merged)
```

"Keep all (merged)" is pre-selected for multi-value fields. Below this option, show the merged preview:
```
                  Preview: 555-1234, 555-5678
```

If merging would create a duplicate: show a dedup notice:
```
                  Preview: 555-1234 (duplicate removed)
```

#### 5d. Merge Button State

Disabled (grayed out, cursor not-allowed) when any non-auto-merged field has no selection.
Enabled: accent background, white text "Merge →".

Confirmation: on click, show a brief spinner/loading state on the button: "Merging…". On success, the modal closes and a toast: "Contacts merged. [Undo]" (the "Undo" action navigates to the merged contacts section).

#### 5e. "Why was this suggested?" Expandable (placeholder for P10-08)

At the top of the modal, below the header:
```
Why was this suggested?  ▶  (collapsed, gray-400 text, 12px)
```

When expanded (P10-08 will populate content — P10-07 specifies the empty state):
```
Why was this suggested?  ▼
  [signal detail panel — to be designed in P10-08]
```

The section must be present in the design but content is "TBD — P10-08 will define signal detail layout."

---

### 6. Bulk Merge Confirmation Dialog

Triggered by the "Bulk accept" button in the duplicates tab.

```
┌──────────────────────────────────────────────────┐
│  Merge {N} contact pairs?                        │
│                                                  │
│  These are all high-confidence matches. Each     │
│  pair will be merged automatically, keeping the  │
│  contact added first.                            │
│                                                  │
│  What will happen:                               │
│  • {N} contacts will be merged                  │
│  • {N} duplicates will be archived              │
│  • Each merge can be undone for 30 days         │
│                                                  │
│  [Cancel]          [Merge {N} pairs →]           │
└──────────────────────────────────────────────────┘
```

**Visual design:**
- Modal, 400px max-width
- Destructive confirmation style: "Merge N pairs →" button in accent color (not red — this is a helpful action, not a destructive one)
- "What will happen" section uses `Check` icons in green-500 for each bullet

**Loading state:** After clicking "Merge N pairs", the button changes to "Merging…" with a spinner. Do not close the dialog until the operation completes.

**Success state:** Close the dialog and show a toast notification:
```
✓ Merged {N} contact pairs  [View in Activity →]
```

If some merges fail:
```
Merged {N} of {total} pairs. {failed} could not be merged.
```

---

### 7. "Merged Contacts" Section in Duplicates Tab

Shown below the open suggestions list in the Duplicates tab.

```
Merged Contacts (12)  ▲
─────────────────────────────────────────────────────
John Smith  ←  J. Smith           Merged 3 days ago    [Undo]
Jane Doe  ←  Jane D.              Merged 1 week ago    [Undo]
Emily Chen  ←  Emily C.           Merged 2 weeks ago   [Undo]
Bob Wilson  ←  R. Wilson          Merged 25 days ago   [Undo]
Lisa Park  ←  L. Park             Merged 32 days ago   ——
─────────────────────────────────────────────────────
[Show all 12 merged contacts]
```

**Row design:**
- Height: 40px
- Left side: "[SurvivorName]  ←  [AbsorbedName]" — arrow icon between names (`ArrowLeft` 12px, gray-400)
- Right side: "Merged N days ago" in 12px gray-400, then Undo button or expiry indicator
- Undo button: text button style (no background), 12px, red-600 on hover, "Undo" label
- Expired row: "——" in place of Undo, gray-300 (indicates 30-day window has passed)

**Section header:**
- "Merged Contacts (N)" — collapsible section header, `ChevronDown` toggle, gray-700 bold 14px
- Default state: collapsed (expanded state available by clicking)

**"Show all" link**: Shows only the 5 most recent merges by default. If more exist, a "Show all N merged contacts" link expands the full list (inline — no modal).

---

### 8. Undo Merge Confirmation Dialog

```
┌──────────────────────────────────────────────────┐
│  Undo this merge?                                │
│                                                  │
│  This will:                                      │
│  • Restore "[AbsorbedName]" as a separate contact│
│  • Revert "[SurvivorName]" to its pre-merge state│
│  • Re-open the duplicate suggestion              │
│                                                  │
│  ⚠ Any edits made to [SurvivorName] after the   │
│  merge will be lost.                             │
│                                                  │
│  [Cancel]               [Undo merge]             │
└──────────────────────────────────────────────────┘
```

**Visual design:**
- Modal, 400px max-width
- Warning banner (⚠ text) in amber-50 background, amber-700 text
- "Undo merge" button in red-600 background, white text (this IS a destructive action)

**Loading state:** "Undoing…" with spinner on button.
**Success:** Close dialog and show toast: "✓ Merge undone. [AbsorbedName] has been restored."

---

### 9. Actor Icon Set Specification Summary

For reference, the complete actor icon set used across all Phase 10 UI surfaces:

| Context | Size | Icon | Color |
|---|---|---|---|
| Source badge | 16px | See §1 | Per sourceType |
| "Last updated by" line | 14px | See §2 | gray-500 muted |
| History tab event row | 20px in 28px wrapper | See §3c | Per actor |
| Global feed event row | 20px in 28px wrapper | Same as history | Per actor |
| Merge screen source badge | 16px | Same as §1 | Per sourceType |
| Merged contacts row | 12px | `ArrowLeft` | gray-400 |
| Bulk merge dialog bullets | 16px | `Check` | green-500 |
| Undo dialog warning | 16px | `AlertTriangle` | amber-600 |

All icons are from the Lucide icon library. Use the `lucide-react` package already present in the project.

---

## Acceptance Criteria

- Designer receives this brief and confirms all questions are answered without follow-up
- Brief covers all 8 component groups
- Every interactive state is specified for each component (hover, focus, loading, error, empty, disabled)
- Icon choices are specified for each actor type and each context
- Color tokens are specified using Tailwind class names
- Typography sizes and weights are specified
- Motion/animation is specified where applicable (pulse for SHARED_LIVE, collapse animation, expand animation)
- The brief is reviewed by at least one engineer before being handed to the designer to catch any technical inaccuracies
- Dark mode variants are specified for all new colors
- Overflow/truncation behavior is specified for all text-heavy elements
- The "Why was this suggested?" section in the merge modal is marked as a placeholder for P10-08 content

## Risks and Open Questions

- **Field-level merge screen size**: A contact with many differing fields could result in a very long merge screen. Specify a max-height with scroll for the field choice section — the identical fields section can remain collapsed to reduce initial height.
- **Source badge in merge screen**: Should both contacts' source badges be visible in the merge review screen? This adds valuable context (e.g., "keep the synced one's phone number because it's more recent") but also adds visual complexity. Include in the brief and let the designer decide placement.
- **Tab naming**: "History" tab on contact detail and "Activity" tab in workspace both show event feeds. Ensure the naming distinction is clear: "History" = per-contact, "Activity" = workspace-wide.
- **Merged contacts section collapse behavior**: If the section is collapsed by default, users may not discover the undo feature. Consider defaulting to expanded state when the section has recent (< 7 days) merges.
- **Bulk accept button placement**: The "Bulk accept" button could be placed at the top of the suggestions list or as a fixed action bar at the bottom of the screen. Specify both options and let the designer evaluate within the context of the existing duplicates tab layout.
- **Pro badge on Activity tab**: The "PRO" badge on the navigation tab may feel aggressive. Consider using a subtle lock icon instead. Brief should present both options for the designer to evaluate.

## Outcome

The designer has a complete, unambiguous brief covering every new UI surface in Phase 10 — all components, all states, all interactive behaviors — enabling delivery of high-fidelity designs without requiring clarification meetings.
