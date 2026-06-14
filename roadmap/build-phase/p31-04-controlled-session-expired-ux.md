# P31-04 — Controlled Session-Expired UX

## Purpose

When a session genuinely expires, give the user a clear, recoverable experience
that returns them to what they were doing and protects unsaved work — instead of
a generic login bounce or a thrown error surfacing as a blank application error.

## Background

Sessions are JWT with a 30-day absolute `maxAge` and a 7-day `updateAge`. When a
token finally expires (or is invalidated), the current failure modes are a
`redirect("/login")` or a thrown auth error inside a server action. Neither
preserves the user's destination or warns about unsaved form input. P31-01
classifies these as **auth-required**; this ticket defines the *recovery UX* for
them, and the structured-error plumbing server actions need to support it.

## Scope

**In scope**
- A dedicated **session-expired** experience: an inline recovery prompt for
  in-app contexts and/or a `/login?next=<dest>&expired=1` state that explains the
  session ended (vs. a fresh login).
- **Destination preservation**: after re-login, return to the exact contact /
  workflow (reuse the middleware `?next=` mechanism).
- **Unsaved-work protection**: warn before navigating away from a create/edit
  form when a session expires mid-edit; ideally preserve draft input.
- **Structured server-action results**: auth failures inside server actions
  return a discriminated result (e.g. `{ ok: false, reason: "SESSION_EXPIRED" }`)
  the client can handle, rather than only `redirect()`/throw.

**Out of scope**
- The redirect classification itself (P31-01), step-up auth (P31-02).

## Design / Implementation Spec

### Detecting expiry vs. logged-out
Distinguish "had a session, it expired" from "never logged in":
- Middleware/page: a present-but-undecodable or expired token → `expired=1`.
- The `/login` page renders an "Your session ended — sign back in" affordance
  when `expired=1`, preserving `next`.

### Inline recovery (preferred for in-app)
For an auth failure during an in-app action, surface a non-destructive inline
prompt ("Your session ended. Sign in to continue — your place is saved.") rather
than a hard redirect, where the surrounding UI can stay mounted.

### Structured server-action results
Introduce a small helper so sensitive/mutating actions return a typed failure the
client islands can branch on:
```ts
type ActionResult<T> = { ok: true; data: T } | { ok: false; reason: "SESSION_EXPIRED" | "STEP_UP" | "ERROR"; message?: string };
```
Pairs with P31-02's `StepUpRequired`. Existing `redirect()`-style actions stay as
workflow transitions; auth failures move to structured results.

### Unsaved-work guard
On create/edit forms, register a `beforeunload`/route-change guard and, on a
detected session-expiry, keep the form mounted with a recovery prompt instead of
discarding input.

## Acceptance Criteria
- An expired session shows an understandable, recoverable prompt — not a blank
  application error or an undifferentiated login page.
- After re-login, the user lands back on the intended contact/workflow.
- Create/edit forms warn before losing unsaved data on session expiry.
- Server actions can report `SESSION_EXPIRED` as a structured result the UI handles.

## Risks / Open Questions
- Server actions currently rely on `redirect()`/throw; introducing structured
  results is a cross-cutting change — roll out behind the P31-01 classification.
- Draft preservation may need client-side persistence (sessionStorage) for the
  in-flight form.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (P26-12): "Why was I signed out, and how to get back"
- [ ] External · developers — /developers (P29-07)
- [x] Internal · admins/ops — roadmap/runbooks/: diagnosing session-expiry reports
- [x] Internal · engineering — docs/: structured action-result + session-expiry recovery pattern
