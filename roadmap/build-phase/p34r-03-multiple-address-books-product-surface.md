# P34R-03 — Multiple Personal/Shared Address Books Product Surface

## Purpose

Expose the underlying address-book model as a real user-facing feature rather
than keeping most of that structure implicit.

## Background

The product and DAV model already anticipate richer book structure. Making that
visible to users would unlock more deliberate organization and better sync
control.

## Scope

**In scope**
- create/manage multiple books
- default-book behavior
- move/copy contacts between books
- book-level surfacing in sync and sharing UX

**Out of scope**
- full enterprise RBAC

## Dependencies

- current address-book data model and DAV exposure rules

## Design / Implementation Spec

### Core behaviors

- create a personal book
- rename / archive a book
- choose a default book
- assign contacts to a specific book

### Cross-surface requirements

- books should appear in sync setup
- books should appear in sharing flows where relevant
- DAV behavior should remain stable and backwards-compatible

### Migration concerns

- default book semantics must remain stable
- existing DAV clients should not lose connectivity unexpectedly

## Acceptance Criteria

- Users can manage more than one book intentionally.
- Book structure is visible and understandable in the product.
- Sync/sharing surfaces can refer to books explicitly.

## Documentation

- [ ] External · users — onboarding/help later
- [x] Internal · engineering — book-surface rules documented here
