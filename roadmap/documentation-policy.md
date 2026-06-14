# Documentation policy

Every shipped feature must leave behind documentation in the right place. This
policy defines the documentation surfaces, what triggers each, and the per-ticket
convention so docs are written *as features ship* (29+) and backfilled for
earlier phases (Phase 32).

## The four surfaces (2×2: internal/external × who)

|              | **External** (public)                          | **Internal** (the team)                          |
| ------------ | ---------------------------------------------- | ------------------------------------------------ |
| **People**   | **Users** — how to use a feature               | **Admins / ops** — how to run & support it       |
| **Surface**  | In-app Help system ([P26-12]) / help center    | [`roadmap/runbooks/`](runbooks)                  |
|              | **Developers** — how to integrate              | **Engineers** — how it works under the hood      |
|              | Public `/developers` page ([P29-07])           | [`docs/`](../docs) concept/architecture docs     |

So four homes:

1. **External · users → in-app Help.** Task- and feature-oriented ("How do I
   share a contact?"). Triggered by any user-visible feature or behavior change.
2. **External · developers → `/developers`.** API endpoints, auth, fields, limits.
   Triggered by any change to the public REST API or developer-facing surface.
3. **Internal · admins/ops → `roadmap/runbooks/`.** Operational procedures:
   deploy, env config, incident response, support actions, manual interventions.
   Triggered by anything with operational/support implications (infra, billing,
   email, sync, impersonation, feature flags, data jobs).
4. **Internal · engineering → `docs/`.** Concepts and architecture that span
   tickets ("how the sync engine reconciles", "books vs lists vs labels").
   Triggered by any non-obvious cross-cutting model or subsystem.

A single feature can touch several surfaces. Contact sharing, for example, needs
a user Help article (how to share), a `/developers` note if the API exposes it,
a runbook (how to revoke a share for a support case), and a concept doc (the
share-types model).

## Per-ticket convention (Phases 29+)

Every ticket carries a **Documentation** block naming the surface(s) it must
update before it's considered done. Use the checklist:

```
## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [ ] Internal · engineering — docs/
```

Tick only what applies; a ticket with zero applicable surfaces is rare and should
be justified. Documentation is part of the ticket's acceptance — not a follow-up.

## Backfill (Phase 32)

Phases 1–28 predate this policy. **Phase 32** is a dedicated documentation phase
that audits those phases against the four surfaces and fills the gaps. Phases
29–31 self-document via the per-ticket convention above, so Phase 32's scope is
the historical backlog plus any 29–31 misses.

[P26-12]: build-phase/p26-12-in-app-help-system.md
[P29-07]: build-phase/p29-07-api-documentation-page.md
