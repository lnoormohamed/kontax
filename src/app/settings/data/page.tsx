import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";

export const metadata: Metadata = { title: "Data & sync — Kontax" };

// P46-12 / DB07 §5c — the Data & sync group index. /sync and /import-export
// stay workspace-level surfaces, LINKED from here (↗); children keep their
// current URLs until P46-14/15 move them (each move lands with its 301).
const ROWS = [
  { icon: "sync", label: "Sync connections", sub: "Google, iCloud, CardDAV", href: "/sync", external: true },
  { icon: "upload", label: "Import & export", sub: "CSV, vCard · saved presets", href: "/import-export", external: true },
  { icon: "book", label: "Books", sub: "Personal book index", href: "/settings/books" },
  { icon: "phone", label: "Connect a device", sub: "CardDAV setup · app passwords", href: "/settings/devices" },
  // TODO(P46-14/15): moves to /settings/data/export; lives on Account today.
  { icon: "download", label: "Download your data", sub: "Full account export", href: "/settings/account" },
] as const;

export default async function SettingsDataIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="hidden text-2xl font-semibold text-[#1d2823] lg:block">Data &amp; sync</h1>
      <p className="mt-1 hidden text-sm text-[#5c655e] lg:block">
        Everything about getting contact data in, out, and kept in sync.
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
              <span className="block text-[15px] font-medium text-[#1d2823]">
                {row.label}
                {"external" in row && row.external ? (
                  <span className="ml-1.5 text-[12px] text-[#8b938c]">↗</span>
                ) : null}
              </span>
              <span className="block truncate text-[12.5px] text-[#8b938c]">{row.sub}</span>
            </span>
            <WorkspaceIcon name="chevronRight" size={17} className="shrink-0 text-[#d8ddd6]" strokeWidth={1.7} />
          </Link>
        ))}
      </div>
    </div>
  );
}
