# P24B-DB19 — Design Brief: Contact edit (mobile)

## Purpose

Design the mobile **edit-contact** experience properly. P24B-07 shipped a create *sheet* but punted
edit back to the desktop-derived in-place `ContactInlineEditor` because the focused sheet didn't cover
the full field set. This brief defines a first-class mobile edit surface that covers every field.

## Background

Create on mobile is a bottom sheet (`MobileContactSheet`, collapsible sections, pinned Save). The
prototype's `EditSheet` (mob-sheet.jsx) is one sheet for **both** create and edit — so edit should
match. The blocker was field coverage: the inline editor handles a much larger schema. The full field
set to support (from `ContactInlineEditor`):

- **Name:** first, middle, last, prefix, suffix, nickname; phonetic first / last / company
- **Work:** company, job title, department
- **Methods (multi):** phones, emails, websites — each label + value
- **Address (multi):** street, city, state, postcode, country (+ label)
- **Dates:** birthday, significant dates (label + date)
- **Related people:** relationship + name
- **Notes**, **Custom fields** (label + value)

Build: **P24B-07 (edit)** — redo against this brief.

## Scope

**In scope:** the mobile edit sheet — layout, collapsible sections covering the full field set,
prefill, save, validation, and variance (read-only, member-without-`canEdit`). **Out of scope:** the
desktop inline editor (unchanged); the create sheet (already shipped — edit should mirror it).

## Design Requirements

### Pattern & chrome
- A **bottom sheet** over the contact detail (the `MobileContactSheet` / `MobileBottomSheet` pattern):
  drag handle, centered "Edit contact" title, ✕ close, scrollable body, **pinned Save above the
  keyboard**, keyboard-aware (`visualViewport`). Matches the create sheet exactly.
- Opened from the contact detail **Edit** affordance. Keep the full-page form as the `?full=1` fallback.

### Sections (collapsible cards; prefilled from the contact)
1. **Basic Info** (always-on): First, Last, Company.
2. **Phone numbers** — multi rows (label select + value), "Add phone number".
3. **Email addresses** — multi rows, "Add email address".
4. **Websites** — multi rows, "Add website".
5. **Address** — street, city, postcode, country, label (multi address optional).
6. **Dates** — birthday + significant dates (label + date), "Add date".
7. **Related people** — relationship + name, "Add person".
8. **More** — Notes; **Name details** (middle, prefix, suffix, nickname, phonetic first/last/company);
   job title, department; **Custom fields** (label + value).

Sections with data are expanded by default; empty optional sections collapsed. Each field: 12/600 mute
label + input (≥16px, no iOS zoom). Per design tokens (Part A).

### States
default (prefilled) · saving (pinned button "Saving…") · inline validation under the field (no alert) ·
empty optional sections show a single "+ Add …" affordance.

### Variance (per DB14)
- **Member without `canEdit`** on a shared contact → no edit entry point (read-only detail).
- **Read-only lifecycle** (GRACE/LOCKED) → no edit entry point.
- Owner / editor → full edit.

### Deliverables
Annotated frames: edit sheet (collapsed default), expanded sections (phones/emails/address/dates/more),
keyboard-up with pinned Save, saving state, validation error.

## Acceptance Criteria (design sign-off)

- Edit is a sheet matching the create sheet, covering the full field set above — no field regressions
  vs the inline editor.
- Sections prefill correctly; multi-value add/remove works; Save persists via `updateContact`.
- Keyboard-aware; Save stays visible; inputs ≥16px.
- Variance gating (member/read-only) hides the edit entry point.
- `?full=1` full-page form remains available.

## Dependencies / Risks

- Field coverage is the whole point — the sheet must not silently drop fields the inline editor has.
- Confirm whether to fully replace the inline editor on mobile, or keep it behind `?full=1`.
- Implemented by **P24B-07 (edit)**; variance per **P24B-DB14**.
