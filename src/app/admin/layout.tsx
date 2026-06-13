import { redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
import { AdminMobileNav } from "./_components/admin-mobile-nav";
import { AdminSidebar } from "./_components/admin-sidebar";
import { ToastProvider } from "./_components/toast";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await assertAdmin();
  } catch {
    redirect("/contacts");
  }

  return (
    <ToastProvider>
      <div className="adm">
        <div className="adm-body">
          <AdminSidebar />
          <main className="adm-main">
            <AdminMobileNav />
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
