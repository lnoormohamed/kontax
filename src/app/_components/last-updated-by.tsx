"use client";

import type { SourceType } from "../../../generated/prisma";
import { formatLastMutatedBy } from "~/lib/activity/formatters";
import { formatRelativeTime } from "~/lib/activity/time";

// Client component so the relative timestamp is computed from the live clock
// (avoids a stale SSR value).
export function LastUpdatedBy({
  lastMutatedBy,
  lastMutatedByDetail,
  updatedAt,
}: {
  lastMutatedBy: SourceType;
  lastMutatedByDetail: string | null;
  updatedAt: string;
}) {
  return (
    <p className="text-xs text-white/70">
      Last updated by {formatLastMutatedBy(lastMutatedBy, lastMutatedByDetail)} ·{" "}
      {formatRelativeTime(updatedAt)}
    </p>
  );
}
