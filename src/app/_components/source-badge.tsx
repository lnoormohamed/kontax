import type { SourceType } from "../../../generated/prisma";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { formatSourceBadge } from "~/lib/activity/formatters";

// Maps each source type to the closest WorkspaceIcon glyph.
// share = outgoing arrow-box (SHARED_STATIC = received copy, so "download"),
// live = broadcast/signal for SHARED_LIVE.
const ICON_BY_SOURCE: Record<SourceType, string> = {
  MANUAL: "people",
  IMPORT_CSV: "upload",
  SYNC_CARDDAV: "sync",
  SHARED_STATIC: "download",
  SHARED_LIVE: "live",
  API: "gear",
};

/**
 * Quiet, non-interactive origin chip (P10-04). Sits last in the badge cluster
 * on the contact detail left rail. Light palette: neutral surface, muted text.
 */
export function SourceBadge({
  sourceType,
  sourceDetail,
}: {
  sourceType: SourceType;
  sourceDetail: string | null;
}) {
  const label = formatSourceBadge(sourceType, sourceDetail);
  return (
    <span
      className="inline-flex max-w-[220px] items-center gap-1.5 overflow-hidden rounded-[7px] border border-[#d8ddd6] bg-[#f2f4f0] px-2.5 py-[3px]"
      title={label}
    >
      <WorkspaceIcon
        className="shrink-0 text-[#8b938c]"
        name={ICON_BY_SOURCE[sourceType] ?? "people"}
        size={13}
        strokeWidth={1.6}
      />
      <span className="truncate text-[12px] font-medium text-[#5c655e]">{label}</span>
    </span>
  );
}
