# Admin Permission Governance Policy

## Purpose

Reduce blast radius inside the admin area by separating operational access into
clear internal tiers.

## Admin tiers

### Support ops

- can view users
- can work support cases and investigation notes
- cannot suspend, delete, impersonate, manage broadcasts, or change flags

### Billing ops

- includes support ops access
- can override plans
- can suspend, unlock, and schedule deletion

### Sync ops

- includes support ops access
- can view sync operations
- can change sync capability-profile overrides

### Governance

- includes every capability above
- can access audit log exports
- can impersonate
- can manage feature flags
- can manage broadcasts

## Assignment model

- The earliest admin account in the database is treated as the bootstrap
  governance admin.
- Other admins default to `SUPPORT_OPS` unless explicitly assigned.
- Explicit overrides use `ADMIN_CAPABILITY_OVERRIDES`.

Example:

```bash
ADMIN_CAPABILITY_OVERRIDES="alice@example.com:governance,bob@example.com:billing_ops,carol@example.com:sync_ops"
```

Optional default tier:

```bash
ADMIN_DEFAULT_TIER="support_ops"
```

## Governance notes

- Destructive lifecycle actions still require structured reasons.
- Impersonation remains read-only and is limited to governance admins.
- Audit payloads now include actor tier and policy source so reviewers can see
  whether the privilege came from bootstrap or explicit override policy.
- If an operator is blocked by tier, prefer promoting the smallest necessary
  capability tier instead of making everyone governance.
