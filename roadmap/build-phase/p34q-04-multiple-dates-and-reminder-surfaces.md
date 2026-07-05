# P34Q-04 — Multiple Dates and Reminder Surfaces Beyond Birthday

## Purpose

Turn anniversary, lunar birthday, and custom contact dates into a first-class
user-facing feature instead of a hidden or provider-led edge case.

## Background

The data model and sync work now handle more than one meaningful date type, but
the product still behaves as though birthday is the only mainstream case. That
leaves real value on the table.

## Scope

**In scope**
- richer dates UI in contact detail/edit
- reminders and upcoming-date views
- compatibility messaging where providers only support birthday
- improved date labeling and visibility across contact pages

**Out of scope**
- complex lunar-calendar conversion logic beyond simple labeled storage

## Dependencies

- underlying date model and compatibility rules from earlier sync work

## Design / Implementation Spec

### User-facing behaviors

- dates should be visible in both edit and read views
- reminders should make the date label explicit
- unsupported provider sync behavior should be explained inline

### Labels to support

- anniversary
- lunar birthday
- custom labels

### Reminder surface expectations

- show upcoming date label clearly
- allow reminders to distinguish birthday vs non-birthday events
- avoid implying that all date types sync to every provider

## Acceptance Criteria

- Contacts can clearly show more than just birthday.
- Users can see which dates are local-only vs provider-supported.
- Reminder surfaces reflect the expanded date model.

## Documentation

- [ ] External · users — help copy later
- [x] Internal · engineering — date-surface rules documented here
