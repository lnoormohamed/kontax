import Link from "next/link";

const FOOTER_LINKS = {
  Product: [
    { label: "Features",  href: "/features"  },
    { label: "Pricing",   href: "/pricing"   },
    { label: "Security",  href: "/security"  },
    { label: "Changelog", href: "/changelog" },
  ],
  Company: [
    { label: "About",       href: "/about"      },
    { label: "Contact",     href: "/contact"    },
    { label: "Developers",  href: "/developers" },
    { label: "Help centre", href: "/help"       },
  ],
  Legal: [
    { label: "Privacy policy",   href: "/privacy"          },
    { label: "Terms of service", href: "/terms"            },
    { label: "Cookie policy",    href: "/privacy#cookies"  },
  ],
} as const;

export function MarketingFooter() {
  return (
    <footer className="mkt-footer" role="contentinfo">
      <div className="mkt-footer__inner">
        <div className="mkt-footer__brandcol">
          <Link className="mkt-footer__brand" href="/" aria-label="Kontax home">
            <span className="mkt-footer__brand-k">K</span>
            <span className="mkt-footer__brand-word">Kontax</span>
          </Link>
          <p className="mkt-footer__tag">Your address book, yours to keep.</p>
          <p className="mkt-footer__note">No ads. No tracking. Built on the open CardDAV standard.</p>
        </div>

        <div className="mkt-footer__cols">
          {(Object.entries(FOOTER_LINKS) as [string, readonly { label: string; href: string }[]][]).map(([group, links]) => (
            <nav key={group} className="mkt-footer__col" aria-label={group}>
              <span className="mkt-footer__col-title">{group}</span>
              {links.map(({ label, href }) => (
                <Link key={href} className="mkt-footer__link" href={href}>
                  {label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
      </div>

      <div className="mkt-footer__base">
        <div className="mkt-footer__base-inner">
          <span className="mkt-footer__copy">© 2026 Kontax.</span>
        </div>
      </div>
    </footer>
  );
}
