import { SkeletonBlock } from "~/app/_components/skeleton";

// P49A-17 — shown while a settings sub-page's data is loading. settings/
// has its own layout.tsx (sidebar, header, nav) that renders immediately;
// this only needs to fill the content pane it wraps around {children}.
export default function SettingsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading settings" className="grid gap-4" role="status">
      <SkeletonBlock className="h-[20px] w-40" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6" key={i}>
          <SkeletonBlock className="h-[14px] w-32" />
          <SkeletonBlock className="mt-4 h-[10px] w-full max-w-[420px]" />
          <SkeletonBlock className="mt-2 h-[10px] w-full max-w-[320px]" />
        </div>
      ))}
    </div>
  );
}
