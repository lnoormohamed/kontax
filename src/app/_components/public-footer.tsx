import Link from "next/link";

/** Shared footer for the public site (landing, pricing, privacy, terms). */
export function PublicFooter() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brandcol">
          <Link className="brand" href="/" aria-label="Kontax home">
            <span className="brand__k">K</span>
            <span className="brand__word">Kontax</span>
          </Link>
          <p className="footer__tag">One address book, always up to date — across every device, app, and person you share with.</p>
        </div>
        <div className="footer__cols">
          <div className="footer__col">
            <span className="footer__col-title">Product</span>
            <Link className="footer__link" href="/#features">Features</Link>
            <Link className="footer__link" href="/#how">How it works</Link>
            <Link className="footer__link" href="/pricing">Pricing</Link>
            <Link className="footer__link" href="/#privacy">Privacy &amp; ownership</Link>
          </div>
          <div className="footer__col">
            <span className="footer__col-title">Company</span>
            <Link className="footer__link" href="/privacy">Privacy policy</Link>
            <Link className="footer__link" href="/terms">Terms of service</Link>
          </div>
          <div className="footer__col">
            <span className="footer__col-title">Get started</span>
            <Link className="footer__link" href="/login">Log in</Link>
            <Link className="footer__link" href="/register">Register</Link>
          </div>
        </div>
      </div>
      <div className="footer__base">
        <span className="footer__copy">© 2026 Kontax</span>
        <div className="footer__base-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/pricing">Pricing</Link>
        </div>
      </div>
    </footer>
  );
}
