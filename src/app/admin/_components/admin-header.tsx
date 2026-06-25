import Link from "next/link";

import { AD, AdIcon } from "./admin-icons";
import { Avatar } from "./avatar";

type AdminCrumb = {
  label: string;
  href?: string;
};

export function AdminHeader({
  title,
  crumbs,
  adminName,
}: {
  title: string;
  crumbs?: AdminCrumb[];
  adminName: string;
}) {
  return (
    <header className="ad-header">
      <div className="ad-header-title">
        {crumbs?.length ? (
          <>
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="ad-crumb-wrap">
                {crumb.href ? (
                  <Link className="ad-crumb" href={crumb.href}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="ad-crumb ad-crumb--static">{crumb.label}</span>
                )}
                <AdIcon name="chev" size={15} c={AD.faint} />
              </span>
            ))}
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
