import { SkeletonBlock, SkeletonCircle, SkeletonTopBar } from "~/app/_components/skeleton";

// P49A-17 — shown while the sync page's accounts, job history and health data
// are loading. The real page shows a list of sync-account cards; this mirrors
// that shape without any of the data.
export default function SyncLoading() {
  return (
    <div aria-busy="true" aria-label="Loading sync" role="status">
      <SkeletonTopBar />
      <div className="mx-auto grid w-full max-w-[720px] gap-3 px-4 py-6 lg:px-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="flex items-center gap-3 rounded-[14px] border border-[#e9ece7] bg-white p-4" key={i}>
            <SkeletonCircle size={40} />
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-[13px] w-[45%]" />
              <SkeletonBlock className="mt-2 h-[10px] w-[65%]" />
            </div>
            <SkeletonBlock className="h-7 w-20 rounded-[9px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
