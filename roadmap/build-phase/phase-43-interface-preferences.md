# Phase 43 — Device-Aware Interface Preferences

> **Mini-phase, sequenced after Phase 38.** Users should be able to tune how
> quiet or rich the interface is per device class — e.g. desktop rows showing
> label chips always, on hover, or not at all. This is a **display/taste
> preference** (Gmail-density-style), *not* a performance remedy: the default
> experience must be fast for everyone, and Phase 38 owns that. A measurement
> gate at the end of P38 (P43-00) confirms the framing before design starts.
> Builds directly on the P34B-01 preferences foundation (`User.preferences`
> Json, `UserPreferences` type, `/settings/preferences` page) — no new schema.

## Phase status
Pre-plan · gated on Phase 38 exit (P43-00 runs first)

## Phase objective
Add an "Interface" group to Settings → Preferences where users control row
richness per device class, defaulting to the current behaviour. v1 is
deliberately small — two knobs (labels-on-rows, animations) — because every
preference is a permanent QA-matrix tax; more knobs only if users ask.
Toggling an effect off still genuinely removes the work (listeners, DOM), not
just hides it — that's implementation hygiene, not the selling point.

## Tickets

| Ticket | Title | Priority | Depends on |
| --- | --- | --- | --- |
| [P43-00](p43-00-post-p38-measurement-gate.md) | Post-P38 measurement gate & framing decision | P0 | Phase 38 exit |
| [P43-DB01](p43-db01-design-brief-interface-preferences.md) | Design brief: interface preferences & device scoping | P0 | P43-00 |
| [P43-01](p43-01-interface-preferences.md) | Interface preferences — settings UI + row/hover enforcement | P1 | P43-DB01 |

## Success criteria
- P43-00's numbers are recorded and the framing decision is written into the
  brief before any design or build work starts.
- A desktop user can switch label chips between always / on hover / off; the
  choice persists across sessions and applies on any desktop-class device.
- Mobile is unaffected by desktop-only toggles and vice versa; touch devices
  never see hover-dependent options.
- `prefers-reduced-motion` is respected as the default for motion-related
  effects without the user configuring anything.
- No preference copy claims a performance benefit unless P43-00 measured one.

## Exit criteria
- P43-01 verified at desktop + real mobile device.
- docs updated: preferences model note (device-class scoping convention) so
  future prefs follow the same shape.

## Documentation (per roadmap/documentation-policy.md)
- [ ] External · users — in-app Help: interface preferences
- [ ] Internal · engineering — preferences-shared.ts conventions comment /
      docs note on device-class scoping
