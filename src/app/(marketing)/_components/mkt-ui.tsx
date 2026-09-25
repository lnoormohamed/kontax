/**
 * P50-02 · Direction A shared marketing components.
 *
 * Thin, server-safe wrappers over the `.mkt-*` classes in marketing.css so
 * page tickets (P50-03..05) compose them instead of re-deriving markup from
 * the prototype (roadmap/design-briefs/p50-db01-handoff). No client JS: the
 * FAQ is native <details>, everything else is static markup.
 */
import type { ReactNode } from "react";

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ─── Icons ─────────────────────────────────────────────────────── */

export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Table cell marks for comparison tables: a labelled tick and a labelled dash. */
export function YesMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" role="img" aria-label="Yes">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NoMark() {
  return (
    <span className="mkt-cmp__no">
      <span aria-hidden="true">—</span>
      <span className="mkt-sr-only">No</span>
    </span>
  );
}

/* ─── Layout ────────────────────────────────────────────────────── */

/** Full-width section with the standard vertical rhythm. `stone` = the warm alternate band. */
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

/** Mono index label: `01 — How it works`. */
export function IndexLabel({ index, children }: { index?: string; children: ReactNode }) {
  return (
    <p className="mkt-lab">
      {index ? <span className="mkt-lab__n">{index}</span> : null}
      <span>{children}</span>
    </p>
  );
}

/**
 * Section head on the asymmetric 5/7 grid: index label across the top,
 * headline left, lede right. `stack` keeps it in one column (e.g. when the
 * head sits in a narrow column of its own).
 */
export function SectionHead({
  index,
  label,
  title,
  lede,
  stack = false,
  titleId,
  headingLevel = 2,
}: {
  index?: string;
  label: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  stack?: boolean;
  titleId?: string;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className={cx("mkt-shead", stack && "mkt-shead--stack")}>
      <IndexLabel index={index}>{label}</IndexLabel>
      <Heading className="mkt-shead__title" id={titleId}>{title}</Heading>
      {lede ? <p className="mkt-shead__lede">{lede}</p> : null}
    </div>
  );
}

/* ─── Product visuals ───────────────────────────────────────────── */

/**
 * Product window frame around a live HTML mockup. Decorative by default
 * (hidden from assistive tech); describe the mockup at the page level.
 */
export function WindowFrame({
  title,
  className,
  decorative = true,
  children,
}: {
  title?: string;
  className?: string;
  decorative?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cx("mkt-win", className)} aria-hidden={decorative || undefined}>
      {title !== undefined ? (
        <div className="mkt-win__bar">
          <i className="mkt-win__dot" />
          <i className="mkt-win__dot" />
          <i className="mkt-win__dot" />
          <span className="mkt-win__title">{title}</span>
        </div>
      ) : null}
      <div className="mkt-win__body">{children}</div>
    </div>
  );
}

/** Mono provenance tag: where a value came from ("iCloud", "Google"). */
export function SourceTag({ children }: { children: ReactNode }) {
  return <span className="mkt-src-tag">{children}</span>;
}

/** The prototype's "three into one" wiring: three sources converge on one point. */
const THREE_INTO_ONE = [
  "M0,52 C54,52 42,150 96,150",
  "M0,150 L96,150",
  "M0,248 C54,248 42,150 96,150",
];

/**
 * Hairline wire connector. Stretches to fill its box (preserveAspectRatio
 * none); the stroke stays 1.25px at any size via non-scaling-stroke.
 */
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
    <div className={cx("mkt-wire", className)} aria-hidden="true">
      <svg viewBox={viewBox} preserveAspectRatio="none" focusable="false">
        {paths.map((d) => (
          <path key={d} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}

/* ─── Lists, cards, plans ───────────────────────────────────────── */

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
        <h3 className="mkt-plan__name">{name}</h3>
        {badge ? <span className="mkt-tag">{badge}</span> : null}
      </div>
      <p className="mkt-plan__for">{audience}</p>
      <div className="mkt-plan__price">{price}</div>
      <ul className="mkt-plan__list">
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

/* ─── FAQ ───────────────────────────────────────────────────────── */

export type FaqItem = { q: ReactNode; a: ReactNode };

/** Native <details> accordion; the first item starts open unless `openFirst` is false. */
export function Faq({ items, openFirst = true }: { items: readonly FaqItem[]; openFirst?: boolean }) {
  return (
    <div className="mkt-faq">
      {items.map((item, i) => (
        <details key={i} className="mkt-faq__item" open={openFirst && i === 0}>
          <summary className="mkt-faq__q">
            <span>{item.q}</span>
            <PlusIcon />
          </summary>
          <div className="mkt-faq__a">{item.a}</div>
        </details>
      ))}
    </div>
  );
}

/* ─── Closing CTA ───────────────────────────────────────────────── */

/** Stone closing band; pass .mkt-btn links as children. */
export function CtaBand({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="mkt-cta-band">
      <div className="mkt-cta-band__inner">
        <h2 className="mkt-cta-band__title">{title}</h2>
        {sub ? <p className="mkt-cta-band__sub">{sub}</p> : null}
        <div className="mkt-cta-band__btns">{children}</div>
      </div>
    </section>
  );
}
