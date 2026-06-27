# P34R-04 — Per-Book Roles and Permissions for Family/Team Books

## Purpose

Add finer-grained permissions to shared books so families and teams can control
who can edit versus who can only view.

## Background

Shared books become much more useful once the product can distinguish between
"everyone can edit" and "some members can view only." This matters especially
for families with sensitive contacts and teams with operational roles.

## Scope

**In scope**
- per-book viewer/editor roles
- admin UI to adjust book access
- auditability for permission changes

**Out of scope**
- org-wide permission inheritance system

## Dependencies

- P34R-03 multiple-book product surface
- existing family/team membership model

## Design / Implementation Spec

### Permissions model

- viewer
- editor
- owner/admin managed assignment

### Surface requirements

- show effective role in book settings
- make permission changes auditable
- align with existing family/team membership concepts

### First role model

- viewer
- editor
- owner/admin-controlled assignment only

## Acceptance Criteria

- Shared books can be view-only or editable per member.
- Permission changes are visible and auditable.
- The model works for both family and team books.

## Documentation

- [ ] External · users — help copy later
- [x] Internal · engineering — permission model documented here
