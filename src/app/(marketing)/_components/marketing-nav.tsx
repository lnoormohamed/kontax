"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSessionUser } from "~/app/_components/use-session-user";

// P50-02 · Direction A header. Order follows the prototype.
const NAV_LINKS = [
  { label: "Features",  href: "/features"  },
  { label: "Security",  href: "/security"  },
  { label: "Pricing",   href: "/pricing"   },
  { label: "Changelog", href: "/changelog" },
] as const;

const MENU_ID = "mkt-mnav";

function initials(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3 3.8-4.5 7-4.5s5.8 1.5 7 4.5" />
    </svg>
  );
}

export function MarketingNav() {
  // P38-10: the marketing pages render statically; the session (for the
  // account chip vs Log in CTA) resolves client-side after hydration.
  // `undefined` (still resolving) renders the signed-out default.
  const sessionUser = useSessionUser() ?? null;
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close the menu on navigation.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // While open: Escape closes it and returns focus to the toggle; widening
  // past the 980px breakpoint closes it (the desktop links take over).
  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }
    const desktop = window.matchMedia("(min-width: 981px)");
    function onBreakpoint() {
      if (desktop.matches) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [menuOpen]);

  const displayName = sessionUser?.name?.trim() ?? "";
  const userInitials = initials(displayName);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="mkt-nav">
      <div className="mkt-nav__inner">
        <Link className="mkt-brand" href="/" aria-label="Kontax home">
          <span className="mkt-brand__k" aria-hidden="true">K</span>
          <span className="mkt-brand__word">Kontax</span>
        </Link>

        <nav className="mkt-nav__links" aria-label="Primary">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              className="mkt-nav__link"
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
              <Link
                className="mkt-nav__me"
                href="/settings/account"
                aria-label={`${displayName || "Your account"}, account settings`}
              >
                <span className="mkt-nav__me-name">{displayName || "Your account"}</span>
                <span className="mkt-av" aria-hidden="true">
                  {userInitials || <PersonIcon />}
                </span>
              </Link>
              <Link className="mkt-btn mkt-btn--pri mkt-btn--sm" href="/contacts">
                Open Kontax
              </Link>
            </>
          ) : (
            <>
              <Link className="mkt-nav__login" href="/login">Log in</Link>
              <Link className="mkt-btn mkt-btn--pri mkt-btn--sm" href="/register">
                Get started free
              </Link>
            </>
          )}
        </div>

        <button
          ref={menuButtonRef}
          className="mkt-nav__menu"
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls={MENU_ID}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon open={menuOpen} />
        </button>
      </div>

      <div className="mkt-mnav" id={MENU_ID} hidden={!menuOpen}>
        <nav aria-label="Menu">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              className="mkt-mnav__link"
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              onClick={closeMenu}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mkt-mnav__act">
          {sessionUser ? (
            <>
              <Link className="mkt-btn mkt-btn--pri" href="/contacts" onClick={closeMenu}>
                Open Kontax
              </Link>
              <p className="mkt-mnav__who">
                Signed in as{" "}
                <Link href="/settings/account" onClick={closeMenu}>
                  {displayName || "your account"}
                </Link>
              </p>
            </>
          ) : (
            <>
              <Link className="mkt-btn mkt-btn--pri" href="/register" onClick={closeMenu}>
                Get started free
              </Link>
              <Link className="mkt-btn mkt-btn--sec" href="/login" onClick={closeMenu}>
                Log in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
