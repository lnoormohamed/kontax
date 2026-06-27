"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeAdminNavId, type AdminNavGroup } from "./admin-nav";

export function AdminMobileNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname() ?? "/admin";
  const active = activeAdminNavId(pathname);

  return (
    <nav className="ad-mob-nav" aria-label="Admin navigation">
      {groups.map((group) => (
        <div key={group.id} className="ad-mob-nav__group">
          <div className="ad-mob-nav__label">{group.label}</div>
          <div className="ad-mob-nav__items">
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="ad-mob-nav__item"
                data-active={active === item.id ? "1" : "0"}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
