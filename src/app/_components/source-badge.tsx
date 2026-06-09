import type { SourceType } from "../../../generated/prisma";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { formatSourceBadge } from "~/lib/activity/formatters";

const ICON_BY_SOURCE: Record<SourceType, string> = {
  MANUAL: "people",
  IMPORT_CSV: "upload",
  SYNC_CARDDAV: "sync",
  SHARED_STATIC: "download",
  SHARED_LIVE: "download",
  API: "gear",
};

// Informational origin chip for the contact detail page (P10-04). Not a link.
export function SourceBadge({
  sourceType,
  sourceDetail,
}: {
  sourceType: SourceType;
  sourceDetail: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90">
      <WorkspaceIcon name={ICON_BY_SOURCE[sourceType] ?? "people"} size={13} />
      {formatSourceBadge(sourceType, sourceDetail)}
    </span>
  );
}
