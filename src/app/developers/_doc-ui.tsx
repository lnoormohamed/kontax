// P50A-07 · Doc-page UI helpers shared by /developers and
// /developers/export-format (split out of developers/page.tsx so the export
// format reference could move to its own page without duplicating markup).
//
// P50-05 · Direction A: the helpers carry classes styled on the --mkt-*
// tokens in developers.css, and DocPageShell renders the same `.mkt-wrap` +
// MarketingNav/MarketingFooter chrome as the (marketing) route group around
// the two-column docs layout (sticky contents + article). These pages stay
// outside that route group so their URLs, metadata and the root title
// template are unchanged.
import type { ReactNode } from "react";

import { MarketingFooter } from "~/app/(marketing)/_components/marketing-footer";
import { MarketingNav } from "~/app/(marketing)/_components/marketing-nav";
import "~/app/(marketing)/_components/marketing.css";
import "./developers.css";

// Canonical open-source home of the Kontax Contact Export Format (spec,
// schemas, reference validator) — linked from both pages.
export const FORMAT_REPO_URL = "https://github.com/getkontax/contact-format";

export function Code({ children }: { children: string }) {
  return <code className="dev-code">{children}</code>;
}

export function CodeBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  void lang;
  return (
    // tabIndex: the block scrolls sideways on narrow screens, so keyboard
    // users need to be able to focus it (axe scrollable-region-focusable).
    <pre className="dev-pre" tabIndex={0}>
      <code>{children}</code>
    </pre>
  );
}

export function Section({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="dev-section">
      <h2 className="dev-h2">{title}</h2>
      {children}
    </section>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="dev-h3">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="dev-p">{children}</p>;
}

export function Table({ headers, rows }: { headers: string[]; rows: (string | ReactNode)[][] }) {
  return (
    <div className="dev-table-scroll" tabIndex={0} role="region" aria-label={`${headers.join(", ")} table`}>
      <table className="dev-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Verb colours are fixed per method in developers.css (not brand fills).
export function MethodBadge({ method }: { method: string }) {
  return <span className={`dev-method dev-method--${method.toLowerCase()}`}>{method}</span>;
}

// An endpoint's "METHOD /path" line.
export function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <div className="dev-endpoint__line">
      <MethodBadge method={method} />
      <code className="dev-endpoint__path">{path}</code>
    </div>
  );
}

/** Sticky "On this page" contents. Labels indented with two spaces are sub-items. */
export function DocToc({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav className="dev-toc" aria-label="On this page">
      <p className="dev-toc__title">On this page</p>
      {items.map((item) => {
        const sub = item.label.startsWith("  ");
        return (
          <a key={item.href} href={item.href} className={sub ? "dev-toc__link dev-toc__link--sub" : "dev-toc__link"}>
            {item.label.trim()}
          </a>
        );
      })}
    </nav>
  );
}

/** Marketing chrome + two-column docs layout: sticky contents and the article. */
export function DocPageShell({
  tocItems,
  children,
}: {
  tocItems: { href: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="mkt-wrap">
      <MarketingNav />
      <div className="dev-layout">
        <DocToc items={tocItems} />
        <main className="dev-main">{children}</main>
      </div>
      <MarketingFooter />
    </div>
  );
}

/** Page header: mono label, h1, lede and optional extras (e.g. the base URL). */
export function DocHead({ title, lede, children }: { title: ReactNode; lede: ReactNode; children?: ReactNode }) {
  return (
    <header className="dev-head">
      <p className="mkt-lab">Developer documentation</p>
      <h1 className="dev-h1">{title}</h1>
      <p className="dev-lede">{lede}</p>
      {children}
    </header>
  );
}
