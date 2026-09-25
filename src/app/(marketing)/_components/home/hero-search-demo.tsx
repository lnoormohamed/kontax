"use client";

import { useEffect, useState } from "react";

import { Icon } from "./icons";

// P49-02 · Hero search mockup (design P49-DB01 §1, "Hero search" vignette).
//
// The server-rendered HTML is the resting frame: the query "al" with its full
// result. After hydration the query replays "" → "a" (700 ms) → "al"
// (1250 ms) exactly once, then rests. Under prefers-reduced-motion (or the
// in-app "Animations: off" preference) it never moves. Decorative: the whole
// window is aria-hidden and the hero copy carries the meaning.

type Person = { initials: string; tone: string; name: string; sub: string };

const PEOPLE: Person[] = [
  { initials: "AC", tone: "hp-av-a", name: "Alex Chen", sub: "alex@acme.com" },
  { initials: "AW", tone: "hp-av-b", name: "Alexandra Wong", sub: "+1 415 555 0192" },
  { initials: "AO", tone: "hp-av-d", name: "Amara Okafor", sub: "Orbit Health" },
  { initials: "AP", tone: "hp-av-c", name: "Alina Petrova", sub: "Northwind · Design" },
  { initials: "AS", tone: "hp-av-e", name: "Ana Souza", sub: "ana@souza.pt" },
];

const LABEL = "Allotment club";
const RESTING_QUERY = "al";

function Highlight({ text, length }: { text: string; length: number }) {
  return (
    <>
      <mark>{text.slice(0, length)}</mark>
      {text.slice(length)}
    </>
  );
}

export function HeroSearchDemo() {
  const [query, setQuery] = useState(RESTING_QUERY);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || document.documentElement.dataset.motion === "off") return;
    setQuery("");
    const toA = window.setTimeout(() => setQuery("a"), 700);
    const toAl = window.setTimeout(() => setQuery("al"), 1250);
    return () => {
      window.clearTimeout(toA);
      window.clearTimeout(toAl);
    };
  }, []);

  const matches = PEOPLE.filter((p) => p.name.toLowerCase().startsWith(query)).slice(0, 3);
  const count = query === "a" ? 5 : 3;

  return (
    <div className="hp-hsearch hp-win" aria-hidden="true">
      <div className="hp-win__bar">
        <i />
        <i />
        <i />
        <span>getkontax.com</span>
      </div>
      <div className="hp-win__body">
        <div className="hp-hs-field">
          <Icon name="search" size={16} style={{ color: "var(--mkt-mute)" }} />
          <span>
            <span>{query}</span>
            <span className="hp-hs-caret" />
          </span>
        </div>
        <div className="hp-hs-drop">
          <div className="hp-hs-group">Contacts</div>
          <div>
            {matches.map((p, i) => (
              <div key={p.name} className={`hp-vrow${i === 0 ? " is-active" : ""}`}>
                <span className={`hp-av ${p.tone}`}>{p.initials}</span>
                <div className="hp-vrow__main">
                  <div className="hp-vname">
                    <Highlight text={p.name} length={query.length} />
                  </div>
                  <div className="hp-vsub">{p.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="hp-hs-group">Labels</div>
          <div className="hp-vrow">
            <span className="hp-hs-label">
              <Icon name="tag" size={12} />
              <span>
                <Highlight text={LABEL} length={query.length} />
              </span>
            </span>
            <span className="hp-vsub" style={{ marginLeft: "auto" }}>
              14 contacts
            </span>
          </div>
          <div className="hp-hs-foot">
            <span>{count} contacts · 1 label</span>
            <span>↵ open</span>
          </div>
        </div>
      </div>
    </div>
  );
}
