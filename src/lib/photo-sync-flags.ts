// P44-03/04 — contact photo sync feature flag.
//
// Phase 44 builds the live inbound/outbound photo pipes, but they ship BEHIND a
// flag (default off) so merging to staging cannot start pushing/pulling photos
// on real connected accounts before QA. This is deliberate: the echo-suppression
// design (docs/adr/0001) depends on provider behaviour that P44-01 has only
// partly verified — notably Google's ≥24h async re-processing, still outstanding
// — so we gate until the P44-06 QA matrix runs against dedicated test accounts.
//
// Kept as a build-time constant to keep the tickets self-contained. QA enables
// it per-env (PHOTO_SYNC_ENABLED=1). When the P44-06 pass is green, flip the
// default or move to a per-user feature flag.
export const PHOTO_SYNC_ENABLED: boolean =
  process.env.PHOTO_SYNC_ENABLED === "1" || process.env.PHOTO_SYNC_ENABLED === "true";
