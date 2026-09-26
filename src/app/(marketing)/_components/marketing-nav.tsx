"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSessionUser } from "~/app/_components/use-session-user";

// P50-02 · Direction A header. Signed out: Log in + Get started free.
// Signed in: name + avatar + Open Kontax. Below 980px the links and actions
// move into a disclosure panel under the bar (not a modal): the menu button
// carries aria-expanded/aria-controls, Escape closes it and returns focus.

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Security", href: "/security" },
  { label: "Pricing", href: "/pricing" },
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

function Brand() {
  return (
    <Link className="mkt-brand" href="/" aria-label="Kontax home">
      <span className="mkt-brand__k" aria-hidden="true">
        K
      </span>
      <span className="mkt-brand__word">Kontax</span>
    </Link>
  );
}

export function MarketingNav() {
  // P38-10: the marketing pages render statically; the session (for the
  // account chip vs Log in CTA) resolves client-side after hydration.
  const sessionUser = useSessionUser() ?? null;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  // Close the panel on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    }
    // The panel only exists below 980px; if the window grows past it, close.
    const wide = window.matchMedia("(min-width: 981px)");
    function onWide() {
      if (wide.matches) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const links = (className: string) =>
    NAV_LINKS.map(({ label, href }) => (
      <Link
        key={href}
        className={className}
        href={href}
        aria-current={pathname === href ? "page" : undefined}
      >
        {label}
      </Link>
    ));

  return (
    <header className="mkt-nav">
      <div className="mkt-nav__in">
        <Brand />

        <nav className="mkt-nav__links" aria-label="Primary">
          {links("mkt-nav__link")}
        </nav>

        <div className="mkt-nav__act">
          {sessionUser ? (
            <>
              <Link className="mkt-me" href="/settings/account">
                <span>{sessionUser.name}</span>
                <span className="mkt-avatar" aria-hidden="true">
                  {initials(sessionUser.name)}
                </span>
              </Link>
              {/* P46: returning users land on the contact list */}
              <Link className="mkt-btn mkt-btn--pri mkt-btn--sm" href="/contacts">
                Open Kontax
              </Link>
            </>
          ) : (
            <>
              <Link className="mkt-nav__login" href="/login">
                Log in
              </Link>
              <Link className="mkt-btn mkt-btn--pri mkt-btn--sm" href="/register">
                Get started free
              </Link>
            </>
          )}
        </div>

        <button
          ref={menuButton}
          className="mkt-nav__menu"
          type="button"
          aria-expanded={open}
          aria-controls="mkt-mnav"
          aria-label={open ? "Close menu" : "Menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      <div className="mkt-mnav" id="mkt-mnav" hidden={!open}>
        <nav aria-label="Mobile">{links("mkt-mnav__link")}</nav>
        <div className="mkt-mnav__act">
          {sessionUser ? (
            <>
              <Link className="mkt-btn mkt-btn--pri" href="/contacts">
                Open Kontax
              </Link>
              <Link className="mkt-btn mkt-btn--sec" href="/settings/account">
                Account settings
              </Link>
              {sessionUser.name ? <p className="mkt-mnav__who">Signed in as {sessionUser.name}</p> : null}
            </>
          ) : (
            <>
              <Link className="mkt-btn mkt-btn--pri" href="/register">
                Get started free
              </Link>
              <Link className="mkt-btn mkt-btn--sec" href="/login">
                Log in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
