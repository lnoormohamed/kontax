import { redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
import { listFlags } from "~/server/admin/feature-flags";
import { AdIcon } from "../_components/admin-icons";
import { AdminHeader } from "../_components/admin-header";
import { FlagsTable } from "./flags-client";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage({
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
  const flags = await listFlags(q);

  return (
    <>
      <AdminHeader
        title="Feature flags"
        adminName={admin.name}
        crumbs={[{ label: "Governance" }]}
      />
      <div className="adm-content">
        <div className="ad-page">
          <form className="ad-filter-search" method="get" style={{ marginBottom: 14, maxWidth: 520 }}>
            <AdIcon name="search" size={15} c="#8b938c" />
            <input
              name="q"
              type="search"
              placeholder="Search flag key, name, owner, or purpose"
              defaultValue={q}
            />
          </form>
          <FlagsTable flags={flags} />
        </div>
      </div>
    </>
  );
}
