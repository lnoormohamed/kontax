# P34U-03 — Phone Country Selector Clarity in Create/Edit Flows

## Purpose

Make phone-country selection obvious and accessible anywhere Kontax collects or
edits phone numbers, instead of relying on an icon-only affordance.

## Background

Audit finding `UX-004` flagged the phone field in create-contact because the
country selector can read like a generic globe button rather than a clear
country-code chooser. The issue is deeper than the create page: the same shared
input component powers phone editing in other surfaces.

Relevant implementation anchors:
- `src/app/_components/phone-country-input.tsx`
- `src/app/_components/contact-multi-value.tsx`
- `src/app/_components/create-contact-form.tsx`
- `src/app/_components/mobile-contact-sheet.tsx`

## Scope

**In scope**
- visible clarity of the phone-country trigger
- accessible naming for the selector button
- consistency across create and edit flows using the shared input

**Out of scope**
- changing phone normalization rules
- redesigning the full phone-country menu taxonomy
- international formatting logic

## Dependencies

- Audit finding `UX-004`
- Shared `PhoneCountryInput` component

## Design / Implementation Spec

### Desired behavior

- Users should immediately understand that the leading control selects a country
  or calling code.
- The trigger should not depend on a globe emoji alone.
- Assistive technologies should announce the control meaningfully.

### Suggested implementation direction

- Replace the icon-only trigger treatment with a clearer visible contract such
  as:
  - flag + calling code
  - flag + short country indicator
  - text like `Code` plus current calling code
- Add a descriptive accessible label such as `Select country code`.
- Preserve the current country inference and normalization behavior.
- Apply the updated trigger anywhere `PhoneCountryInput` is used so create and
  edit do not diverge.

### Engineering notes

- The accessibility fix belongs in `phone-country-input.tsx`.
- The visual contract should be validated in both the create-contact form and
  the mobile contact sheet because wrapper spacing differs between the two.

## Acceptance Criteria

- The phone selector no longer appears as an unlabeled or ambiguous icon-only
  control.
- The trigger announces a descriptive purpose to assistive technology.
- The updated treatment is consistent in create and edit flows that use
  `PhoneCountryInput`.
- Existing country selection and normalization behavior continues to work.

## Documentation

- [ ] External · users
- [x] Internal · engineering
- [x] Internal · QA
