# 10 — Activity Log & Source UI

**Surfaces:**
- **Source badge** + **"Last edited by" line** — contact detail left rail (`/contacts/[id]`)
- **History tab** — per-contact activity feed (`/contacts/[id]`, History tab)
- **Global activity feed** — workspace Activity tab (`/?tab=activity`, Pro-gated)
- **Bulk-merge confirmation dialog** + **Merged-contacts section** — Duplicates tab (`/?tab=duplicates`)

**Priority:** P2 — trust & transparency layer. Source/history don't sell the product on their own, but they're what makes Kontax feel *safe* to sync, import, and share: the user can always see where a contact came from and what changed it.

> **Note for the designer:** these features are already shipped (Phase 10). This brief documents the **real, implemented behaviour and data** so you can produce high-fidelity mockups that match — then refine the visual layer. Treat the data vocabulary (source types, event types, actors) as fixed; treat spacing, colour, and iconography as yours to polish within the locked design language.

---

## Design language (aligned with the rebuilt contacts list & contact detail)

Same system as briefs 01 and 02. Key tokens:

- **Ink** `#1d2823` · **Secondary** `#5c655e` · **Muted** `#8b938c` · **Hairline** `#d8ddd6` / soft `#edf0ea`
- **Brand green** `#17352e` · soft green wash `#e7efe9` · **Blue CTA/link** `#4158f4`
- **Amber** `#bf8526` (warnings/badges) · **Red** `#b5472f` (destructive / removed values)
- Surfaces: white cards on `#f2f4f0` hover; rounded `1.2rem` cards, `#d8ddd6` borders.
- Font: **Geist**. Meta labels: 11–12px, uppercase, wide tracking, muted.
- **Diff colour pair:** removed/before = red `#b5472f`; added/after = green `#2f7d5b`, with a muted `→` between.

All four surfaces share one **actor-icon + event-glyph** vocabulary (below). The same event must look identical in the per-contact History tab and the global feed.

---

## Shared vocabulary (fixed — do not rename)

### Source types (`sourceType`) — where a contact *originated*
A contact has exactly one source, set once at creation.

| `sourceType` | Badge text (with detail) | Glyph |
|---|---|---|
| `MANUAL` | "Added manually" | person |
| `IMPORT_CSV` | "Imported from contacts.csv" | up-tray / import |
| `SYNC_CARDDAV` | "Synced from iCloud" | cloud / sync |
| `SHARED_STATIC` | "Shared by Daniel Vega" | arrow-into-box (received copy) |
| `SHARED_LIVE` | "Live from Daniel Vega" | live dot / broadcast |
| `API` | "Added via API" | gear / code |

### Actors (`actor`) — *who/what* performed an event
| `actor` | Label | Glyph |
|---|---|---|
| `USER` | "you" | person |
| `SYNC` | "iCloud sync" | cloud/sync |
| `IMPORT` | "an import" | up-tray |
| `SHARE` | "a share" | arrow-into-box |
| `FAMILY_MEMBER` / `TEAM_MEMBER` | "[member name]" | person (in circle) |
| `SYSTEM` | "Kontax" | gear |

### Event types (`eventType`) — the timeline vocabulary
Grouped into the **five feed categories** (used by filters):

- **Edits** — `CONTACT_CREATED` · `CONTACT_UPDATED` (N fields) · `CONTACT_ARCHIVED` · `CONTACT_RESTORED` · `CONTACT_DELETED`
- **Sync** — `SYNC_PULLED` · `SYNC_PUSHED` · `SYNC_CONFLICT_DETECTED` · `SYNC_CONFLICT_RESOLVED`
- **Imports** — `CONTACT_IMPORTED`
- **Merges** — `CONTACT_MERGED` · `CONTACT_MERGE_UNDONE`
- **Shares** — `CONTACT_SHARED` (sent — arrow-**out**) · `CONTACT_SHARE_RECEIVED` (received — arrow-**in**)

> **Icon-set completeness (from the ticket risk note):** the glyph set must distinguish, at minimum: manual (person), CSV import (up-tray), CardDAV sync (cloud), **share received (arrow-in)** vs **share sent (arrow-out)** — these are two different directions and must not share one glyph — API (gear/code), and system (gear). Deliver these as one coherent line-icon family (1.5–1.7px stroke, ~16–18px).

---

## 1. Source badge (contact detail, left rail)

A quiet, **non-interactive** chip directly under the name/title/birthday block in the left rail. Every contact has a source, so it **always renders** (never hidden, never a placeholder).

- **Layout:** pill, `icon + text`, ~12px text, muted. Sits in the badge cluster but reads as informational, not a status badge.
- **Content:** `formatSourceBadge(sourceType, sourceDetail)` text + the source glyph from the table above.
- **States:**
  - *Default:* always shown. No hover affordance (not a link, not clickable).
  - *Long detail:* truncate the detail with ellipsis; full text on `title`/tooltip.
- **Ordering within the badge cluster:** the source chip sits **last**, after sharing (Family/Team/Live) and Emergency chips (per brief 02). It is the calmest chip in the cluster.

> The current implementation styles this as white-on-translucent (legacy). **Restyle to the light palette**: soft neutral surface (`#f2f4f0`), muted text/icon, `#d8ddd6` hairline.

---

## 2. "Last edited by" line (contact detail, metadata block)

A one-line meta row in the left-rail metadata stack (alongside Added / Modified / UID).

- **Format:** `Last edited` (muted label, left) · `{who} · {relative time}` (right). E.g. "Last edited · you · 2h ago", "Last edited · iCloud sync · yesterday", "Last edited · Marcus Lee · 2h ago" (in a shared book).
- **`{who}`** comes from `formatLastMutatedBy(lastMutatedBy, lastMutatedByDetail)`; in a shared book the editing member's name wins.
- **Style:** same 12px meta treatment as the other metadata rows; no icon required (keep the metadata block clean), or a tiny actor glyph if it helps scannability — designer's call.
- **States:** always shown (every contact has been mutated at least once — creation). No empty state.

---

## 3. History tab (per-contact activity feed)

The right pane of the contact detail has a tab bar **Details · Sharing · History** (see brief 02). The History panel is the per-contact timeline. **Available on all plans** (no Pro gate on per-contact history — only the *global* feed is gated).

### Event row (the core unit — shared with the global feed)
```
┌──────────────────────────────────────────────────────────────┐
│  (◯ actor   {summary}                                  2h ago │
│   glyph)    {actor label}                                     │
│             ▸ View 3 changes                                  │
└──────────────────────────────────────────────────────────────┘
```
- **Left:** actor glyph in a 28px circle (`#f2f4f0` bg, muted icon).
- **Body:** `summary` (e.g. "Updated 3 fields", "Synced from iCloud", "Merged with Adriana C.") in ink; **actor label** beneath in muted 12px.
- **Right:** relative time (muted), with absolute timestamp on hover/tooltip.
- **Diff disclosure:** for `CONTACT_UPDATED` (and sync/merge events carrying field diffs), a "View N changes" link (blue). The summary count comes from the payload's `diffs` array.

### Diff expansion (expanded state)
When expanded, each changed field is a two-column row:
```
Phone        +44 7700 900111  →  +44 7700 900999
Company      —                →  Northwind Studio
```
- Field label (muted, ~120px column) · before (red, strike optional) `→` after (green).
- `—` represents an empty/absent value. Long values truncate at ~80 chars with ellipsis.

### Actor / event glyph mapping
Use the shared vocabulary. Notable summaries to mock:
- Created · Updated (N fields) · Archived / Restored · Deleted
- Merged with [name] · Merge undone
- Imported from [file] · Synced from [account] · Pushed to [account]
- Conflict detected / Conflict resolved
- Shared with [recipient] (arrow-out) · Shared with you by [sender] (arrow-in)

### States (mock all of them)
- **Loading:** 5–6 shimmer rows (circle + two bars).
- **Empty:** "History starts from [date]" with a calm icon; subtext "Changes made before this date aren't recorded. New changes appear here going forward." (History began when the activity log shipped — pre-existing contacts have no back-history.)
- **Error:** "Couldn't load history." + a **Retry** button.
- **Pagination:** "Load more" button (cursor-based) when older events exist; "— No older history —" when exhausted.
- **Hover:** expandable rows highlight on hover; non-expandable rows don't (no false affordance).

---

## 4. Global activity feed (workspace Activity tab — Pro)

A top-level **Activity** tab in the workspace sidebar (after Duplicates; clock glyph). Shows **all** of the user's events across every contact, newest first. **Pro-gated.**

### Layout (desktop ≥ 1280px)
Lives in the main content area inside the persistent shell (same shell as the list). No sort/view toolbar — the feed owns its own filter bar.

```
┌─────────────────────────────────────────────────────────────┐
│  [All][Edits][Sync][Imports][Merges][Shares]   [Anyone][You][Sync][Import][Shared] │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ◯  Adriana Castellanos  updated 3 fields      2h ago │  │
│  │     Marcus Lee · ▸ View 3 changes                    │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  ◯  Daniel Vega  synced from iCloud           yesterday │ │
│  │     iCloud sync                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                    [ Load more ]                            │
└─────────────────────────────────────────────────────────────┘
```

### Filter bar
- **Two chip rows** (or one wrapped row): **category** (All · Edits · Sync · Imports · Merges · Shares) and **actor** (Anyone · You · Sync · Import · Shared).
- Active chip = filled brand green (`#17352e`, white text); inactive = `#f2f4f0` muted, hover `#e7efe9`.
- Filters combine (category AND actor). Changing a filter resets the feed to the top.

### Event row
Same row as the History tab **plus the contact name as a prefix**, linked to that contact's detail (`/contacts/[id]`). When the contact was hard-deleted (`contactId` null), show the name in muted, non-linked text ("Deleted contact").

### States (mock all of them)
- **Loading:** shimmer rows.
- **Empty (no activity at all):** "No activity yet" + "Edits, syncs, imports, merges, and shares from the last 90 days show up here."
- **Empty per filter combination:** "No activity matches these filters" + "Try a different category or actor." (distinct from the no-activity-at-all state — the filter chips stay visible so the user can clear them).
- **Error:** "Couldn't load activity." + Retry.
- **End of list:** "— Showing the last 90 days —" (retention boundary; see below).
- **Pagination:** cursor-based "Load more".

### Pro-gated / locked state (Free users)
Free users never see the feed — they see a **locked upsell** in the Activity tab content area:
- Centered card: clock icon in a green-wash circle, heading **"Activity log is a Pro feature"**, body explaining the value ("See every edit, sync, import, merge, and share across all your contacts in one timeline — with 90 days of history and filters."), and a primary **"Upgrade to Pro"** button (blue) → `/settings`.
- Mention the user's current plan ("You're on the Free plan.").
- **Important:** locked state, *not* an empty feed. The tab is always visible in the nav; the gate is on the content.

### Retention
- **90 days** for Pro. The feed only shows events within the trailing 90-day window; the footer states this. (Design can note that higher future tiers may extend retention, but mock 90 days.)

---

## 5. Bulk-merge confirmation dialog (Duplicates tab)

Triggered by the **"Accept all N high-confidence"** button in the Duplicates toolbar.

- **Modal** centered over a dimmed backdrop (`rgba(20,30,25,0.4)`).
- **Title:** "Merge N duplicate pairs?"
- **Body:** "These are all high-confidence matches. Each pair will be merged, keeping the contact that was added first. You can undo any of them afterwards."
- *(Optional enhancement to mock):* a scrollable **summary list of the pairs** ("Adriana C. ← Adriana Castellanos", …) so the user sees exactly what's about to merge. Cap the visible list (e.g. 6) with "+N more".
- **Actions:** secondary **Cancel** (left/ghost) · primary **"Merge N pairs"** (brand green).
- **States:** default; (optional) in-progress/disabled while the bulk action runs.

---

## 6. Merged-contacts section (Duplicates tab)

Below the open suggestions, a **"Merged contacts"** section listing recently merged pairs, each undoable for **30 days**.

### Pair row
```
┌──────────────────────────────────────────────────────────────┐
│  Adriana Castellanos  ←  Adriana C.        12 Jun 2026  [Undo] │
│  (survivor, linked)       (absorbed)        · bulk             │
└──────────────────────────────────────────────────────────────┘
```
- **Survivor name** (linked to `/contacts/[id]`) · muted `←` · **absorbed name**.
- Meta line: merge date; append "· bulk" when it came from bulk-accept.
- **Right:** **Undo** button (within 30 days) **or** muted "Expired" label (after 30 days).

### Undo confirmation
Clicking Undo opens a confirm dialog:
- **Title:** "Undo this merge?"
- **Body:** "This restores the absorbed contact as a separate record, reverts the surviving contact to its pre-merge state, and re-opens the duplicate suggestion."
- **Actions:** Cancel · primary **"Undo merge"**.

### States (mock all)
- Section hidden when there are no recent merges.
- Row with **Undo** available (≤ 30 days) vs **Expired** (> 30 days).
- Hover on row; hover on Undo button.

---

## Interaction & accessibility notes

- **One glyph family** across all four surfaces — an event must look the same in the History tab and the global feed.
- **Time:** always relative on the surface (2h ago, yesterday, 12 Jun), absolute on hover/tooltip.
- **Diffs:** colour is not the only signal — keep the `→` and before/after order so red/green isn't load-bearing for colour-blind users.
- **Links:** contact names in the global feed are the only interactive text in a row; the rest of the row is static (no whole-row link, to avoid swallowing the diff disclosure and name link).
- **Empty vs filtered-empty vs locked vs error** are four distinct states — mock each; do not collapse them.
- **Loading** uses shimmer rows, not spinners, to preserve layout height.

---

## Deliverables checklist for the designer

- [ ] Source badge — all 6 source types, light-palette restyle, long-detail truncation
- [ ] "Last edited by" line — you / sync / import / share / member variants
- [ ] History tab — row, expanded diff, loading, empty, error, load-more, exhausted
- [ ] Global feed — filter bar (active/inactive chips), row with linked contact name, all empty/error/loading/end states
- [ ] Global feed — **Pro locked** upsell state
- [ ] Bulk-merge confirm dialog (+ optional pair summary list)
- [ ] Merged-contacts section — undo row, expired row, undo confirmation dialog
- [ ] One unified event/actor/source **icon set** (incl. share-in vs share-out, API, system)
- [ ] All states at desktop ≥1280, with notes for tablet/mobile reflow
