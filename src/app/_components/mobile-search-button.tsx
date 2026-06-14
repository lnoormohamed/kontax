"use client";

// P33-04: Mobile global search overlay.
// Upgraded to use shared P33-02 components: grouped results, 64px rows,
// matchField snippets, recently-viewed, and keyboard legend.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { SearchResult } from "~/app/api/contacts/search/route";
import {
  addRecentSearch,
  groupResults,
  SearchKeyLegend,
  SearchNoMatch,
  SearchRecentBlock,
  SearchResultsList,
  SearchSkeleton,
} from "~/app/_components/search-results";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

type LabelEntry = { name: string; color: string };

const DEBOUNCE_MS = 220;

export function MobileSearchButton({ labelRegistry = [] }: { labelRegistry?: LabelEntry[] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [offline, setOffline] = useState(false);
  const [mounted, setMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestRef = useRef("");

  const router = useRouter();

  const sections = groupResults(results);

  useEffect(() => setMounted(true), []);

  // On open: focus input, read online status, lock body scroll.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") doClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Cancel in-flight requests when overlay closes.
  useEffect(() => {
    if (open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    abortRef.current = null;
    latestRef.current = "";
  }, [open]);

  const runSearch = (q: string) => {
    const query = q.trim();
    latestRef.current = query;
    abortRef.current?.abort();
    if (!query) { setResults([]); setStatus("idle"); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((data: { results: SearchResult[] }) => {
        if (latestRef.current !== query || ctrl.signal.aborted) return;
        setResults(data.results ?? []);
        setStatus("done");
      })
      .catch((err: unknown) => {
        if (
          ctrl.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        ) return;
        if (latestRef.current !== query) return;
        setResults([]);
        setStatus("done");
      });
  };

  const handleChange = (next: string) => {
    setValue(next);
    setExpanded({});
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(next), DEBOUNCE_MS);
  };

  const doClose = () => {
    setOpen(false);
    setValue("");
    setResults([]);
    setStatus("idle");
    setExpanded({});
  };

  const openContact = (result: SearchResult) => {
    addRecentSearch(value);
    doClose();
    router.push(`/contacts/${result.id}`);
  };

  const pickSearch = (term: string) => {
    setValue(term);
    setExpanded({});
    if (timerRef.current) clearTimeout(timerRef.current);
    runSearch(term);
  };

  const trimmed = value.trim();
  const total = results.length;

  const body = (() => {
    if (!trimmed) {
      return <SearchRecentBlock mob onPickSearch={pickSearch} />;
    }
    if (status === "loading") {
      return <SearchSkeleton rows={4} mob />;
    }
    if (status === "done" && sections.length === 0) {
      return <SearchNoMatch q={trimmed} mob />;
    }
    return (
      <SearchResultsList
        sections={sections}
        q={trimmed}
        expanded={expanded}
        onOpen={openContact}
        onHover={() => undefined}
        onExpand={(field) => setExpanded((e) => ({ ...e, [field]: true }))}
        mob
        labelRegistry={labelRegistry}
      />
    );
  })();

  return (
    <>
      <button
        aria-label="Search contacts"
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: 44, height: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "none", border: "none", cursor: "pointer",
          color: "#5c655e", WebkitTapHighlightColor: "transparent",
        }}
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
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "#fff", display: "flex", flexDirection: "column",
            }}
          >
            {/* ── header bar ─────────────────────────────────────────────── */}
            <header
              style={{
                height: 52, flexShrink: 0,
                display: "flex", alignItems: "center", gap: 9,
                padding: "0 10px 0 12px",
                background: "#fff", borderBottom: "1px solid #d8ddd6",
              }}
            >
              <div
                style={{
                  flex: 1, height: 36,
                  display: "flex", alignItems: "center", gap: 8, padding: "0 11px",
                  background: "#f2f4f0", borderRadius: 12, border: "1px solid #e9ece7",
                }}
              >
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
                  style={{
                    flex: 1, minWidth: 0, border: "none",
                    background: "transparent", outline: "none",
                    fontSize: 16, color: "#1d2823",
                  }}
                />
                {value ? (
                  <button
                    aria-label="Clear"
                    type="button"
                    onClick={() => handleChange("")}
                    style={{
                      border: "none", background: "transparent",
                      padding: 0, display: "grid", placeItems: "center", cursor: "pointer",
                    }}
                  >
                    <WorkspaceIcon name="close" size={15} className="text-[#8b938c]" strokeWidth={2} />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={doClose}
                style={{
                  flexShrink: 0, border: "none", background: "transparent",
                  color: "#4158f4", fontSize: 14.5, fontWeight: 600,
                  padding: "0 6px", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </header>

            {/* ── offline banner ─────────────────────────────────────────── */}
            {offline ? (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 14px",
                  background: "#f6edd9", borderBottom: "1px solid #ecdcb6",
                  flexShrink: 0,
                }}
              >
                <WorkspaceIcon name="warning" size={15} className="text-[#bf8526]" />
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "#6f5417" }}>
                  Offline — searching your cached contacts.
                </span>
              </div>
            ) : null}

            {/* ── result count ───────────────────────────────────────────── */}
            {trimmed && status === "done" && total > 0 ? (
              <div style={{ padding: "11px 14px 4px", flexShrink: 0 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8b938c" }}>
                  {total} result{total === 1 ? "" : "s"}
                </span>
              </div>
            ) : null}

            {/* ── scrollable body ────────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
              {body}
            </div>

            {/* ── key legend ─────────────────────────────────────────────── */}
            <SearchKeyLegend />
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
