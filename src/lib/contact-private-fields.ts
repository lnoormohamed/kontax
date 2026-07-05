/**
 * P40-02 — Private-field overlay merge (source spec: phase-37/01 §3.2).
 *
 * A contact carries two layers:
 *   - the shared layer — values on the `Contact` row, visible to every member of
 *     a shared book the contact lives in;
 *   - the private layer — `ContactPrivateField` rows, each scoped to one owning
 *     `userId` and visible only to that user.
 *
 * A value lives in exactly one layer, so the merged view a viewer sees is:
 *
 *     shared ∪ { private rows where row.userId === viewerUserId }
 *
 * That single rule is symmetric and covers both acceptance cases:
 *   - the owner sees the shared row merged with their own private overlay;
 *   - any other book member has no private rows of their own on the contact, so
 *     they see the shared (base) row only.
 *
 * This module is the ONE place the overlay is merged. Every read consumer
 * (workspace, contact detail, export, sync/projection) routes through it so the
 * visibility rule is never re-implemented ad hoc — no consumer joins
 * ContactPrivateField directly.
 */

/** Field families that can carry a private overlay entry. */
export const PRIVATE_FIELD_TYPES = [
  "PHONE",
  "EMAIL",
  "ADDRESS",
  "NOTE",
  "BIRTHDAY",
  "LABEL",
  "CUSTOM",
] as const;

export type PrivateFieldType = (typeof PRIVATE_FIELD_TYPES)[number];

/**
 * A stored private-field row, narrowed to what the merge needs. `value` holds
 * the same entry shape as the matching Contact JSON field. `E` lets callers
 * keep their concrete entry type through the merge.
 */
export type ContactPrivateFieldRow<E = unknown> = {
  userId: string;
  fieldType: string;
  label?: string | null;
  value: E;
  position?: number | null;
};

const isKnownFieldType = (value: string): value is PrivateFieldType =>
  (PRIVATE_FIELD_TYPES as readonly string[]).includes(value);

const byPosition = (
  a: ContactPrivateFieldRow<unknown>,
  b: ContactPrivateFieldRow<unknown>,
) => (a.position ?? 0) - (b.position ?? 0);

/**
 * The private rows a viewer is allowed to see on a contact: only the rows they
 * own. This is the single visibility gate — everything else builds on it.
 */
export function selectVisiblePrivateFields<E>(
  privateFields: ReadonlyArray<ContactPrivateFieldRow<E>>,
  viewerUserId: string | null | undefined,
): ContactPrivateFieldRow<E>[] {
  if (!viewerUserId) return [];
  return privateFields.filter((row) => row.userId === viewerUserId);
}

/**
 * The viewer's visible private entries, grouped by field type and ordered by
 * `position`. Unknown field types are dropped so a bad row can't leak.
 */
export function buildPrivateOverlay<E>(
  privateFields: ReadonlyArray<ContactPrivateFieldRow<E>>,
  viewerUserId: string | null | undefined,
): Partial<Record<PrivateFieldType, E[]>> {
  const overlay: Partial<Record<PrivateFieldType, E[]>> = {};
  for (const row of selectVisiblePrivateFields(privateFields, viewerUserId).sort(
    byPosition,
  )) {
    if (!isKnownFieldType(row.fieldType)) continue;
    (overlay[row.fieldType] ??= []).push(row.value);
  }
  return overlay;
}

/**
 * Merge a viewer's private overlay onto the shared per-field-type entries,
 * appending the viewer's own private entries (ordered by position) after the
 * shared ones. A non-owner viewer contributes nothing, so they get the shared
 * entries unchanged.
 */
export function mergeContactPrivateFields<E>(params: {
  shared: Partial<Record<PrivateFieldType, E[]>>;
  privateFields: ReadonlyArray<ContactPrivateFieldRow<E>>;
  viewerUserId: string | null | undefined;
}): Record<PrivateFieldType, E[]> {
  const overlay = buildPrivateOverlay(params.privateFields, params.viewerUserId);
  const merged = {} as Record<PrivateFieldType, E[]>;
  for (const fieldType of PRIVATE_FIELD_TYPES) {
    merged[fieldType] = [
      ...(params.shared[fieldType] ?? []),
      ...(overlay[fieldType] ?? []),
    ];
  }
  return merged;
}

/** True when the viewer has any private overlay entry on the contact. */
export function hasVisiblePrivateFields(
  privateFields: ReadonlyArray<ContactPrivateFieldRow<unknown>>,
  viewerUserId: string | null | undefined,
): boolean {
  return selectVisiblePrivateFields(privateFields, viewerUserId).length > 0;
}
