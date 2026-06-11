"use client";

import type { SourceType } from "../../../generated/prisma";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { formatLastMutatedBy } from "~/lib/activity/formatters";
import { formatRelativeTime } from "~/lib/activity/time";

// Actor → icon glyph for the "Last edited" metadata row.
const ACTOR_ICON: Partial<Record<SourceType, string>> = {
  SYNC_CARDDAV: "sync",
  IMPORT_CSV: "upload",
  SHARED_STATIC: "download",
  SHARED_LIVE: "live",
};

/**
 * "Last edited" row for the contact detail metadata stack.
 * Format: "Last edited" (muted) | glyph + "who · time" (right).
 * Client component so the relative timestamp tracks the live clock.
 */
export function LastUpdatedBy({
  lastMutatedBy,
  lastMutatedByDetail,
  updatedAt,
}: {
  lastMutatedBy: SourceType;
  lastMutatedByDetail: string | null;
  updatedAt: string;
}) {
  const who = formatLastMutatedBy(lastMutatedBy, lastMutatedByDetail);
  const icon = ACTOR_ICON[lastMutatedBy] ?? "people";
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="shrink-0 text-[#8b938c]">Last edited</span>
      <span className="flex min-w-0 items-center gap-1.5 text-[#5c655e]">
        <WorkspaceIcon
          className="shrink-0 text-[#8b938c]"
          name={icon}
          size={13}
          strokeWidth={1.6}
        />
        <span className="truncate">
          {who} · {formatRelativeTime(updatedAt)}
        </span>
      </span>
    </div>
  );
}
