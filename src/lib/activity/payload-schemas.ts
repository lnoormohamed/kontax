import { z } from "zod";

import type { EventType } from "../../../generated/prisma";

/**
 * Zod payload schemas, one per ActivityEvent type (P10-01).
 *
 * The `payload` column is `Json` in Prisma; these schemas are the application-
 * layer contract. `emitEvent` validates against the matching schema before any
 * write, so payloads are always well-formed. Field keys use canonical Prisma
 * field names (not display labels) so UI label changes never break diff rendering.
 */

export const fieldDiffSchema = z.object({
  field: z.string().min(1),
  before: z.unknown(),
  after: z.unknown(),
});
export type FieldDiff = z.infer<typeof fieldDiffSchema>;

const empty = z.object({}).strict();

const contactUpdated = z.object({
  diffs: z.array(fieldDiffSchema).min(1),
});

const contactDeleted = z.object({
  fullName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

const contactMerged = z.object({
  absorbedContactId: z.string(),
  absorbedContactName: z.string(),
  fieldResolutions: z.array(
    z.object({
      field: z.string(),
      chosenFrom: z.enum(["left", "right", "both"]),
    }),
  ),
});

const contactMergeUndone = z.object({
  restoredContactId: z.string(),
  originalMergeEventId: z.string().optional(),
});

const contactImported = z.object({
  importJobId: z.string(),
  sourceFileName: z.string(),
  rowIndex: z.number().int().optional(),
});

const contactShared = z.object({
  shareToken: z.string().optional(),
  recipientHint: z.string().optional(),
});

// Sync payloads: what changed (optional diffs) + conflict linkage. Permissive
// because remote shape varies; all fields optional.
const syncMutation = z.object({
  diffs: z.array(fieldDiffSchema).optional(),
  syncAccountId: z.string().optional(),
  syncAccountLabel: z.string().optional(),
});

const syncConflictDetected = z.object({
  conflictId: z.string().optional(),
  conflictType: z.string().optional(),
  remoteETag: z.string().optional(),
});

const syncConflictResolved = z.object({
  conflictId: z.string().optional(),
  resolutionStrategy: z.string().optional(),
});

// P23-06: audit record for a sync connection settings change. `changes` is a list
// of field diffs (direction / conflictPolicy / syncFrequencyMinutes / bookAllowlist).
const syncSettingsChanged = z.object({
  syncAccountId: z.string(),
  changes: z.array(fieldDiffSchema),
});

export const EVENT_PAYLOAD_SCHEMAS = {
  CONTACT_CREATED: empty,
  CONTACT_UPDATED: contactUpdated,
  CONTACT_ARCHIVED: empty,
  CONTACT_RESTORED: empty,
  CONTACT_DELETED: contactDeleted,
  CONTACT_MERGED: contactMerged,
  CONTACT_MERGE_UNDONE: contactMergeUndone,
  CONTACT_IMPORTED: contactImported,
  CONTACT_SHARED: contactShared,
  CONTACT_SHARE_RECEIVED: contactShared,
  SYNC_PULLED: syncMutation,
  SYNC_PUSHED: syncMutation,
  SYNC_CONFLICT_DETECTED: syncConflictDetected,
  SYNC_CONFLICT_RESOLVED: syncConflictResolved,
  SYNC_SETTINGS_CHANGED: syncSettingsChanged,
  ACCOUNT_UPDATED: z.object({ field: z.string() }).strict(),
} satisfies Record<EventType, z.ZodTypeAny>;

export type EventPayloadMap = {
  [K in EventType]: z.infer<(typeof EVENT_PAYLOAD_SCHEMAS)[K]>;
};
