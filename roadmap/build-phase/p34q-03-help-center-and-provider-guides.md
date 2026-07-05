# P34Q-03 — Help Center Expansion with Provider Troubleshooting Guides

## Purpose

Upgrade the public and in-app help experience from a general FAQ into a product
support center with provider-specific guidance.

## Background

Kontax now has enough provider-specific behavior that a generic FAQ cannot
carry the support load by itself. Users need structured, contextual guidance
for iCloud, Fastmail, Google, Microsoft, and generic CardDAV.

## Scope

**In scope**
- expand help center structure
- add provider guides for iCloud, Fastmail, Google, Microsoft, generic CardDAV
- add sync troubleshooting explainers
- link contextually from settings/sync pages

**Out of scope**
- live chat or ticketing

## Dependencies

- P34Q-02 diagnostics language should inform the final help copy

## Design / Implementation Spec

### Guide structure

Each provider guide should cover:

- how to connect
- what fields are expected to sync
- what limitations users may see
- common failure states and recoveries
- when to contact support

### Product integration

- deep-link help from relevant sync/account states
- reuse language from diagnostics so users do not see conflicting explanations

### Initial guide set

- iCloud
- Fastmail
- Google Contacts
- Microsoft Outlook
- generic CardDAV / manual provider

## Acceptance Criteria

- The help center includes provider-specific sync guidance.
- Users can reach relevant help from sync/account surfaces.
- Common sync and field-fidelity questions are documented clearly.

## Documentation

- [x] External · users — this ticket is documentation-heavy by design
- [x] Internal · engineering — help contracts are defined here
