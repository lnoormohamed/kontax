"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSessionUser } from "~/app/_components/use-session-user";

const NAV_LINKS = [
  { label: "Features",  href: "/features"  },
  { label: "Pricing",   href: "/pricing"   },
  { label: "Security",  href: "/security"  },
  { label: "Changelog", href: "/changelog" },
] as const;

function initials(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function MarketingNav() {
  // P38-10: the marketing pages render statically; the session (for the
  // account chip vs Log in CTA) resolves client-side after hydration.
  const sessionUser = useSessionUser() ?? null;
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Close overlay on navigation
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <>
      <header className={`mkt-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="mkt-nav__inner">
          <Link className="mkt-brand" href="/" aria-label="Kontax home">
            <span className="mkt-brand__k">K</span>
            <span className="mkt-brand__word">Kontax</span>
          </Link>

          <nav className="mkt-nav__links" aria-label="Primary">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                className={`mkt-nav__link${pathname === href ? " is-active" : ""}`}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="mkt-nav__actions">
            {sessionUser ? (
              <>
                <Link className="mkt-btn-pill mkt-btn-pill--green" href="/contacts">
                  Go to app
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h13" /><path d="M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <Link className="mkt-nav__avatar" href="/settings/account" aria-label="Account settings">
                  {initials(sessionUser.name)}
                </Link>
              </>
            ) : (
              <>
                <Link className="mkt-nav__login" href="/login">Log in</Link>
                <Link className="mkt-btn-pill" href="/register">Get started</Link>
              </>
            )}
          </div>

          <button
            className="mkt-nav__burger"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="mkt-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
        >
          <div className="mkt-mobile-menu__top">
            <Link className="mkt-brand" href="/" aria-label="Kontax home" onClick={() => setMobileOpen(false)}>
              <span className="mkt-brand__k">K</span>
              <span className="mkt-brand__word">Kontax</span>
            </Link>
            <button
              className="mkt-mobile-menu__close"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                <path d="M6 6l12 12" /><path d="M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav className="mkt-mobile-menu__body" aria-label="Primary">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                className="mkt-mobile-menu__link"
                href={href}
                aria-current={pathname === href ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="mkt-mobile-menu__foot">
            {sessionUser ? (
              <>
                <Link className="mkt-mobile-menu__userbar" href="/settings/account" onClick={() => setMobileOpen(false)}>
                  <span className="mkt-mobile-menu__userav">{initials(sessionUser.name)}</span>
                  <span>
                    <span className="mkt-mobile-menu__username">{sessionUser.name}</span>
                    <span className="mkt-mobile-menu__usersub">View account</span>
                  </span>
                </Link>
                <Link className="mkt-mobile-menu__cta mkt-mobile-menu__cta--green" href="/contacts" onClick={() => setMobileOpen(false)}>
                  Go to app
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h13" /><path d="M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </>
            ) : (
              <>
                <Link className="mkt-mobile-menu__login" href="/login">Log in</Link>
                <Link className="mkt-mobile-menu__cta" href="/register">Get started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
