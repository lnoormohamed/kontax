# P34Q-01 — Connected Sign-In Accounts in Security Settings

## Purpose

Replace the current placeholder connected-accounts panel with a real security
surface for linked Google / Apple sign-in identities.

## Background

The current security page reserves a visible "Connected accounts" section but
still marks it as coming soon. That is a trust gap because users already expect
that area to explain how external sign-in identities attach to their account.

## Scope

**In scope**
- show linked identities
- link a new sign-in provider
- unlink a provider with step-up confirmation where needed
- show last-linked / account metadata useful to the user

**Out of scope**
- sync-provider account management (separate from sign-in identities)

## Dependencies

- auth/account identity model for linked providers
- security settings surface already in place

## Design / Implementation Spec

### Minimum surface

- provider name and icon
- account email / identifier if available
- linked state
- linked at / last used if we can capture it safely
- connect / disconnect actions

### Safety rules

- require password or equivalent step-up before removing the last remaining
  login path
- warn clearly if unlinking a provider would reduce recovery options
- log the link/unlink action in the relevant audit/security history

### Edge cases

- account has password + provider
- account has provider only
- account has multiple providers linked
- provider email differs from primary account email

## Acceptance Criteria

- The "Connected accounts" section in security settings is no longer placeholder UI.
- Users can see and manage linked sign-in providers safely.
- Sensitive unlink actions require appropriate confirmation.

## Documentation

- [ ] External · users — help copy later
- [x] Internal · engineering — behavior documented here
