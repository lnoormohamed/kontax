# Runbook: Testing & Critical Paths

**Subsystem:** Engineering test strategy and critical-path ownership  
**Audience:** Engineers adding features, debugging regressions, or preparing releases

---

## Overview

Kontax now carries meaningful product risk in contact editing, sync, billing,
and admin operations. This repo-owned baseline keeps the highest-risk logic
under source control instead of relying only on manual smoke checks.

## Test layers

### 1. Fast repo tests

Run these on every branch and in CI:

```bash
npm run test:repo
```

Current coverage owners:

| Flow / risk | Suite | Why it exists |
|---|---|---|
| Contact number editing semantics | `tests/node/phone-country-input-utils.test.ts` | Protects phone-country transformations that affect editing and country-code changes |
| Provider capability regressions | `tests/node/sync-provider-capabilities.test.ts` | Protects iCloud/Fastmail/generic-safe field handling and custom-label export rules |
| Provider identity / generic CardDAV naming | `tests/node/sync-provider-identity.test.ts` | Protects verified vs detected vs generic connection identity rules |

### 2. Environment-backed smoke coverage

Use this when an app instance is already running:

```bash
npm run test:e2e
```

This lane is reserved for browser-path validation such as auth continuity,
contact create/edit, sync settings save flows, and reconnect behavior.

### 3. Manual release smoke

Use the product smoke runbooks for staging/prod validation after deploys or
provider-specific sync changes.

## Critical-path ownership map

| Product path | Automated owner | Manual backup |
|---|---|---|
| Contact edit semantics | `tests/node/phone-country-input-utils.test.ts` | contact create/edit smoke on staging |
| Provider field projection | `tests/node/sync-provider-capabilities.test.ts` | provider fixture smoke on staging |
| Generic CardDAV provider identity | `tests/node/sync-provider-identity.test.ts` | sync-connections UI/admin review |
| Sync settings and reconnect flows | `tests/e2e/` lane | sync reconnect runbook |
| Destructive admin actions | `tests/e2e/` lane | admin ops smoke |

## Commands

```bash
# fast repo-owned regression suites
npm run test:repo

# same as above, but only the provider-fixture lane
npm run test:sync-fixtures

# environment-backed browser smoke
npm run test:e2e
```

## Expectations for new work

- Add or extend a repo-owned test when touching sync mapping, provider identity,
  import/export serialization, or contact editing helpers.
- If a flow cannot be reasonably covered without a live provider, add a fixture
  regression first and keep the live check in the smoke runbook.
- When introducing a new risky surface, update the ownership map above instead
  of leaving the test plan implicit.
