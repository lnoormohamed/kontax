# P1-04 Encryption and Security Baseline

## Purpose
This document defines the practical strong-security baseline for Kontax in Phase 1. It establishes what protections are required now, what is explicitly deferred, and how encryption, secrets, auditing, backups, and sensitive operations should be handled so later billing, import/export, merge, and sync features do not create security debt.

## Security Philosophy
- Protect user trust first through simple, strong defaults.
- Prefer clearly enforced baseline controls over partially implemented advanced crypto.
- Separate transport security, credential security, storage security, and future field-level encryption concerns.
- Make sensitive actions auditable from the beginning, even if advanced support tooling arrives later.
- Avoid schema and product choices that would prevent stronger encryption or key rotation later.

## Current Baseline Context
Current app baseline already includes:
- credentials auth with bcrypt password verification
- environment-based auth secret handling
- PostgreSQL-backed application data
- a deployment path through Docker/Coolify

Current gaps still to address later:
- no persistent audit event model
- no field-level encrypted contact data
- no dedicated key management metadata in schema
- no credential storage model yet for future CardDAV sync
- no documented retention/destruction process for import/export artifacts

## Baseline Security Controls
### Transport security
- All production traffic must use HTTPS/TLS end to end.
- No production login, registration, export, billing, or sync traffic should ever be served over plaintext HTTP.
- Internal service-to-service traffic should also prefer TLS where provider tooling supports it.

Required outcomes:
- login credentials are never transmitted without TLS
- auth/session cookies or tokens are never exposed over insecure transport
- import/export uploads and downloads are protected in transit

### Secret management
- `AUTH_SECRET` and future billing/sync secrets must only come from environment or secret-management providers.
- No secret values belong in repo-tracked files, screenshots, or support notes.
- Separate secret classes by purpose:
  - app auth secret
  - database credentials
  - billing provider secrets
  - sync-provider credentials or app passwords
  - future encryption key references

Required practices:
- production secrets are rotated through deployment tooling, not hardcoded
- local development secrets may be generated, but should not become production defaults
- secret exposure in logs must be explicitly forbidden

### Password security
- Passwords are stored only as hashes, never plaintext or reversibly encrypted.
- Bcrypt is the practical v1 baseline.
- Hash cost should be reviewed against production latency budgets and increased over time when safe.
- Rehash-on-login should be the migration path for outdated hash settings.

### Database and storage security
- Rely on provider-managed at-rest encryption for the PostgreSQL instance in early phases.
- Database backups must also be encrypted at rest by provider or infrastructure policy.
- Access to production database instances should be role-based and tightly scoped.

Required outcomes:
- backups are not treated as a weaker copy of production data
- staging and development access does not imply production access
- credentials for production databases are managed separately from local defaults

## Encryption Scope
### Required now
- TLS for transport
- bcrypt for password hashing
- provider-managed at-rest encryption for DB and backups
- protected secret management for app secrets

### Planned soon, but not required in v1 core
- encrypted storage of future sync credentials or app passwords
- metadata model for key references through `EncryptionKeyRef`
- rotation policy for sensitive provider credentials

### Explicitly deferred from Phase 1
- field-level encryption for contact PII such as notes, email, phone, and addresses
- searchable encrypted contact fields
- customer-managed encryption keys
- enterprise compliance-specific controls

Reason for deferral:
- field-level encryption complicates search, import normalization, merge heuristics, and sync mappings
- for early Kontax, practical strong defaults are a better risk tradeoff than partial field encryption that breaks core functionality

## Future Field-Level Encryption Stance
- Field-level encryption remains a valid future enhancement, especially for sync credentials, secret notes, or highly sensitive PII.
- The canonical schema should preserve room for `EncryptionKeyRef` and encrypted-value metadata later.
- No roadmap phase should assume encrypted fields are searchable unless a dedicated search-safe design is adopted.

Rules for future work:
- encrypted fields should have clearly defined threat model and key ownership
- search and duplicate detection must not silently degrade because a field became encrypted
- sync credentials should be treated as a stronger candidate for early encryption than ordinary contact names

## Audit Requirements
Security-sensitive actions that must produce immutable audit records in later implementation:
- successful sign-in
- failed sign-in
- sign-out
- password change
- password reset request
- password reset completion
- account lock or unlock
- contact archive
- contact delete
- bulk import confirmation
- export job generation
- merge execution
- billing lifecycle changes
- sync credential creation, update, revoke

Minimum audit metadata:
- `userId` when known
- `actorType`
- `actorId`
- `eventType`
- `targetType`
- `targetId`
- result status where meaningful
- IP address
- user agent
- timestamp

Audit rules:
- audit events are append-only
- audit history is not user-editable
- support access to audit data should be carefully scoped

## Backup and Retention Expectations
- Production database backups must be encrypted at rest.
- Backup retention should be documented alongside restore ownership and access policy.
- Import and export files should have shorter retention than canonical contact data.
- Job records may outlive file artifacts to preserve auditability and support visibility.

Planned retention direction:
- contact data follows user account lifecycle policy
- generated files are cleaned up by operational jobs
- audit events outlive ephemeral file artifacts

## Logging and Error Handling Rules
- Never log plaintext passwords, auth secrets, sync credentials, or raw reset tokens.
- Avoid logging full contact payloads in production unless explicitly redacted and justified.
- Error messages exposed to users should be generic enough to prevent account enumeration or secret leakage.
- Internal logs may include identifiers and job IDs, but should minimize high-sensitivity payloads.

## Environment and Deployment Expectations
- `AUTH_SECRET` is mandatory in production.
- Production deployment must set secure database credentials and separate them from local scaffold defaults.
- Docker images and build logs must not contain embedded production secrets.
- Coolify or equivalent deployment tooling should own secret injection and rotation workflows.

## Security Boundaries for Future Features
### Import/export
- uploaded files may contain highly sensitive personal data
- temporary file storage must follow retention and access rules
- exports must be treated as sensitive downloadable artifacts

### Merge
- destructive merge actions require audit coverage
- undo or reversibility decisions must not compromise audit integrity

### Billing
- billing provider secrets must remain segregated from app auth secrets
- subscription state changes should be auditable

### CardDAV sync
- sync credentials require stronger handling than standard contact fields
- future sync account credentials are the most likely early candidate for dedicated encrypted storage

## Near-Term Security Follow-Ups
- add `AuditEvent` schema and write-path planning
- add user/account status support in schema
- add `EncryptionKeyRef` planning artifact to schema work
- document import/export file retention windows
- define sync-credential storage policy before CardDAV implementation begins

## Acceptance Outcome
`P1-04` is complete when this baseline is treated as the security source of truth for transport, secret handling, password storage, database protection, auditability, deferred field encryption, and future sync-credential protection across all later phases.
