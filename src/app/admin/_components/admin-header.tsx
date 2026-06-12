import Link from "next/link";

import { AD, AdIcon } from "./admin-icons";
import { Avatar } from "./avatar";

// Fixed 52px header (DB04 §1). `crumb` renders the "Users › {title}" breadcrumb
// used by the user-detail page; otherwise a plain page title.
export function AdminHeader({
  title,
  crumb,
  adminName,
}: {
  title: string;
  crumb?: { label: string; href: string };
  adminName: string;
}) {
  return (
    <header className="ad-header">
      <div className="ad-header-title">
        {crumb ? (
          <>
            <Link className="ad-crumb" href={crumb.href}>
              {crumb.label}
            </Link>
            <AdIcon name="chev" size={15} c={AD.faint} />
            <span className="ad-crumb-cur">{title}</span>
          </>
        ) : (
          <h1>{title}</h1>
        )}
      </div>
      <div className="ad-header-right">
        <span className="ad-header-role">Platform admin</span>
        <span className="ad-header-name">{adminName}</span>
        <Avatar name={adminName} size={32} />
      </div>
    </header>
  );
}
