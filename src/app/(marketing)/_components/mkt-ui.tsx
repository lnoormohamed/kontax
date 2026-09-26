import Link from "next/link";

// P50-02 · Direction A building blocks shared by every marketing page.
// Styles live in marketing.css (mkt- prefix). Server components, no JS.

// ── Icons (inline so any page can use them without the homepage sprite) ──
export function ArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export function CheckIcon({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PlusIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// ── Mono index label: "01 — How it works" ──
export function MktLabel({ n, children }: { n?: string; children: React.ReactNode }) {
  return (
    <p className="mkt-lab">
      {n ? <span className="mkt-lab__n">{n}</span> : null}
      <span>{children}</span>
    </p>
  );
}

// ── Section head: label on its own row, then h2 (5 cols) + lede (7 cols).
// `layout="stack"` keeps everything in one column; "center" centres it. ──
export function SectionHead({
  n,
  label,
  title,
  lede,
  layout = "grid",
  id,
}: {
  n?: string;
  label: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  layout?: "grid" | "stack" | "center";
  id?: string;
}) {
  // A grid head with no lede lets the heading run across both columns.
  const cls =
    layout === "grid" ? `mkt-shead${lede ? "" : " mkt-shead--solo"}` : `mkt-shead mkt-shead--${layout}`;
  return (
    <div className={cls}>
      <MktLabel n={n}>{label}</MktLabel>
      <h2 className="mkt-h2" id={id}>
        {title}
      </h2>
      {lede ? <p className="mkt-lede">{lede}</p> : null}
    </div>
  );
}

// ── Page head for inner pages: label, 80px h1, lede ──
export function PageHead({
  label,
  title,
  lede,
  center = false,
  children,
}: {
  label: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  center?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className={`mkt-phead${center ? " mkt-phead--center" : ""}`}>
      <div className="mkt-container">
        <MktLabel>{label}</MktLabel>
        <h1 className="mkt-h1">{title}</h1>
        {lede ? <p className="mkt-lede">{lede}</p> : null}
        {children}
      </div>
    </section>
  );
}

// ── Product window frame. Decorative: the copy next to it carries the
// meaning, so the whole frame is aria-hidden. ──
export function MktWindow({
  bar,
  className,
  children,
}: {
  bar?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mkt-win${className ? ` ${className}` : ""}`} aria-hidden="true">
      {bar ? (
        <div className="mkt-win__bar">
          <i />
          <i />
          <i />
          <span>{bar}</span>
        </div>
      ) : null}
      <div className="mkt-win__body">{children}</div>
    </div>
  );
}

// ── Source tag: mono "iCloud" / "Google" provenance pill ──
export function SourceTag({ children }: { children: React.ReactNode }) {
  return <em className="mkt-srctag">{children}</em>;
}

// ── Tick list ──
export function Ticks({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mkt-ticks">
      {items.map((item, i) => (
        <li key={i}>
          <CheckIcon />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Stone CTA band that closes most pages ──
export function CtaBand({
  title = "Start with the contacts you already have.",
  sub = "Free for up to 500 contacts. No card needed.",
  primary = { label: "Get started free", href: "/register" },
  secondary = { label: "Compare plans", href: "/pricing" },
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string } | null;
}) {
  return (
    <section className="mkt-cta-band">
      <div className="mkt-cta-band__inner">
        <h2 className="mkt-cta-band__title">{title}</h2>
        {sub ? <p className="mkt-cta-band__sub">{sub}</p> : null}
        <div className="mkt-cta-band__btns">
          <Link className="mkt-btn mkt-btn--pri" href={primary.href}>
            {primary.label}
          </Link>
          {secondary ? (
            <Link className="mkt-btn mkt-btn--sec" href={secondary.href}>
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
