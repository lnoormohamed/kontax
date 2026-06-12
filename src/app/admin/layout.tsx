import { redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
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
          <main className="adm-main">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
