import type { Actor, EventType, SourceType } from "../../../generated/prisma";

/**
 * Human-readable origin label for the contact-detail source badge (P10-03).
 * `sourceType` is the origin; `sourceDetail` is the specific instance (filename,
 * sync account label, or sender name).
 */
export function formatSourceBadge(
  sourceType: SourceType,
  sourceDetail?: string | null,
): string {
  const detail = sourceDetail?.trim();
  switch (sourceType) {
    case "MANUAL":
      return "Added manually";
    case "IMPORT_CSV":
      return detail ? `Imported from ${detail}` : "Imported";
    case "SYNC_CARDDAV":
      return detail ? `Synced from ${detail}` : "Synced";
    case "SYNC_GOOGLE":
      return detail ? `Synced from ${detail}` : "Synced from Google";
    case "SYNC_MICROSOFT":
      return detail ? `Synced from ${detail}` : "Synced from Outlook";
    case "SHARED_STATIC":
      return detail ? `Shared by ${detail}` : "Shared with you";
    case "SHARED_LIVE":
      return detail ? `Live from ${detail}` : "Live share";
    case "API":
      return detail ? `Added via API (${detail})` : "Added via API";
    case "CARD_IMPORT":
      return detail ? `Saved from Kontax card (${detail.replace("card:", "")})` : "Saved from Kontax card";
    default:
      return "Added manually";
  }
}

/**
 * Short "last updated by" descriptor for the detail-page metadata line.
 */
export function formatLastMutatedBy(
  lastMutatedBy: SourceType,
  lastMutatedByDetail?: string | null,
): string {
  const detail = lastMutatedByDetail?.trim();
  switch (lastMutatedBy) {
    case "MANUAL":
      return "you";
    case "IMPORT_CSV":
      return detail ? `import (${detail})` : "an import";
    case "SYNC_CARDDAV":
      return detail ? `${detail} sync` : "sync";
    case "SYNC_GOOGLE":
      return detail ? `${detail} sync` : "Google sync";
    case "SYNC_MICROSOFT":
      return detail ? `${detail} sync` : "Outlook sync";
    case "SHARED_STATIC":
    case "SHARED_LIVE":
      return detail ? `${detail} (share)` : "a share";
    case "API":
      return "the API";
    case "CARD_IMPORT":
      return "a Kontax card";
    default:
      return "you";
  }
}

// --- Activity feed formatting (P10-04) ---

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Actor label for the per-event "by …" descriptor and the last-updated line. */
export function formatActorLabel(actor: Actor, actorDetail?: string | null): string {
  const detail = actorDetail?.trim();
  switch (actor) {
    case "USER":
      return "You";
    case "SYNC":
      return detail ? `${detail} sync` : "Sync";
    case "IMPORT":
      return detail ? `${detail}` : "Import";
    case "SHARE":
      return detail ? `${detail}` : "Share";
    case "FAMILY_MEMBER":
      return detail ?? "Family member";
    case "TEAM_MEMBER":
      return detail ?? "Team member";
    case "SYSTEM":
      return "Kontax";
    default:
      return "Someone";
  }
}

/** Icon name (maps to WorkspaceIcon) for an actor. */
export function actorIconName(actor: Actor): string {
  switch (actor) {
    case "SYNC":
      return "sync";
    case "IMPORT":
      return "upload";
    case "SHARE":
      return "download";
    case "FAMILY_MEMBER":
    case "TEAM_MEMBER":
      return "people";
    case "SYSTEM":
      return "gear";
    case "USER":
    default:
      return "people";
  }
}

const countDiffs = (payload: unknown): number =>
  isRecord(payload) && Array.isArray(payload.diffs) ? payload.diffs.length : 0;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const getPayloadString = (payload: unknown, key: string): string | null =>
  isRecord(payload) && typeof payload[key] === "string" && payload[key].trim().length > 0
    ? payload[key].trim()
    : null;

const getUnsupportedFieldFamilies = (payload: unknown): string[] =>
  isRecord(payload) && Array.isArray(payload.unsupportedFieldFamilies)
    ? payload.unsupportedFieldFamilies.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];

const getUnsupportedFieldCount = (payload: unknown): number =>
  isRecord(payload) && typeof payload.unsupportedFieldCount === "number"
    ? payload.unsupportedFieldCount
    : 0;

const formatUnsupportedFieldFamilies = (families: string[]) => {
  const labels = [...new Set(families)].map((family) => {
    switch (family) {
      case "significantDates":
        return "significant dates";
      default:
        return "unsupported fields";
    }
  });

  if (labels.length === 0) {
    return "unsupported fields";
  }
  if (labels.length === 1) {
    return labels[0]!;
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
};

const formatUnsupportedFieldSuffix = (payload: unknown) => {
  const families = getUnsupportedFieldFamilies(payload);
  if (families.length === 0) {
    return "";
  }

  const familyLabel = formatUnsupportedFieldFamilies(families);
  const unsupportedFieldCount = getUnsupportedFieldCount(payload);

  if (unsupportedFieldCount > 0) {
    return ` · ${familyLabel} kept in Kontax (${plural(
      unsupportedFieldCount,
      "field",
    )})`;
  }

  return ` · ${familyLabel} kept in Kontax`;
};

/** One-line human summary for an activity event. */
export function formatEventSummary(
  eventType: EventType,
  payload: unknown,
  actorDetail?: string | null,
): string {
  const detail = actorDetail?.trim();
  switch (eventType) {
    case "CONTACT_CREATED":
      return "Contact added";
    case "CONTACT_UPDATED": {
      const n = countDiffs(payload);
      return n > 0 ? `Updated · ${plural(n, "field")} changed` : "Updated";
    }
    case "CONTACT_ARCHIVED":
      return detail === "merged" ? "Archived (merged)" : "Archived";
    case "CONTACT_RESTORED":
      return "Restored from archive";
    case "CONTACT_DELETED":
      return "Deleted";
    case "CONTACT_MERGED": {
      const name = isRecord(payload) && typeof payload.absorbedContactName === "string"
        ? payload.absorbedContactName
        : null;
      return name ? `Merged with ${name}` : "Merged";
    }
    case "CONTACT_MERGE_UNDONE":
      return "Merge undone";
    case "CONTACT_IMPORTED":
      return detail ? `Imported from ${detail}` : "Imported";
    case "CONTACT_SHARED":
      return "Shared";
    case "CONTACT_SHARE_RECEIVED":
      return detail ? `Received via share from ${detail}` : "Received via share";
    case "SYNC_PULLED": {
      const n = countDiffs(payload);
      const from = detail ? ` from ${detail}` : "";
      const base = n > 0 ? `Pulled${from} · ${plural(n, "field")} updated` : `Pulled${from}`;
      return `${base}${formatUnsupportedFieldSuffix(payload)}`;
    }
    case "SYNC_PUSHED": {
      const base = detail ? `Pushed to ${detail}` : "Pushed";
      return `${base}${formatUnsupportedFieldSuffix(payload)}`;
    }
    case "SYNC_CONFLICT_DETECTED":
      return detail ? `Sync conflict detected with ${detail}` : "Sync conflict detected";
    case "SYNC_CONFLICT_RESOLVED": {
      const strat =
        isRecord(payload) && typeof payload.resolutionStrategy === "string"
          ? payload.resolutionStrategy
          : null;
      return strat ? `Sync conflict resolved (${strat})` : "Sync conflict resolved";
    }
    case "SYNC_CONNECTION_CONNECTED": {
      const label = getPayloadString(payload, "label");
      return label ? `${label} connected` : "Sync account connected";
    }
    case "SYNC_CONNECTION_RECONNECTED": {
      const label = getPayloadString(payload, "label");
      return label ? `${label} reconnected` : "Sync account reconnected";
    }
    case "SYNC_CONNECTION_DISCONNECTED": {
      const label = getPayloadString(payload, "label");
      return label ? `${label} disconnected` : "Sync account disconnected";
    }
    case "SYNC_CONNECTION_RETIRED": {
      const label = getPayloadString(payload, "label");
      return label ? `${label} connection retired` : "Sync account retired";
    }
    case "SYNC_CONNECTION_REPLACED": {
      const label = getPayloadString(payload, "label");
      return label ? `New ${label} connection created` : "New sync connection created";
    }
    default:
      return "Updated";
  }
}
