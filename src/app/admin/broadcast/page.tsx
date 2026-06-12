import { redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
import { AdminHeader } from "../_components/admin-header";
import { BroadcastForm } from "./broadcast-client";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  let admin;
  try {
    admin = await assertAdmin();
  } catch {
    redirect("/contacts");
  }

  return (
    <>
      <AdminHeader adminName={admin.name} title="Broadcast" />
      <div className="adm-content">
        <div className="ad-page">
          <BroadcastForm />
        </div>
      </div>
    </>
  );
}
