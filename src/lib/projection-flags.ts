// P41-DB01 — projection feature flags.
//
// Surface 5 (inbound routing display, per-connection conflict override, and the
// "couldn't attribute" fallback) is spec'd for coherence but ships BEHIND A
// FLAG, drawn dashed/violet so no one mistakes it for live V1. It also depends
// on the runner persisting per-field diffs, which is deferred to P41-05.
//
// Kept as a plain build-time constant (off) to keep this UI ticket
// self-contained and low-risk. When P41-05 lands the runner work, swap this for
// a per-user check via `isFeatureEnabled("projectionRouting", userId)` from
// `~/server/admin/feature-flags`.
export const PROJECTION_ROUTING_ENABLED = false as boolean;
