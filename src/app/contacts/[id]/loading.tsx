import { SkeletonBlock, SkeletonCircle, SkeletonTopBar } from "~/app/_components/skeleton";

// P49A-17 — its own fallback so opening a contact doesn't flash the contacts
// list skeleton from `contacts/loading.tsx` (the nearest boundary otherwise).
export default function ContactDetailLoading() {
  return (
    <div aria-busy="true" aria-label="Loading contact" role="status">
      <SkeletonTopBar />
      <div className="mx-auto w-full max-w-[760px] px-4 py-6 lg:px-6">
        <div className="flex items-center gap-4">
          <SkeletonCircle size={64} />
          <div className="flex-1">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="mt-2 h-4 w-32" />
          </div>
        </div>
        <div className="mt-6 grid gap-3 rounded-[14px] border border-[#e9ece7] bg-white p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock className="h-10 w-full" key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
