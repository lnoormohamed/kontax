import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminHeader } from "../_components/admin-header";
import { assertAdmin } from "~/server/admin/guard";
import { searchAdminEntities } from "~/server/admin/search";

export const dynamic = "force-dynamic";

function ResultGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; sub: string; href: string }>;
}) {
  return (
    <section className="ad-card">
      <div className="ad-card-head">
        <h3 className="ad-card-title">{title}</h3>
      </div>
      <div className="ad-support-list">
        {items.length === 0 ? (
          <div className="ad-support-note">No matches in this section.</div>
        ) : (
          items.map((item) => (
            <Link key={item.id} href={item.href} className="ad-support-list__row">
              <div className="ad-support-list__main">
                <div className="ad-support-list__title">{item.title}</div>
                <div className="ad-support-list__sub">{item.sub}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

export default async function AdminSearchPage({
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
  const results = await searchAdminEntities(q);

  return (
    <>
      <AdminHeader title="Search" adminName={admin.name} crumbs={[{ label: "Governance" }]} />
      <div className="adm-content">
        <div className="ad-page">
          {!results.query ? (
            <div className="ad-support-note">
              Search for a user, sync connection, connection id, group, flag, or audit target from the header.
            </div>
          ) : (
            <>
              <div className="ad-result-meta">Results for “{results.query}”</div>
              <div className="ad-home-two-col">
                <div>
                  <ResultGroup title="Users" items={results.users} />
                  <div style={{ height: 16 }} />
                  <ResultGroup title="Sync connections" items={results.syncConnections} />
                  <div style={{ height: 16 }} />
                  <ResultGroup title="Groups & teams" items={results.groups} />
                </div>
                <div>
                  <ResultGroup title="Feature flags" items={results.featureFlags} />
                  <div style={{ height: 16 }} />
                  <ResultGroup title="Audit pivots" items={results.auditTargets} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
