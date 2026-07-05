"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { isSettingsNavActive, SETTINGS_NAV } from "~/lib/settings-nav";

// P46-12 / DB07 §5a — the desktop settings sidebar: the shared SETTINGS_NAV
// config rendered with quiet eyebrow dividers. Same entry set as the mobile
// index by construction (the completeness invariant). The old hand-maintained
// SECTIONS / shared-entries / "Jump to" structures are gone — Merge review
// leaves settings (DB07 T6), import/export is reached via Data & sync.

type SettingsSidebarProps = {
  account: { name: string; email: string; plan: string };
};

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function SettingsSidebar({ account }: SettingsSidebarProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const eyebrow = (label: string) => (
    <div
      className="mt-4 mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b938c]"
      key={`eyebrow-${label}`}
    >
      {label}
    </div>
  );

  const body = (
    <>
      <Link
        className="mb-1 flex items-center gap-3 rounded-xl border border-[#e9ece7] bg-[#f6f7f4] p-2.5 transition hover:bg-[#f2f4f0]"
        href="/settings/account"
        onClick={() => setDrawerOpen(false)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17352e] text-xs font-semibold text-[#dff0e7]">
          {getInitials(account.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[#1d2823]">{account.name}</span>
          <span className="block truncate text-[11px] text-[#8b938c]">{account.email}</span>
        </span>
        <span className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#17352e]">
          {account.plan}
        </span>
      </Link>

      {SETTINGS_NAV.map((entry) => {
        const active = isSettingsNavActive(entry.route, pathname);
        return (
          <span key={entry.id} className="contents">
            {entry.divider ? eyebrow(entry.divider) : null}
            <Link
              className={`flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition ${
                active ? "bg-[#e7efe9] text-[#17352e]" : "text-[#5c655e] hover:bg-[#f2f4f0]"
              }`}
              href={entry.route}
              onClick={() => setDrawerOpen(false)}
            >
              <WorkspaceIcon name={entry.icon} size={18} />
              <span className="flex-1">{entry.label}</span>
              {entry.gate === "pro" ? (
                <span className="rounded-full bg-[#edf0fe] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#4158f4]">
                  Pro
                </span>
              ) : null}
            </Link>
          </span>
        );
      })}
    </>
  );

  return (
    <>
      {/* desktop */}
      <aside className="hidden w-[248px] shrink-0 flex-col overflow-y-auto border-r border-[#d8ddd6] bg-white px-3 py-3.5 lg:flex">
        {body}
      </aside>

      {/* mobile trigger */}
      <button
        aria-label="Open settings menu"
        className="m-3 inline-flex h-9 items-center gap-2 self-start rounded-lg border border-[#d8ddd6] bg-white px-3 text-[13px] font-medium text-[#5c655e] lg:hidden"
        onClick={() => setDrawerOpen(true)}
        type="button"
      >
        <WorkspaceIcon name="more" size={16} />
        Settings menu
      </button>

      {/* mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close settings menu"
            className="absolute inset-0 bg-[rgba(15,23,42,0.4)]"
            onClick={() => setDrawerOpen(false)}
            type="button"
          />
          <aside className="absolute left-0 top-0 flex h-full w-[280px] flex-col overflow-y-auto border-r border-[#d8ddd6] bg-white px-3 py-3.5">
            <button
              className="mb-2 inline-flex h-8 items-center gap-2 self-start rounded-lg px-2 text-[13px] font-medium text-[#5c655e] hover:bg-[#f2f4f0]"
              onClick={() => setDrawerOpen(false)}
              type="button"
            >
              <WorkspaceIcon name="x" size={16} /> Close
            </button>
            {body}
          </aside>
        </div>
      ) : null}
    </>
  );
}
