import { SkeletonBlock, SkeletonRow, SkeletonTopBar } from "~/app/_components/skeleton";

// P49A-17 — shown while the contacts workspace's data (counts, contact list,
// onboarding state, …) is loading. Mirrors the shape of the real page loosely
// (top bar + search + a list of rows) without needing any of its data.
export default function ContactsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading contacts" role="status">
      <SkeletonTopBar />
      <div className="mx-auto w-full max-w-[900px] px-4 py-5 lg:px-6">
        <SkeletonBlock className="h-10 w-full max-w-[560px] rounded-[10px]" />
        <div className="mt-5 rounded-[14px] border border-[#e9ece7] bg-white">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="border-b border-[#edf0ea] last:border-b-0" key={i}>
              <SkeletonRow />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
