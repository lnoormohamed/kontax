import { env } from "~/env";

// P50A-01: shared "is Outlook/Microsoft sync live on this deployment?" gate.
// Marketing and help copy must never claim Outlook support unless this is
// true — Outlook is not configured in production.
//
// Deliberately duplicates the equivalent check in `isMicrosoftSyncConfigured`
// (~/server/microsoft-sync) rather than importing that module: that file
// pulls in @azure/msal-node, the sync engine, and the database client, which
// marketing/help pages (several statically prerendered) shouldn't have to
// bundle just to gate a line of copy. Keep the condition in sync with that
// file if the env vars it checks ever change.
//
// Evaluation timing matters here. Pages that already call a dynamic API
// (e.g. the homepage's `auth()`) read this at REQUEST time in the running
// container, which reflects the real runtime env. Pages with no dynamic API
// are statically prerendered, so this is read once at `next build` time —
// which is fine in this deployment because the Dockerfile never passes
// MICROSOFT_* as build args/ENV, so `next build` always sees them unset
// (Outlook can never be baked into static output while it's disabled). If
// Microsoft sync is ever enabled in production, the image must be rebuilt for
// static pages to pick it up (or those pages would need to move to a dynamic
// render) — see roadmap/build-phase/p50a-01-honesty-and-indexing-quick-fixes.md.
export const isMicrosoftSyncEnabled = (): boolean =>
  Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET && env.MICROSOFT_REDIRECT_URI);
