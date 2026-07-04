/**
 * P40-07 — Edit-context resolution (source spec: phase-37/01 §6).
 *
 * Given an edit arriving from the UI, an import, or a sync connection, decide
 * which layer each field lands in — the **shared** layer (the `Contact` row,
 * visible to shared-book members) or the **private** layer (a
 * `ContactPrivateField` row, owner-only). A value lives in exactly one layer,
 * so the two can never conflict.
 *
 * This is the ONE resolver every write path routes through (UI, import, and —
 * arriving in Phase 41 — sync). Its interface already accepts a sync-link
 * context so P41's inbound reconciliation (P41-05) plugs in without a signature
 * change; today's callers pass `undefined`.
 *
 * The §6 rule table:
 *
 *   | Edit origin              | Behaviour                                      |
 *   |--------------------------|------------------------------------------------|
 *   | Personal book context    | Policy applies (private fields → private layer)|
 *   | Shared book context      | Explicit share intent → shared row, always     |
 *   | Personal sync inbound    | Policy applies (private stays private)          |
 *   | Shared-book sync inbound  | Shared row only                                |
 *
 * Short-circuit: if the contact is in NO shared book, there is no one to hide a
 * field from, so everything lands on the shared row regardless of policy — the
 * private layer only earns its keep once a shared membership exists.
 *
 * Conflict authority (§6): shared-book edits are authoritative for shared
 * fields, personal sync for private fields. Because the partition puts each
 * value in exactly one layer, the two authorities never contend.
 */
import {
  isFieldShared,
  type EffectiveSharingPolicy,
  type SharingFieldType,
} from "~/lib/sharing-policy";

/** Opaque sync-link context — P41 fills this in; today it is just an id carrier. */
export type SyncLinkContext = {
  syncAccountId: string;
  syncLinkId?: string;
};

/** Where an edit originates. Sync origins carry an optional link context (P41). */
export type EditOrigin =
  | { kind: "personal-ui" }
  | { kind: "shared-ui" }
  | { kind: "personal-sync"; syncLink?: SyncLinkContext }
  | { kind: "shared-sync"; syncLink?: SyncLinkContext };

export type EditLayer = "SHARED" | "PRIVATE";

/** A field entry the resolver classifies. `label` drives the work/personal split. */
export type EditField = {
  fieldType: SharingFieldType;
  label?: string | null;
};

export type EditContext = {
  origin: EditOrigin;
  /**
   * Does the contact participate in any shared (family/team) book? When false
   * there is nobody to hide fields from, so the private layer is never used.
   */
  contactInSharedBook: boolean;
  /** Resolved effective policy for the book (see resolveEffectiveSharingPolicy). */
  policy: EffectiveSharingPolicy;
};

const isSharedOrigin = (origin: EditOrigin): boolean =>
  origin.kind === "shared-ui" || origin.kind === "shared-sync";

/**
 * Resolve which layer a single field lands in. Pure — the whole §6 table.
 */
export function resolveFieldLayer(ctx: EditContext, field: EditField): EditLayer {
  // No shared membership → nothing to partition; everything is the owner's.
  if (!ctx.contactInSharedBook) return "SHARED";

  // Editing inside a shared book (UI or sync) is explicit intent to share /
  // the shared book's authority — write the shared row regardless of policy.
  if (isSharedOrigin(ctx.origin)) return "SHARED";

  // Personal context (UI or personal-sync inbound): the member's policy decides.
  return isFieldShared(field.fieldType, field.label, ctx.policy) ? "SHARED" : "PRIVATE";
}

/**
 * Partition a set of edited fields into the shared and private layers in one
 * pass — the shape write paths consume (shared → Contact row, private →
 * ContactPrivateField rows for the owner).
 */
export function partitionEditByLayer<F extends EditField>(
  ctx: EditContext,
  fields: ReadonlyArray<F>,
): { shared: F[]; private: F[] } {
  const shared: F[] = [];
  const priv: F[] = [];
  for (const field of fields) {
    (resolveFieldLayer(ctx, field) === "SHARED" ? shared : priv).push(field);
  }
  return { shared, private: priv };
}

/**
 * Summary of the resolved context a caller can act on without re-deriving:
 * whether the write is happening in a shared vs personal share-context, and the
 * sync-link (if the edit came from sync). `layerFor` is the per-field decision.
 */
export type ResolvedEditContext = {
  shareContext: "personal" | "shared";
  fromSync: boolean;
  syncLink: SyncLinkContext | null;
  layerFor: (field: EditField) => EditLayer;
};

export function resolveEditContext(ctx: EditContext): ResolvedEditContext {
  const fromSync =
    ctx.origin.kind === "personal-sync" || ctx.origin.kind === "shared-sync";
  const syncLink =
    (ctx.origin.kind === "personal-sync" || ctx.origin.kind === "shared-sync"
      ? ctx.origin.syncLink
      : undefined) ?? null;
  return {
    shareContext: isSharedOrigin(ctx.origin) ? "shared" : "personal",
    fromSync,
    syncLink,
    layerFor: (field) => resolveFieldLayer(ctx, field),
  };
}
