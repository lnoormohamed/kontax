"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AD, AdIcon } from "./admin-icons";

const NAV = [
  { id: "users", label: "Users", icon: "users", href: "/admin/users" },
  { id: "metrics", label: "Metrics", icon: "metrics", href: "/admin/metrics" },
  { id: "flags", label: "Feature Flags", icon: "flag", href: "/admin/feature-flags" },
  { id: "audit", label: "Audit Log", icon: "audit", href: "/admin/audit" },
] as const;

function activeId(pathname: string): string {
  if (pathname.startsWith("/admin/metrics")) return "metrics";
  if (pathname.startsWith("/admin/feature-flags")) return "flags";
  if (pathname.startsWith("/admin/audit")) return "audit";
  // /admin/users, /admin/users/[id], and /admin all map to Users.
  return "users";
}

export function AdminSidebar() {
  const pathname = usePathname() ?? "/admin/users";
  const active = activeId(pathname);

  return (
    <aside className="ad-side">
      <div className="ad-side-brand">
        <span className="ad-brand-k">K</span>
        <span className="ad-brand-word">Kontax</span>
        <span className="ad-admin-badge">Admin</span>
      </div>
      <nav className="ad-side-nav">
        {NAV.map((n) => (
          <Link
            key={n.id}
            href={n.href}
            className="ad-nav"
            data-active={active === n.id ? "1" : "0"}
          >
            <span className="ad-nav-bar" />
            <AdIcon name={n.icon} size={18} c={active === n.id ? AD.ink : AD.ink2} w={active === n.id ? 1.9 : 1.7} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
      <div className="ad-side-foot">
        <Link className="ad-exit" href="/contacts">
          <AdIcon name="exit" size={17} c={AD.mute} />
          <span>Exit admin</span>
        </Link>
      </div>
    </aside>
  );
}
