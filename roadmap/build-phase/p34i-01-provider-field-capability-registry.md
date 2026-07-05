# P34I-01 — Provider Field Capability Registry

## Purpose

Create a single source of truth describing which contact fields each sync
provider can reliably represent and round-trip.

## Background

We already know provider support differs in meaningful ways:
- iCloud/CardDAV supports richer significant dates
- Fastmail/CardDAV is more limited
- Google and Microsoft have their own field-shape constraints

Without an explicit registry, capability logic gets scattered across mapping
code and becomes impossible to reason about safely.

## Scope

**In scope**
- Define a provider capability model
- Encode capabilities for current providers/profiles
- Make the registry available to sync-runner / mapping layers
- Support provider-profile granularity where needed (e.g. iCloud vs Fastmail)

**Out of scope**
- UI copy
- conflict review rendering
- QA fixtures

## Design / Implementation Spec

### Required capability shape

At minimum the registry should answer:
- does this provider support `birthday`
- does this provider support `significantDates`
- does this provider support custom labels for:
  - email
  - phone
  - website
  - address
  - dates
- does this provider support structured addresses vs only flattened address text
- does this provider safely round-trip unknown/custom field labels

### Recommended model

Use a typed server-side registry, for example:

```ts
type ProviderCapabilityProfile = {
  id: string;
  provider: "CARDDAV" | "GOOGLE" | "MICROSOFT";
  variant?: "icloud" | "fastmail" | "generic-carddav";
  fields: {
    birthday: "full";
    significantDates: "none" | "limited" | "full";
    customDateLabels: boolean;
    structuredAddresses: "none" | "limited" | "full";
    customValueLabels: boolean;
  };
};
```

### Important design decision

Do not model this as just "supported / unsupported". Some fields need at least
three states:
- `full`
- `limited`
- `none`

Example:
- Fastmail may support `birthday` fully
- support `significantDates` as `none`
- support custom phone labels only in a lossy/limited way

## Acceptance Criteria

- A typed capability registry exists in server sync code
- All current provider families are represented
- CardDAV can distinguish at least iCloud and Fastmail capability profiles
- Sync code can resolve a profile for a given `SyncAccount`

## Risks / Open Questions

- Decide how provider variants are detected:
  - explicit account metadata
  - base URL heuristics
  - discovered server fingerprints

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — registry shape documented here
- [ ] Internal · support/admin — none
