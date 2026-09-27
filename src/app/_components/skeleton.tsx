// P49A-17 — shared loading-skeleton primitives for route-level `loading.tsx`
// files. Same convention already used ad hoc in a few places (ContactHistory,
// SearchResults): `animate-pulse` blocks on the app's neutral placeholder
// colour (`#eceee9`), pulled out so every route's skeleton looks consistent.

export function SkeletonBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <span className={`block animate-pulse rounded-[6px] bg-[#eceee9] ${className}`} style={style} />;
}

export function SkeletonCircle({ size = 36 }: { size?: number }) {
  return (
    <span
      className="block shrink-0 animate-pulse rounded-full bg-[#eceee9]"
      style={{ width: size, height: size }}
    />
  );
}

/** A row shaped like a contact / list entry: avatar + two lines of text. */
export function SkeletonRow({ avatarSize = 36 }: { avatarSize?: number }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <SkeletonCircle size={avatarSize} />
      <div className="min-w-0 flex-1">
        <SkeletonBlock className="h-[11px] w-[52%]" />
        <SkeletonBlock className="mt-2 h-[9px] w-[28%]" />
      </div>
    </div>
  );
}

/** Top bar shared by the signed-in app shell: title + a couple of controls. */
export function SkeletonTopBar() {
  return (
    <div
      aria-hidden
      className="flex h-14 items-center gap-3 border-b border-[#e9ece7] bg-white/95 px-4 backdrop-blur lg:px-6"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#17352e] text-[13px] font-bold text-[#dff0e7]">
        K
      </span>
      <SkeletonBlock className="h-[14px] w-32" />
      <span className="flex-1" />
      <SkeletonCircle size={32} />
    </div>
  );
}
