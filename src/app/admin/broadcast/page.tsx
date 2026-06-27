import { redirect } from "next/navigation";

import { loadAdminBroadcastPanel } from "~/app/actions/admin";
import { assertAdmin } from "~/server/admin/guard";
import { AdminHeader } from "../_components/admin-header";
import { AdIcon } from "../_components/admin-icons";
import { BroadcastForm } from "./broadcast-client";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let admin;
  try {
    admin = await assertAdmin();
  } catch {
    redirect("/contacts");
  }

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const panel = await loadAdminBroadcastPanel(q);
  if (!panel) {
    redirect("/contacts");
  }

  return (
    <>
      <AdminHeader
        adminName={admin.name}
        title="Broadcast"
        crumbs={[{ label: "Communications" }]}
      />
      <div className="adm-content">
        <div className="ad-page">
          <form className="ad-filter-search" method="get" style={{ marginBottom: 14, maxWidth: 520 }}>
            <AdIcon name="search" size={15} c="#8b938c" />
            <input
              name="q"
              type="search"
              placeholder="Search broadcast title, body, or id"
              defaultValue={q}
            />
          </form>
          <BroadcastForm broadcasts={panel.broadcasts} flags={panel.flags} />
        </div>
      </div>
    </>
  );
}
