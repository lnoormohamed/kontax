import { redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
import { listFlags } from "~/server/admin/feature-flags";
import { AdminHeader } from "../_components/admin-header";
import { FlagsTable } from "./flags-client";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage() {
  let admin;
  try {
    admin = await assertAdmin();
  } catch {
    redirect("/contacts");
  }

  const flags = await listFlags();

  return (
    <>
      <AdminHeader title="Feature flags" adminName={admin.name} />
      <div className="adm-content">
        <div className="ad-page">
          <FlagsTable flags={flags} />
        </div>
      </div>
    </>
  );
}
