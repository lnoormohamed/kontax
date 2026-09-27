import { SkeletonBlock, SkeletonCircle, SkeletonTopBar } from "~/app/_components/skeleton";

// P49A-17 — shown while a merge suggestion's two contacts and field-by-field
// comparison are loading. Mirrors the review page's side-by-side shape.
function ContactCardSkeleton() {
  return (
    <div className="rounded-[14px] border border-[#e9ece7] bg-white p-4">
      <div className="flex items-center gap-3">
        <SkeletonCircle size={44} />
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-[13px] w-[65%]" />
          <SkeletonBlock className="mt-2 h-[10px] w-[40%]" />
        </div>
      </div>
      <div className="mt-4 grid gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock className="h-[10px]" key={i} style={{ width: `${75 - i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}

export default function MergeReviewLoading() {
  return (
    <div aria-busy="true" aria-label="Loading merge review" role="status">
      <SkeletonTopBar />
      <div className="mx-auto w-full max-w-[840px] px-4 py-6 lg:px-6">
        <SkeletonBlock className="h-[18px] w-56" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ContactCardSkeleton />
          <ContactCardSkeleton />
        </div>
      </div>
    </div>
  );
}
