"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

// P24B-22 — Mobile search overlay (design brief P24B-DB18).
// Full-screen overlay (covers the bottom nav) with inline results: recents
// (recent search terms), live results with match highlight, no-match, and an
// offline note. Tapping a result opens the contact.

type SearchResult = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
};

const RECENTS_KEY = "kontax-recent-searches";
const AVATAR_TINTS: [string, string][] = [
  ["#e6ece4", "#3f6b53"], ["#e9e7f4", "#5a55a6"], ["#f3e7df", "#9a623a"], ["#e2edf2", "#3d6f8a"],
  ["#f2e6ea", "#9a4a63"], ["#e8efe0", "#5f7a3a"], ["#efe9df", "#85703f"], ["#e3eef0", "#3f7d7a"],
];

function tintFor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]!;
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

// Highlight the query substring (case-insensitive) within text.
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q || !text) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: "#fff0bf", color: "inherit", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

function Avatar({ name, size }: { name: string; size: number }) {
  const [bg, fg] = tintFor(name);
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: bg, color: fg, display: "grid", placeItems: "center", fontSize: size * 0.36, fontWeight: 600, flexShrink: 0 }}>
      {initials(name)}
    </span>
  );
}

function ResultRow({ c, q, onOpen }: { c: SearchResult; q: string; onOpen: () => void }) {
  const secondary = c.company ? (c.email ? `${c.company} · ${c.email}` : c.company) : (c.email ?? c.phone ?? "");
  return (
    <button type="button" onClick={onOpen} className="mob-tap" style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", height: 60, padding: "0 14px", border: "none", borderBottom: "1px solid #e9ece7", background: "transparent", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
      <Avatar name={c.name} size={40} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "#1d2823", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Highlight text={c.name} q={q} />
        </span>
        <span style={{ display: "block", fontSize: 12, color: "#8b938c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Highlight text={secondary} q={q} />
        </span>
      </span>
    </button>
  );
}

export function MobileSearchButton() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [recents, setRecents] = useState<string[]>([]);
  const [offline, setOffline] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const latestQueryRef = useRef("");
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      setRecents(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRecents([]);
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runSearch = (q: string) => {
    const query = q.trim();
    latestQueryRef.current = query;
    searchAbortRef.current?.abort();
    if (query.length === 0) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setStatus("loading");
    fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((data: { results: SearchResult[] }) => {
        if (latestQueryRef.current !== query || controller.signal.aborted) return;
        setResults(data.results ?? []);
        setStatus("done");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        if (latestQueryRef.current !== query) return;
        setResults([]);
        setStatus("done");
      });
  };

  const handleChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(next), 220);
  };

  useEffect(() => {
    if (open) return;
    if (timer.current) clearTimeout(timer.current);
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    latestQueryRef.current = "";
  }, [open]);

  const close = () => {
    setOpen(false);
    setValue("");
    setResults([]);
    setStatus("idle");
  };

  const rememberQuery = (q: string) => {
    const query = q.trim();
    if (!query) return;
    const next = [query, ...recents.filter((r) => r.toLowerCase() !== query.toLowerCase())].slice(0, 6);
    setRecents(next);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const openContact = (id: string) => {
    rememberQuery(value);
    close();
    router.push(`/contacts/${id}`);
  };

  const clearRecents = () => {
    setRecents([]);
    try { localStorage.removeItem(RECENTS_KEY); } catch { /* ignore */ }
  };

  const trimmed = value.trim();

  return (
    <>
      <button
        aria-label="Search contacts"
        onClick={() => setOpen(true)}
        style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "#5c655e", WebkitTapHighlightColor: "transparent" }}
        type="button"
      >
        <WorkspaceIcon name="search" size={22} />
      </button>

      {open && mounted
        ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search contacts"
          className="md:hidden"
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "#fff", display: "flex", flexDirection: "column" }}
        >
          {/* Header */}
          <header style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", gap: 9, padding: "0 10px 0 12px", background: "#fff", borderBottom: "1px solid #d8ddd6" }}>
            <div style={{ flex: 1, height: 36, display: "flex", alignItems: "center", gap: 8, padding: "0 11px", background: "#f2f4f0", borderRadius: 12, border: "1px solid #e9ece7" }}>
              <WorkspaceIcon name="search" size={17} className="text-[#8b938c]" />
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Search contacts…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                type="search"
                style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", fontSize: 16, color: "#1d2823" }}
              />
              {value ? (
                <button aria-label="Clear" type="button" onClick={() => handleChange("")} style={{ border: "none", background: "transparent", padding: 0, display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <WorkspaceIcon name="close" size={15} className="text-[#8b938c]" strokeWidth={2} />
                </button>
              ) : null}
            </div>
            <button type="button" onClick={close} style={{ flexShrink: 0, border: "none", background: "transparent", color: "#4158f4", fontSize: 14.5, fontWeight: 600, padding: "0 6px", cursor: "pointer" }}>
              Cancel
            </button>
          </header>

          {offline ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#f6edd9", borderBottom: "1px solid #ecdcb6", flexShrink: 0 }}>
              <WorkspaceIcon name="warning" size={15} className="text-[#bf8526]" />
              <span style={{ fontSize: 11.5, fontWeight: 500, color: "#6f5417" }}>Offline — searching your cached contacts.</span>
            </div>
          ) : null}

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {trimmed.length === 0 ? (
              // Recents
              recents.length > 0 ? (
                <>
                  <div style={{ padding: "14px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#8b938c" }}>Recent</span>
                    <button type="button" onClick={clearRecents} style={{ border: "none", background: "transparent", color: "#4158f4", fontSize: 12, fontWeight: 600, padding: 0, cursor: "pointer" }}>Clear</button>
                  </div>
                  {recents.map((t) => (
                    <button key={t} type="button" onClick={() => handleChange(t)} className="mob-tap" style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                      <WorkspaceIcon name="clock" size={17} className="text-[#8b938c]" />
                      <span style={{ flex: 1, fontSize: 14, color: "#5c655e" }}>{t}</span>
                    </button>
                  ))}
                </>
              ) : (
                <p style={{ margin: "40px 30px 0", fontSize: 13.5, color: "#8b938c", textAlign: "center", lineHeight: 1.5 }}>
                  Search your contacts by name, company, email or phone.
                </p>
              )
            ) : status === "done" && results.length === 0 ? (
              // No match
              <div style={{ display: "grid", placeItems: "center", padding: "64px 30px", textAlign: "center" }}>
                <span style={{ width: 56, height: 56, borderRadius: 16, background: "#f2f4f0", display: "grid", placeItems: "center", marginBottom: 14 }}>
                  <WorkspaceIcon name="search" size={26} className="text-[#aeb4ac]" strokeWidth={1.7} />
                </span>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1d2823" }}>No contacts match “{trimmed}”</p>
                <p style={{ margin: "7px 0 0", fontSize: 12.5, color: "#8b938c", lineHeight: 1.5, maxWidth: 220 }}>Check the spelling or search by company or email.</p>
              </div>
            ) : (
              // Results
              <>
                {results.length > 0 ? (
                  <div style={{ padding: "12px 14px 4px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8b938c" }}>
                      {results.length} result{results.length === 1 ? "" : "s"}
                    </span>
                  </div>
                ) : null}
                {results.map((c) => (
                  <ResultRow key={c.id} c={c} q={trimmed} onOpen={() => openContact(c.id)} />
                ))}
              </>
            )}
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
