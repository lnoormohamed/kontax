"use client";

import type { SourceType } from "../../../generated/prisma";
import { formatLastMutatedBy } from "~/lib/activity/formatters";
import { formatRelativeTime } from "~/lib/activity/time";

// "Last edited" metadata row for the contact detail left rail. Matches the
// design's LastEditedLine: a label/value row ("Last edited" · "you · 2h ago").
// Client component so the relative timestamp tracks the live clock.
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
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[#8b938c]">Last edited</span>
      <span className="text-right text-[#5c655e]">
        {who} · {formatRelativeTime(updatedAt)}
      </span>
    </div>
  );
}
