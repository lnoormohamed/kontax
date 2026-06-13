"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { id: "users", label: "Users", href: "/admin/users" },
  { id: "metrics", label: "Metrics", href: "/admin/metrics" },
  { id: "flags", label: "Flags", href: "/admin/feature-flags" },
  { id: "broadcast", label: "Broadcast", href: "/admin/broadcast" },
  { id: "audit", label: "Audit Log", href: "/admin/audit" },
] as const;

function activeId(pathname: string): string {
  if (pathname.startsWith("/admin/metrics")) return "metrics";
  if (pathname.startsWith("/admin/feature-flags")) return "flags";
  if (pathname.startsWith("/admin/broadcast")) return "broadcast";
  if (pathname.startsWith("/admin/audit")) return "audit";
  return "users";
}

export function AdminMobileNav() {
  const pathname = usePathname() ?? "/admin/users";
  const active = activeId(pathname);

  return (
    <nav className="ad-mob-nav" aria-label="Admin navigation">
      {NAV.map((n) => (
        <Link
          key={n.id}
          href={n.href}
          className="ad-mob-nav__item"
          data-active={active === n.id ? "1" : "0"}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
