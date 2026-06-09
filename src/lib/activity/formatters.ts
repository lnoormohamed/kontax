import type { SourceType } from "../../../generated/prisma";

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
    case "SHARED_STATIC":
      return detail ? `Shared by ${detail}` : "Shared with you";
    case "SHARED_LIVE":
      return detail ? `Live from ${detail}` : "Live share";
    case "API":
      return detail ? `Added via API (${detail})` : "Added via API";
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
    case "SHARED_STATIC":
    case "SHARED_LIVE":
      return detail ? `${detail} (share)` : "a share";
    case "API":
      return "the API";
    default:
      return "you";
  }
}
