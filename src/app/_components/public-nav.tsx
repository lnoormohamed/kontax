import Link from "next/link";

/**
 * Shared sticky nav for the public site (landing, pricing, privacy, terms).
 * Section links point at the landing-page anchors so they work from any
 * sub-page. Pass `active` to mark the current page.
 */
export function PublicNav({ active }: { active?: "pricing" }) {
  return (
    <header className="nav">
      <div className="nav__inner">
        <Link className="brand" href="/" aria-label="Kontax home">
          <span className="brand__k">K</span>
          <span className="brand__word">Kontax</span>
        </Link>
        <nav className="nav__links" aria-label="Primary">
          <Link className="nav__link" href="/#how">How it works</Link>
          <Link className="nav__link" href="/#features">Features</Link>
          <Link className="nav__link" href="/#privacy">Privacy</Link>
          <Link className="nav__link" href="/pricing" aria-current={active === "pricing" ? "page" : undefined}>Pricing</Link>
        </nav>
        <div className="nav__actions">
          <Link className="nav__link" href="/login">Log in</Link>
          <Link className="btn-primary--sm" href="/register">Get started free</Link>
        </div>
      </div>
    </header>
  );
}
