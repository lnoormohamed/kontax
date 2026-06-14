# P31B-DB12 — Design Brief: Labels (browse, filter, manage)

## Purpose

Specify the visual design and interactions to make **labels** a first-class
organizing primitive. Today labels can be *attached* (contact form + bulk "Add
label") but there is no way to *browse, filter, or manage* them — the sidebar
"Labels" section is a hardcoded placeholder. This brief covers the real sidebar
section, the label filter, the label management surface, and label chips.

See [`docs/organizing-contacts.md`](../../docs/organizing-contacts.md) for how
labels differ from books and lists: labels are a **cross-cutting, many-per-contact
tag** (the *data*); lists are *saved queries over* that data. Filtering by a
label should therefore be saveable as a smart list — that's the seam that ties
the two together.

## Background

`Contact.labels` is a JSON string array on the contact. There is no Label table,
so labels exist by being used. "Rename / recolor / delete a label" implies a
canonical registry of label names + colors at the user level — the brief should
land the model decision (lightweight per-user label registry vs. pure derived
list) with the build ticket.

The locked design language applies throughout. Reuse the smart-list / book
sidebar section styling (P28-DB09) for consistency.

## Scope

### In scope
1. **"Labels" sidebar section** — real, replacing the placeholder; lists the
   user's labels with a color dot and a contact count; active state on the
   filtered label.
2. **Filter by label** — clicking a label filters the contacts list to contacts
   carrying it (`?label=<name>`), integrated with the contact filter-state so it
   is **saveable as a smart list**.
3. **Label management** — rename, recolor, delete, and merge a label across all
   contacts that carry it; a small management surface (modal or settings panel).
4. **Label chips** — consistent chip rendering on contact rows and the contact
   detail page (color + name).
5. **Create-label affordance** — inline create from the sidebar and from the bulk
   "Add label" popover (already exists; align styling).

### Out of scope
- Nested / hierarchical labels.
- Shared labels across a family/team (personal only for v1).
- Auto-labeling / rules.

## Design / Implementation Spec

### Sidebar "Labels" section
- Same section header style as "My Lists" / "Books" (11px, 700, uppercase,
  `#8b938c`), with a "+ New label" action.
- Row: a color dot (8–9px, the label color) + name + count; hover reveals `⋯`
  (Rename / Recolor / Merge / Delete). Active label uses the green left-bar +
  tint like the smart-list active state.
- Replaces the current placeholder block in `contact-dashboard.tsx`.

### Filter by label
- Clicking a label navigates to `/contacts?label=<name>` and shows only matching
  contacts; the filter context bar shows a "Label: <name>" chip.
- `label` joins the existing filter-state keys (tab/filter/q/book/scope) so the
  "Save as list" flow captures it — a saved list can be "everyone tagged VIP".

### Label management
- Rename: updates the canonical name and every contact's `labels` entry.
- Recolor: a small palette (reuse the existing label color tokens —
  `#7aa37f / #8a93c8 / #c9a86a / #c98a8a`, extend as needed).
- Merge: fold label A into label B across all contacts (dedupe).
- Delete: removes the label from all contacts (confirmation; destructive).

### Color tokens
- Define the canonical label palette and how a new label is assigned a color
  (picked vs. auto from a rotating set). Keep within the locked system.

## Acceptance Criteria
- The sidebar shows the user's real labels with colors and counts.
- Clicking a label filters the list; the filter is saveable as a smart list.
- Rename / recolor / merge / delete operate across all tagged contacts.
- Label chips render consistently on rows and detail.
- No new colors outside the locked system.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (P26-12): "Organizing with labels" + how it differs from books/lists
- [ ] External · developers — /developers (only if labels are exposed via the API)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: update `organizing-contacts.md` (labels move from "half-built" to shipped; document the label registry model)
