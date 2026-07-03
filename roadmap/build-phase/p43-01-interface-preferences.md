# P43-01 — Interface preferences: settings UI + row/hover enforcement

Status: Not started · Priority: P1 · Depends: P43-DB01 (which depends on the
P43-00 measurement gate)

## Problem

Row richness is one-size-fits-all: label chips render on every desktop row
with no way to prefer quieter rows, and motion preferences beyond the OS
default aren't configurable. This is a display/taste preference
(Gmail-density-style) — performance is Phase 38's job, and P43-00 records the
measurement backing that framing.

## Change

Build to the P43-DB01 spec.

### 1. Extend the preferences model
- Add the Interface keys to `UserPreferences` + `DEFAULT_PREFERENCES`
  (`src/lib/preferences-shared.ts`) with the storage shape the brief landed
  (single value per key, device-class applicability at read time).
- Reuse `updatePreferences` (`src/server/preferences.ts`); no schema change —
  `User.preferences` is already Json.
- Add a resolver hook (client) that answers "is this effect enabled here?"
  from preference × device class (`hover: none` media query) ×
  `prefers-reduced-motion`. One hook, used by every consuming component, so
  future prefs don't re-implement the scoping logic.

### 2. Settings → Preferences: "Interface" card
- New section on `/settings/preferences` per the brief: grouped controls,
  device badges, disabled-with-explanation desktop-only rows on touch,
  optimistic apply matching `display-preferences-section.tsx` save semantics.

### 3. Enforce in the contacts table
- **Labels on rows:** on hover / always / off. "Off" skips rendering the
  chips entirely (implementation hygiene — remove the work, don't hide it
  with CSS). Payload-diet coupling with P38-01 is *not* in scope: rows keep
  receiving label data; render-skip only.
  **Label filtering is unaffected in every mode:** the `?label=` filter
  (P31B-03) is applied in the database query, and the sidebar Labels section
  and filter bar stay as they are — this preference only changes what rows
  display.
- **Animations:** gate transitions at the component level; "system" reads
  `prefers-reduced-motion`, explicit on/off overrides it.
- Keep the virtualized row cheap: the resolver must be a context read per
  table, not a per-row hook doing media-query work.
- Deferred (not in v1): quick-actions reveal mode, hover previews toggle,
  avatars vs initials.

### 4. Respect reduced motion by default
- "Animations: system" reads `prefers-reduced-motion`; explicit on/off
  overrides it. Audit the table + sidebar transitions that the setting gates.

## Acceptance
- Each Interface preference visibly changes the contacts list immediately and
  persists across reload and across browsers (same account).
- "Labels on rows: off" removes the chip elements from the row DOM (verify in
  the inspector, not just visually) — no dead listeners or hidden nodes left
  behind.
- With chips off, label filtering still works end-to-end: sidebar label click
  filters the list, the filter bar shows the context chip, and Save-as-list
  still captures the filter.
- On a real phone: desktop-only rows show as specified by the brief; no
  hover-dependent option has any effect; nothing regresses in the mobile list.
- `prefers-reduced-motion: reduce` with "system" selected disables the gated
  animations with no saved preference.
- Preferences round-trip through the existing settings save path (optimistic
  apply, error revert) — no new server action unless the brief demanded one.
