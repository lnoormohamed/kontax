import { WorkspaceIcon } from "~/app/_components/workspace-icons";

// P26-05 · shared contextual empty state (design P26-DB07 §2).
// A 64×64 muted tile + 30px icon, headline, body (max 320px), and an actions
// slot. Presentational + server-safe; callers compose the CTAs as children.
export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-14 text-center">
      <span className="mb-[18px] grid h-16 w-16 place-items-center rounded-[18px] bg-[#f2f4f0] text-[#8b938c]">
        <WorkspaceIcon name={icon} size={30} strokeWidth={1.6} />
      </span>
      <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#1d2823]">{title}</h2>
      <p className="mt-1.5 max-w-[320px] text-[14px] leading-[1.55] text-[#5c655e]">{body}</p>
      {children ? <div className="mt-5 flex flex-col items-center gap-3">{children}</div> : null}
    </div>
  );
}
