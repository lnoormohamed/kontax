import { redirect } from "next/navigation";

import { loadAdminBroadcastPanel } from "~/app/actions/admin";
import { assertAdmin } from "~/server/admin/guard";
import { AdminAccessPanel } from "../_components/admin-access-panel";
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
  const panel = admin.capabilities["broadcast.manage"] ? await loadAdminBroadcastPanel(q) : null;
  if (admin.capabilities["broadcast.manage"] && !panel) {
    redirect("/contacts");
  }

  return (
    <>
      <AdminHeader
        adminName={admin.name}
        adminRoleLabel={admin.tierLabel}
        title="Broadcast"
        crumbs={[{ label: "Communications" }]}
      />
      <div className="adm-content">
        <div className="ad-page">
          {!admin.capabilities["broadcast.manage"] ? (
            <AdminAccessPanel
              title="Broadcast control is unavailable"
              body="Broadcast drafting, scheduling, and retraction are limited to governance admins because they can message broad user cohorts."
              requiredTierLabel="Governance"
              currentTierLabel={admin.tierLabel}
              policySource={admin.policySource}
            />
          ) : (
            <>
          <form className="ad-filter-search" method="get" style={{ marginBottom: 14, maxWidth: 520 }}>
            <AdIcon name="search" size={15} c="#8b938c" />
            <input
              name="q"
              type="search"
              placeholder="Search broadcast title, body, or id"
              defaultValue={q}
            />
          </form>
          <BroadcastForm broadcasts={panel!.broadcasts} flags={panel!.flags} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
