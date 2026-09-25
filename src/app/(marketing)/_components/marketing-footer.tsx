import Link from "next/link";

// P50-02 · Direction A footer: dark green, brand + tagline, four columns.
const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features",  href: "/features"  },
      { label: "Pricing",   href: "/pricing"   },
      { label: "Security",  href: "/security"  },
      { label: "Changelog", href: "/changelog" },
      { label: "For families", href: "/for/families" },
      { label: "For teams", href: "/for/teams" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About",   href: "/about"   },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help centre", href: "/help"       },
      { label: "Guides",      href: "/guides"     },
      { label: "Compare",     href: "/compare"    },
      { label: "Glossary",    href: "/glossary"   },
      { label: "Developers",  href: "/developers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms",   href: "/terms"   },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer__inner">
        <div>
          <Link className="mkt-footer__brand" href="/" aria-label="Kontax home">
            <span className="mkt-footer__brand-k" aria-hidden="true">K</span>
            <span className="mkt-footer__brand-word">Kontax</span>
          </Link>
          <p className="mkt-footer__tag">
            One address book for your phone, your laptop and the people you share with.
            Kept tidy, kept private, kept yours.
          </p>
        </div>

        <nav className="mkt-footer__cols" aria-label="Footer">
          {FOOTER_COLUMNS.map(({ title, links }) => {
            const headingId = `mkt-footer-${title.toLowerCase()}`;
            return (
              <div key={title}>
                <h2 className="mkt-footer__col-title" id={headingId}>{title}</h2>
                <ul className="mkt-footer__list" aria-labelledby={headingId}>
                  {links.map(({ label, href }) => (
                    <li key={href}>
                      <Link className="mkt-footer__link" href={href}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="mkt-footer__base">
        <p>© 2026 Kontax</p>
        <p>Export or delete your data any time, from Settings.</p>
      </div>
    </footer>
  );
}
