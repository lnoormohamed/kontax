"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

type SharedEntry = { id: "family" | "teams"; label: string; icon: string };

type SettingsSidebarProps = {
  account: { name: string; email: string; plan: string };
  /** Family/Team entries the user actually belongs to (owner or member). */
  shared: SharedEntry[];
};

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const SECTIONS = [
  { href: "/settings", icon: "briefcase", label: "Plan & billing" },
  { href: "/settings/profile", icon: "people", label: "Profile" },
  { href: "/settings/account", icon: "person", label: "Account" },
  { href: "/settings/preferences", icon: "gear", label: "Preferences" },
  { href: "/settings/notifications", icon: "bell", label: "Notifications" },
  { href: "/settings/devices", icon: "phone", label: "Devices & app passwords" },
  { href: "/sync", icon: "sync", label: "Sync connections" },
  { href: "/settings/security", icon: "emergency", label: "Security & session" },
] as const;

const JUMP_LINKS = [
  { href: "/import-export", icon: "upload", label: "Import & export" },
  { href: "/merge/manual", icon: "merge", label: "Merge review" },
] as const;

export function SettingsSidebar({ account, shared }: SettingsSidebarProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/settings") return pathname === "/settings";
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const sharedActive = pathname.startsWith("/settings/family") || pathname.startsWith("/settings/teams");

  const eyebrow = (label: string) => (
    <div className="mt-4 mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b938c]">
      {label}
    </div>
  );

  const navButton = (
    href: string,
    icon: string,
    label: string,
    active: boolean,
    opts?: { muted?: boolean; badge?: string },
  ) => (
    <Link
      className={`flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition ${
        active ? "bg-[#e7efe9] text-[#17352e]" : "text-[#5c655e] hover:bg-[#f2f4f0]"
      }`}
      href={href}
      key={href}
      onClick={() => setDrawerOpen(false)}
    >
      <WorkspaceIcon name={icon} size={18} />
      <span className={`flex-1 ${opts?.muted ? "text-[#8b938c]" : ""}`}>{label}</span>
      {opts?.badge ? (
        <span className="rounded-full bg-[#f2f4f0] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#8b938c]">
          {opts.badge}
        </span>
      ) : null}
    </Link>
  );

  const body = (
    <>
      <Link
        className="mb-1 flex items-center gap-3 rounded-xl border border-[#e9ece7] bg-[#f6f7f4] p-2.5 transition hover:bg-[#f2f4f0]"
        href="/settings/profile"
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

      {eyebrow("Account")}
      {SECTIONS.map((s) => navButton(s.href, s.icon, s.label, isActive(s.href)))}

      {eyebrow("Shared")}
      {shared.length > 0
        ? shared.map((s) =>
            navButton(`/settings/${s.id}`, s.icon, s.label, isActive(`/settings/${s.id}`)),
          )
        : navButton("/settings/family", "users", "Family & teams", sharedActive, {
            muted: true,
            badge: "Plan",
          })}

      <div className="mt-auto border-t border-[#e9ece7] pt-2">
        {eyebrow("Jump to")}
        {JUMP_LINKS.map((l) => (
          <Link
            className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium text-[#8b938c] transition hover:bg-[#f2f4f0] hover:text-[#5c655e]"
            href={l.href}
            key={l.label}
            onClick={() => setDrawerOpen(false)}
          >
            <WorkspaceIcon name={l.icon} size={15} />
            <span className="flex-1">{l.label}</span>
          </Link>
        ))}
      </div>
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
