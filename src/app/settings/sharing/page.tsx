import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";

export const metadata: Metadata = { title: "Sharing & groups — Kontax" };

// P46-12 / DB07 §5c — the Sharing & groups index. Children keep their current
// URLs until P46-16 moves them under /settings/sharing/* (with 301s). The
// gated-row rule applies: Family/Teams always link to their own pages, which
// render their own upsell when no group exists.
const ROWS = [
  { icon: "arrowDownLeft", label: "Shared with me", sub: "Contacts other people shared to you", href: "/shares" },
  { icon: "users", label: "Family", sub: "Shared family book & members", href: "/settings/family" },
  { icon: "team", label: "Teams", sub: "Team books, members & permissions", href: "/settings/teams" },
] as const;

export default async function SettingsSharingIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="hidden text-2xl font-semibold text-[#1d2823] lg:block">Sharing &amp; groups</h1>
      <p className="mt-1 hidden text-sm text-[#5c655e] lg:block">
        The people surfaces — what&apos;s shared with you, and the groups you share with.
      </p>
      <div className="mt-0 overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white lg:mt-5">
        {ROWS.map((row, i) => (
          <Link
            key={row.label}
            href={row.href}
            className="flex items-center gap-3 px-4 py-3.5 no-underline"
            style={{ borderBottom: i < ROWS.length - 1 ? "1px solid #f2f4f0" : "none" }}
          >
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[#f2f4f0]">
              <WorkspaceIcon name={row.icon} size={17} className="text-[#5c655e]" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-[#1d2823]">{row.label}</span>
              <span className="block truncate text-[12.5px] text-[#8b938c]">{row.sub}</span>
            </span>
            <WorkspaceIcon name="chevronRight" size={17} className="shrink-0 text-[#d8ddd6]" strokeWidth={1.7} />
          </Link>
        ))}
      </div>
    </div>
  );
}
