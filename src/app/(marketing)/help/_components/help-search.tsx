"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import type { HelpSearchEntry } from "../_content";

const MAX_RESULTS = 8;

/**
 * P50A-05 · Client-side search over article titles and summaries. The index is
 * built at build time and passed in as props, so the page stays static.
 * Every query word must match (in any order).
 */
export function HelpSearch({ index }: { index: readonly HelpSearchEntry[] }) {
  const [q, setQ] = useState("");
  const inputId = useId();
  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    const words = query.split(/\s+/).filter(Boolean);
    return words.length === 0 ? [] : index.filter((e) => words.every((w) => e.text.includes(w)));
  }, [index, query]);

  return (
    <div className="hc-search" role="search">
      <label htmlFor={inputId} className="mkt-sr-only">
        Search help articles
      </label>
      <div className="hc-search__box">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          placeholder="Search help — e.g. “iCloud”, “duplicates”, “export”"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <p className="mkt-sr-only" aria-live="polite">
        {!query ? "" : `${results.length} ${results.length === 1 ? "article" : "articles"} found`}
      </p>
      {query ? (
        results.length > 0 ? (
          <ul className="hc-search__results">
            {results.slice(0, MAX_RESULTS).map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="hc-search__hit">
                  <span className="hc-search__cat">{r.category}</span>
                  <span className="hc-search__title">{r.title}</span>
                  <span className="hc-search__sum">{r.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hc-search__none">
            No articles match &ldquo;{q.trim()}&rdquo;. Try a shorter word, browse the categories below,
            or email <a href="mailto:support@getkontax.com">support@getkontax.com</a>.
          </p>
        )
      ) : null}
    </div>
  );
}
