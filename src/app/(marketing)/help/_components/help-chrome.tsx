import Link from "next/link";

import { PLAN_INFO, PLAN_ORDER, type PlanKey } from "~/app/_components/plan-data";

/** "Help / Sync / Connect iCloud…" — visible breadcrumb matching the BreadcrumbList schema. */
export function HelpBreadcrumbs({ items }: { items: readonly { label: string; href?: string }[] }) {
  return (
    <nav className="hc-crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((it, i) => (
          <li key={i}>
            {it.href ? <Link href={it.href}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Plan availability badges. Names come from plan-data.ts PLAN_INFO (never typed
 * by hand); every plan is listed so availability reads without colour.
 */
export function PlanBadges({ plans }: { plans: readonly PlanKey[] }) {
  const all = PLAN_ORDER.every((p) => plans.includes(p));
  return (
    <div className="hc-plans">
      <span className="hc-plans__label">{all ? "Available on every plan" : "Available on"}</span>
      <ul className="hc-plans__list">
        {PLAN_ORDER.map((p) => {
          const on = plans.includes(p);
          return (
            <li key={p} className={on ? "hc-plan hc-plan--on" : "hc-plan hc-plan--off"}>
              {PLAN_INFO[p].name}
              <span className="mkt-sr-only">{on ? " (included)" : " (not included)"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function formatReviewed(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function StillStuck() {
  return (
    <aside className="hc-stuck" aria-label="Contact support">
      <p className="hc-stuck__title">Still stuck?</p>
      <p className="hc-stuck__body">
        Email <a href="mailto:support@getkontax.com">support@getkontax.com</a> with what you tried
        and what you saw, and we&rsquo;ll help you sort it out.
      </p>
    </aside>
  );
}
