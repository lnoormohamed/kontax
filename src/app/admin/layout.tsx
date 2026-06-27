import { redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
import type { AdminNavGroup } from "./_components/admin-nav";
import { AdminMobileNav } from "./_components/admin-mobile-nav";
import { AdminSidebar } from "./_components/admin-sidebar";
import { ToastProvider } from "./_components/toast";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let admin;
  try {
    admin = await assertAdmin();
  } catch {
    redirect("/contacts");
  }

  const navGroups: AdminNavGroup[] = [
    {
      id: "overview",
      label: "Overview",
      items: [{ id: "overview", label: "Overview", icon: "home", href: "/admin" }],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        { id: "users", label: "Users", icon: "users", href: "/admin/users" },
        { id: "support", label: "Support", icon: "card", href: "/admin/support" },
        ...(admin.capabilities["sync.view"]
          ? [{ id: "sync", label: "Sync ops", icon: "sync", href: "/admin/sync" }]
          : []),
      ],
    },
    {
      id: "governance",
      label: "Governance",
      items: [
        ...(admin.capabilities["audit.view"]
          ? [{ id: "audit", label: "Audit log", icon: "audit", href: "/admin/audit" }]
          : []),
        ...(admin.capabilities["flags.manage"]
          ? [{ id: "flags", label: "Feature flags", icon: "flag", href: "/admin/feature-flags" }]
          : []),
      ],
    },
    {
      id: "communications",
      label: "Communications",
      items: admin.capabilities["broadcast.manage"]
        ? [{ id: "broadcast", label: "Broadcast", icon: "share", href: "/admin/broadcast" }]
        : [],
    },
  ].filter((group) => group.items.length > 0);

  return (
    <ToastProvider>
      <div className="adm">
        <div className="adm-body">
          <AdminSidebar groups={navGroups} />
          <main className="adm-main">
            <AdminMobileNav groups={navGroups} />
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
