"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AD, AdIcon } from "./admin-icons";
import { activeAdminNavId, type AdminNavGroup } from "./admin-nav";

export function AdminSidebar({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname() ?? "/admin";
  const active = activeAdminNavId(pathname);

  return (
    <aside className="ad-side">
      <div className="ad-side-brand">
        <span className="ad-brand-k">K</span>
        <span className="ad-brand-word">Kontax</span>
        <span className="ad-admin-badge">Admin</span>
      </div>
      <nav className="ad-side-nav">
        {groups.map((group) => (
          <div key={group.id} className="ad-side-section">
            <div className="ad-side-section__label">{group.label}</div>
            <div className="ad-side-section__items">
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="ad-nav"
                  data-active={active === item.id ? "1" : "0"}
                >
                  <span className="ad-nav-bar" />
                  <AdIcon
                    name={item.icon}
                    size={18}
                    c={active === item.id ? AD.ink : AD.ink2}
                    w={active === item.id ? 1.9 : 1.7}
                  />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
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
