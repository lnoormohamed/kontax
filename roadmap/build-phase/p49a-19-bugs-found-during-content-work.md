# P49A-19 — Bugs found while writing the help centre and guides

**Phase:** 49A · **Priority:** P1 (item 1 is P0) · **Effort:** M · **Found:** 2026-09-25, P50A-05/-06

Found by the help-centre and guides agents while checking every article against the code. Each
needs confirming in code before the fix.

| # | Bug | Where to look | Impact |
|---|---|---|---|
| 1 | **Regenerating 2FA recovery codes discards the new codes** (the user is shown codes that were never saved, or the new set is thrown away) | `src/app/actions/totp.ts` `regenerateRecoveryCodes` + the settings 2FA UI | Users think they have backup codes and are locked out if they lose their phone (P0) |
| 2 | Sync conflict **"Manual merge" ignores the fields the user picks** | sync conflict resolution in `src/app/actions/sync.ts` + the conflict review UI | Silent data choice different from what the user asked |
| 3 | Data-export ready email links to the wrong settings page | `src/server/data-export/*` email template / URL | Dead end for users |
| 4 | Failed-payment grace (3 days) is not enforced — display only | `billing-surface.ts`, `stripe-handlers.ts` (P49A-05 notes: by policy, Stripe decides the lapse) | Decide: document as intended (Stripe dunning ends it) or enforce; tie to the owner's "Stripe → cancel" setting |
| 5 | Free users can get a vCard file via the Kontax Archive ".vcf copy" option and the full data export, although vCard export is Pro | `src/server/export-format/*`, data export | Plan leak (low); decide whether the GDPR export should include vCard for everyone (arguably yes — data portability) and align the pricing copy |
| 6 | Auto-pause after repeated sync failures defaults to 5, while copy says 3 | `src/server/sync-health.ts` | Copy/behaviour mismatch — pick one |
| 7 | `DOWNGRADE_COPY` in `plan-data.ts` is never shown and is wrong in places; users see `cancel-plan-modal.tsx` | `src/app/_components/plan-data.ts`, `cancel-plan-modal.tsx` | Dead, misleading code — delete or wire up correctly |
| 8 | iPhone edits through Kontax's CardDAV server are not marked as local edits, so they may not push to the source provider (e.g. Google) | `server.mjs` PUT `lastMutatedBy` | Already tracked as A-17 in P49A-12 — confirm there |
| 9 | Free `monthlyImportLimit: 3` counts **contacts**, so any Free CSV import over 3 rows is refused | `src/server/billing.ts` `assertCanImportContacts` | Owner decision pending: likely "3 imports per month" |

Fixed already (not part of this ticket): the sign-up card's "no card required" trial copy and the
help FAQ's vCard-import claim (08b6fac, release branch).
