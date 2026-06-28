# P34U-05 — Investigate Production React `#418` Console Error on Authenticated App Routes

## Purpose

Eliminate the production-side React runtime error observed during the June 28,
2026 verification pass so the authenticated app surfaces render without hidden
client instability.

## Background

While re-testing the shipped UX audit fixes on the deployed app on June 28,
2026, several authenticated routes rendered successfully but still logged a
minified React runtime error in the browser console:

- `Error: Minified React error #418`

Observed production routes during the verification pass:
- `/contacts/new`
- `/merge/manual`
- `/import-export?tab=export`

The pages were usable enough to verify the UX changes, but the console error is
not acceptable as a steady-state result. Even when the visible UI appears
correct, a production React error can indicate hydration mismatch, invalid HTML
structure, or another client/runtime inconsistency that may later surface as
broken interactions or fragile deploy behavior.

Relevant implementation anchors:
- `src/app/contacts/new` flow and its shared form components
- `src/app/merge/manual/page.tsx`
- `src/app/import-export/page.tsx`
- shared shell/layout components used across authenticated app routes

## Scope

**In scope**
- reproducing the production console error on deployed authenticated routes
- identifying the component or markup pattern responsible for the React `#418`
  runtime error
- fixing the root cause rather than suppressing the symptom
- re-testing the affected routes to confirm the console is clean

**Out of scope**
- redesigning the UX of the affected routes
- unrelated local-dev auth or database connectivity issues
- broad performance optimization work unless directly required by the fix

## Dependencies

- June 28, 2026 UX verification pass
- [Kontax UX/UI Audit Tracker — June 2026](../runbooks/kontax-ux-ui-audit-tracker-2026-06.md)
- [Full Smoke Test and Field Edit Audit](../runbooks/full-smoke-test-and-field-edit-audit.md)

## Evidence

### Observed behavior

- The deployed app loaded the affected routes successfully.
- The browser console reported `Minified React error #418` on production route
  transitions and/or render.
- The error was seen while verifying authenticated app routes, not just one
  isolated surface.

### Resolution

- The notification bell was using `Date.now()` during render to group feed rows
  and format relative timestamps.
- That made the initial client render drift from the server-rendered HTML,
  which is consistent with a hydration mismatch.
- The fix shipped in `81357b1` seeds the bell's initial time reference from the
  server slot and reuses that value during hydration.

### Notes from verification

- The localhost environment also emitted separate auth/database errors during
  this session because the local database was unreachable. Those are not the
  target of this ticket.
- This ticket is specifically about the deployed production/staging app runtime
  error observed on `kontax.vexon.co`.

## Investigation direction

Start with the most likely classes of causes:

1. Hydration mismatch between server-rendered and client-rendered markup.
2. Invalid HTML nesting or markup structure introduced by shared layout or form
   components.
3. Route-specific client component behavior that diverges after hydration.
4. Shared authenticated-shell behavior that affects multiple app routes.

## Suggested implementation approach

- Reproduce the error on the deployed app with the browser console open.
- Narrow whether the issue originates from:
  - `create-contact-form`
  - manual merge entry/review UI
  - import/export tab rendering
  - shared layout/header/navigation wrappers
- Inspect the rendered DOM around any suspicious invalid nesting or
  server/client branching.
- If needed, reproduce in a non-minified environment or use source maps to map
  the error back to the responsible component.
- Fix the underlying render mismatch or markup issue.

## Acceptance Criteria

- Visiting `/contacts/new` while authenticated produces no React runtime errors
  in the browser console.
- Visiting `/merge/manual` while authenticated produces no React runtime errors
  in the browser console.
- Visiting `/import-export?tab=export` while authenticated produces no React
  runtime errors in the browser console.
- No new console errors are introduced on the affected routes.
- The previously verified UX fixes on those routes remain visually and
  functionally intact.

## QA Notes

- Re-test on the deployed app, not only localhost.
- Validate at least:
  - mobile `390x844`
  - desktop `1440x900`
- Record the exact route and console state after each pass.

## Verification

- Verified on the deployed app on 2026-06-28 after `81357b1`.
- Checked while signed in at both `390x844` and `1440x900`:
  - `/contacts/new`
  - `/merge/manual`
  - `/import-export?tab=export`
- Result: no console warnings, no console errors, and no React `#418`
  hydration error on any of the tested routes.

## Documentation

- [ ] External · users
- [x] Internal · engineering
- [x] Internal · QA
