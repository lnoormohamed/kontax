"use client";

import { useState } from "react";

import { HELP_FAQ } from "~/app/_components/help-faq-data";

// P26-12 · searchable FAQ for /help (design P26-DB07 §4). Live, case-insensitive
// filter over question + answer; sections with no matches are hidden; a clear
// (×) button resets. Each item is a native <details> disclosure. Section ids are
// the deep-link anchors (#carddav / #import / #security / #sharing / #billing).
export function HelpFaq() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const sections = HELP_FAQ.map((sec) => ({
    ...sec,
    items: query
      ? sec.items.filter((it) => (it.q + " " + it.a).toLowerCase().includes(query))
      : sec.items,
  })).filter((sec) => sec.items.length > 0);

  return (
    <div>
      <div className="help-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b938c" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 4a7 7 0 105.3 11.7M20 20l-3.7-3.3" />
        </svg>
        <input
          aria-label="Search help"
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help…"
          type="search"
          value={q}
        />
        {q ? (
          <button aria-label="Clear search" className="help-search__clear" onClick={() => setQ("")} type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
      </div>

      {sections.length === 0 ? (
        <div className="help-noresult">
          <p className="help-noresult__title">No results for “{q}”</p>
          <p className="help-noresult__sub">Try a different term, or browse the sections by clearing the search.</p>
        </div>
      ) : (
        <div className="help-sections">
          {sections.map((sec) => (
            <section key={sec.id} id={sec.id} className="help-section">
              <h2 className="help-sectitle">{sec.title}</h2>
              <div className="help-list">
                {sec.items.map((it) => (
                  // Force-open while searching so matches are visible.
                  <details key={it.q} className="help-faq-item" open={!!query}>
                    <summary className="help-faq-q">
                      <span className="help-faq-chev" aria-hidden>▸</span>
                      <span>{it.q}</span>
                    </summary>
                    <div className="help-faq-a">{it.a}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
