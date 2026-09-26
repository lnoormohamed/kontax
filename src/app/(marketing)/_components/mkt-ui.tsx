import Link from "next/link";
import type { ReactNode } from "react";

// P50-02 · Direction A building blocks shared by every marketing page.
// Styles live in marketing.css (mkt- prefix). Server components, no JS: the
// FAQ is native <details>, everything else is static markup.
//
// Merged from the two parallel P50 builds (feat/p50-merged): the markup and
// class names are the staging build's; the props the help centre, guides,
// comparisons and use-case pages were written against (`index`, `stack`,
// `titleId`, `headingLevel`, CtaBand children, Faq, Band, PlanCard, …) are
// accepted as well, so both sets of pages render through one component set.

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

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

/** Table cell marks for comparison tables: a labelled tick and a labelled dash. */
export function YesMark() {
  return <CheckIcon size={18} label="Yes" />;
}

export function NoMark() {
  return (
    <span className="mkt-cmp__no">
      <span aria-hidden="true">—</span>
      <span className="mkt-sr-only">No</span>
    </span>
  );
}

// ── Mono index label: "01 — How it works" ──
export function MktLabel({ n, children }: { n?: string; children: ReactNode }) {
  return (
    <p className="mkt-lab">
      {n ? <span className="mkt-lab__n">{n}</span> : null}
      <span>{children}</span>
    </p>
  );
}

/** Alias of MktLabel with the `index` prop name. */
export function IndexLabel({ index, children }: { index?: string; children: ReactNode }) {
  return <MktLabel n={index}>{children}</MktLabel>;
}

// ── Full-width section with the standard vertical rhythm. `stone` = the warm alternate band. ──
export function Band({
  id,
  stone = false,
  label,
  className,
  children,
}: {
  id?: string;
  stone?: boolean;
  /** Accessible name for the section landmark, when it has no heading. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-label={label} className={cx("mkt-band", stone && "mkt-band--stone", className)}>
      <div className="mkt-container">{children}</div>
    </section>
  );
}

// ── Section head: label on its own row, then h2 (5 cols) + lede (7 cols).
// `layout="stack"` (or `stack`) keeps everything in one column; "center"
// centres it. `headingLevel={1}` makes the title the page's h1 (use-case and
// feature-detail pages open with a section head rather than a PageHead). ──
export function SectionHead({
  n,
  index,
  label,
  title,
  lede,
  layout,
  stack = false,
  id,
  titleId,
  headingLevel = 2,
}: {
  n?: string;
  index?: string;
  label: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  layout?: "grid" | "stack" | "center";
  stack?: boolean;
  id?: string;
  titleId?: string;
  headingLevel?: 1 | 2;
}) {
  const mode = layout ?? (stack ? "stack" : "grid");
  // A grid head with no lede lets the heading run across both columns.
  const cls = mode === "grid" ? `mkt-shead${lede ? "" : " mkt-shead--solo"}` : `mkt-shead mkt-shead--${mode}`;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className={cls}>
      <MktLabel n={n ?? index}>{label}</MktLabel>
      <Heading className="mkt-h2" id={id ?? titleId}>
        {title}
      </Heading>
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
  title: ReactNode;
  lede?: ReactNode;
  center?: boolean;
  children?: ReactNode;
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
  children: ReactNode;
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

/** Alias of MktWindow with the `title` prop name. */
export function WindowFrame({ title, className, children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <MktWindow bar={title} className={className}>
      {children}
    </MktWindow>
  );
}

// ── Source tag: mono "iCloud" / "Google" provenance pill ──
export function SourceTag({ children }: { children: ReactNode }) {
  return <em className="mkt-srctag">{children}</em>;
}

/** The prototype's "three into one" wiring: three sources converge on one point. */
const THREE_INTO_ONE = ["M0,52 C54,52 42,150 96,150", "M0,150 L96,150", "M0,248 C54,248 42,150 96,150"];

/** Hairline wire connector that stretches to fill its box (stroke stays 1.25px). */
export function Wire({
  paths = THREE_INTO_ONE,
  viewBox = "0 0 96 300",
  className,
}: {
  paths?: readonly string[];
  viewBox?: string;
  className?: string;
}) {
  return (
    <div className={cx("mkt-wire-box", className)} aria-hidden="true">
      <svg className="mkt-wire" viewBox={viewBox} preserveAspectRatio="none" focusable="false">
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </div>
  );
}

// ── Tick list ──
export function Ticks({ items }: { items: readonly ReactNode[] }) {
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

// ── Plan card (the .mkt-plan markup the pricing page uses) ──
export function PlanCard({
  name,
  audience,
  price,
  features,
  highlight = false,
  badge,
  action,
}: {
  name: string;
  audience: ReactNode;
  /** Price row content; wrap the figure in <span className="mkt-plan__amount">. */
  price: ReactNode;
  features: readonly ReactNode[];
  highlight?: boolean;
  badge?: ReactNode;
  /** Usually a full-width .mkt-btn link. */
  action?: ReactNode;
}) {
  return (
    <div className={cx("mkt-plan", highlight && "mkt-plan--hl")}>
      <div className="mkt-plan__top">
        <h3 className="mkt-plan__n">{name}</h3>
        {badge ? <span className="mkt-tag">{badge}</span> : null}
      </div>
      <p className="mkt-plan__for">{audience}</p>
      <div className="mkt-plan__pr">{price}</div>
      <ul>
        {features.map((f, i) => (
          <li key={i}>
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {action}
    </div>
  );
}

// ── FAQ: native <details> accordion; the first item starts open unless `openFirst` is false ──
export type FaqItem = { q: ReactNode; a: ReactNode };

export function Faq({ items, openFirst = true }: { items: readonly FaqItem[]; openFirst?: boolean }) {
  return (
    <div className="mkt-faq">
      {items.map((item, i) => (
        <details key={i} open={openFirst && i === 0}>
          <summary>
            <span>{item.q}</span>
            <PlusIcon />
          </summary>
          <div className="mkt-faq__a">{item.a}</div>
        </details>
      ))}
    </div>
  );
}

// ── Stone CTA band that closes most pages. Pass `.mkt-btn` links as
// children, or use the default primary/secondary pair. ──
export function CtaBand({
  title = "Start with the contacts you already have.",
  sub = "Free for up to 500 contacts. No card needed.",
  primary = { label: "Get started free", href: "/register" },
  secondary = { label: "Compare plans", href: "/pricing" },
  children,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string } | null;
  children?: ReactNode;
}) {
  return (
    <section className="mkt-cta-band">
      <div className="mkt-cta-band__inner">
        <h2 className="mkt-cta-band__title">{title}</h2>
        {sub ? <p className="mkt-cta-band__sub">{sub}</p> : null}
        <div className="mkt-cta-band__btns">
          {children ?? (
            <>
              <Link className="mkt-btn mkt-btn--pri" href={primary.href}>
                {primary.label}
              </Link>
              {secondary ? (
                <Link className="mkt-btn mkt-btn--sec" href={secondary.href}>
                  {secondary.label}
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
