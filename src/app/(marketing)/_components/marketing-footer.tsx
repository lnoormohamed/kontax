import Link from "next/link";

// P50-02 · Direction A footer: dark green, brand + tagline, four link
// columns, and a base line pointing at self-serve export/deletion.

const FOOTER_LINKS: { group: string; links: { label: string; href: string }[] }[] = [
  {
    group: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/security" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    group: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    group: "Resources",
    links: [
      { label: "Help centre", href: "/help" },
      { label: "Developers", href: "/developers" },
    ],
  },
  {
    group: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Cookie policy", href: "/privacy#cookies" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer__in">
        <div>
          <Link className="mkt-brand" href="/" aria-label="Kontax home">
            <span className="mkt-brand__k" aria-hidden="true">
              K
            </span>
            <span className="mkt-brand__word">Kontax</span>
          </Link>
          <p className="mkt-footer__tag">
            One address book for your phone, your laptop and the people you share with. Kept
            tidy, kept private, kept yours.
          </p>
        </div>
        <div className="mkt-footer__cols">
          {FOOTER_LINKS.map(({ group, links }) => (
            <nav key={group} className="mkt-footer__col" aria-label={group}>
              <span className="mkt-footer__h">{group}</span>
              {links.map(({ label, href }) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
      </div>
      <div className="mkt-footer__base">
        <span>© 2026 Kontax</span>
        <span>Export or delete your data any time, from Settings.</span>
      </div>
    </footer>
  );
}
