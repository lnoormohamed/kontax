// P50A-07 · Small inline-styled doc-page UI helpers shared by /developers and
// /developers/export-format (split out of developers/page.tsx so the export
// format reference could move to its own page without duplicating this
// markup). Not part of the (marketing) route group's Direction A component
// set (mkt-ui.tsx) — these two pages keep the existing docs layout
// (PublicNav/PublicFooter, sticky TOC sidebar), per P50-05.
import type { ReactNode } from "react";

// Canonical open-source home of the Kontax Contact Export Format (spec,
// schemas, reference validator) — linked from both /developers and
// /developers/export-format.
export const FORMAT_REPO_URL = "https://github.com/getkontax/contact-format";

export function Code({ children }: { children: string }) {
  return (
    <code
      style={{
        background: "#f4f4f5",
        borderRadius: 5,
        padding: "1px 6px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "0.9em",
        color: "#1d2823",
      }}
    >
      {children}
    </code>
  );
}

export function CodeBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  void lang;
  return (
    <pre
      style={{
        background: "#1d2823",
        color: "#d4f0e0",
        borderRadius: 10,
        padding: "16px 20px",
        overflowX: "auto",
        fontSize: 13,
        lineHeight: 1.65,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        margin: "12px 0 20px",
        whiteSpace: "pre",
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: 56 }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#1d2823",
          letterSpacing: "-0.01em",
          marginBottom: 16,
          paddingTop: 8,
          borderTop: "1px solid #e4e4e7",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 16,
        fontWeight: 700,
        color: "#1d2823",
        marginBottom: 8,
        marginTop: 28,
      }}
    >
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "#5c655e", marginBottom: 12 }}>
      {children}
    </p>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: (string | ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 20 }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13.5,
          color: "#3a4540",
        }}
      >
        <thead>
          <tr style={{ background: "#f4f4f5" }}>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#8b938c",
                  borderBottom: "1px solid #e4e4e7",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f0f3ef" }}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{ padding: "9px 12px", verticalAlign: "top", lineHeight: 1.5 }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "#1d6fa4",
    POST: "#1a7a40",
    PUT: "#7a5c1a",
    DELETE: "#9a3a23",
  };
  return (
    <span
      style={{
        display: "inline-block",
        background: colors[method] ?? "#5c655e",
        color: "#fff",
        borderRadius: 5,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        marginRight: 10,
      }}
    >
      {method}
    </span>
  );
}

/** Shared sticky "On this page" TOC sidebar markup for the docs layout. */
export function DocToc({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav
      style={{
        position: "sticky",
        top: 80,
        fontSize: 13,
        lineHeight: 1.7,
      }}
      className="dev-toc"
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "#8b938c",
          marginBottom: 10,
        }}
      >
        On this page
      </p>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          style={{
            display: "block",
            color: item.label.startsWith("  ") ? "#8b938c" : "#5c655e",
            padding: "2px 0",
            paddingLeft: item.label.startsWith("  ") ? 12 : 0,
            fontSize: item.label.startsWith("  ") ? 12.5 : 13,
            fontFamily: item.label.startsWith("  ")
              ? "ui-monospace, SFMono-Regular, Menlo, monospace"
              : "inherit",
            textDecoration: "none",
            transition: "color 0.1s",
          }}
        >
          {item.label.trim()}
        </a>
      ))}
    </nav>
  );
}

/** Shared two-column docs page shell: sticky TOC + main content, responsive below 700px. */
export function DocPageShell({
  tocItems,
  children,
}: {
  tocItems: { href: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "48px 24px 80px",
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        gap: 48,
        alignItems: "start",
      }}
    >
      <DocToc items={tocItems} />
      <main style={{ minWidth: 0 }}>{children}</main>
      <style>{`
        @media (max-width: 700px) {
          .dev-toc { display: none; }
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
