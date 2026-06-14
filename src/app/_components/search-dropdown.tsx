"use client";

// P33-03: desktop header global search dropdown.
// Debounced as-you-type → grouped results → keyboard nav (↑/↓/↵/Esc).
// "/" from anywhere focuses the input. Stale responses are dropped.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { MatchField, SearchResult } from "~/app/api/contacts/search/route";
import {
  addRecentSearch,
  groupResults,
  SearchKeyLegend,
  SearchNoMatch,
  SearchRecentBlock,
  SearchResultsList,
  SearchSkeleton,
  seVisibleRows,
  type GroupedSection,
} from "~/app/_components/search-results";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

type LabelEntry = { name: string; color: string };

const DEBOUNCE_MS = 180;
const MAX_BODY_PX = 400;

// ── Panel ─────────────────────────────────────────────────────────────────────
// Renders the correct body given status + query, always with a key-legend footer.

interface PanelProps {
  q: string;
  status: "idle" | "loading" | "done";
  sections: GroupedSection[];
  total: number;
  activeId: string | null;
  expanded: Record<string, boolean>;
  labelRegistry: LabelEntry[];
  onOpen: (r: SearchResult) => void;
  onHover: (id: string) => void;
  onExpand: (field: MatchField) => void;
  onPickSearch: (term: string) => void;
}

function SearchPanel({
  q, status, sections, total, activeId, expanded,
  labelRegistry, onOpen, onHover, onExpand, onPickSearch,
}: PanelProps) {
  let body: React.ReactNode;

  if (!q) {
    body = <SearchRecentBlock onPickSearch={onPickSearch} />;
  } else if (status === "loading") {
    body = <SearchSkeleton rows={4} />;
  } else if (status === "done" && sections.length === 0) {
    body = <SearchNoMatch q={q} />;
  } else {
    body = (
      <SearchResultsList
        sections={sections}
        q={q}
        activeId={activeId}
        expanded={expanded}
        onOpen={onOpen}
        onHover={onHover}
        onExpand={onExpand}
        labelRegistry={labelRegistry}
      />
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #d8ddd6",
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(20,30,25,.18), 0 0 0 1px rgba(20,30,25,.03)",
      }}
    >
      {q && status === "done" && total > 0 && (
        <div style={{ padding: "11px 14px 4px" }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8b938c" }}>
            {total} result{total === 1 ? "" : "s"}
          </span>
        </div>
      )}
      <div style={{ maxHeight: MAX_BODY_PX, overflowY: "auto" }}>{body}</div>
      <SearchKeyLegend />
    </div>
  );
}

// ── SearchDropdown ────────────────────────────────────────────────────────────

export function SearchDropdown({ labelRegistry = [] }: { labelRegistry?: LabelEntry[] }) {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestRef = useRef("");

  const sections = groupResults(results);
  const visRows = seVisibleRows(sections, expanded);
  const activeId = activeIdx >= 0 && visRows[activeIdx] ? visRows[activeIdx]!.id : null;
  const total = results.length;

  // ── search ──────────────────────────────────────────────────────────────────
  const runSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    latestRef.current = trimmed;
    abortRef.current?.abort();
    if (!trimmed) { setResults([]); setStatus("idle"); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    fetch(`/api/contacts/search?q=${encodeURIComponent(trimmed)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((data: { results: SearchResult[] }) => {
        if (latestRef.current !== trimmed || ctrl.signal.aborted) return;
        setResults(data.results ?? []);
        setStatus("done");
        setActiveIdx(-1);
      })
      .catch((err: unknown) => {
        if (
          ctrl.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        ) return;
        if (latestRef.current !== trimmed) return;
        setResults([]);
        setStatus("done");
      });
  }, []);

  // ── handlers ────────────────────────────────────────────────────────────────
  const handleChange = (value: string) => {
    setQ(value);
    setActiveIdx(-1);
    setExpanded({});
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
  };

  const clearAndClose = () => {
    setQ("");
    setResults([]);
    setStatus("idle");
    setActiveIdx(-1);
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
  };

  const openContact = useCallback(
    (result: SearchResult) => {
      addRecentSearch(q);
      setOpen(false);
      clearAndClose();
      router.push(`/contacts/${result.id}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, router],
  );

  const pickSearch = (term: string) => {
    setQ(term);
    setActiveIdx(-1);
    setExpanded({});
    if (timerRef.current) clearTimeout(timerRef.current);
    runSearch(term);
  };

  // ── click outside to close ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // ── "/" focuses search from anywhere ────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          (el as HTMLElement).isContentEditable)
      ) return;
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // ── keyboard nav ─────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, visRows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = activeIdx >= 0 ? visRows[activeIdx] : visRows[0];
      if (row) openContact(row);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (q) {
        clearAndClose();
      } else {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  const focused = q ? "#4158f4" : "#d8ddd6";
  const shadow = q ? "0 0 0 3px #edf0fe" : "none";

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", flex: 1, display: "flex", justifyContent: "center" }}
    >
      {/* ── search field ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 9,
          width: "100%", maxWidth: 540, height: 40, padding: "0 10px 0 12px",
          borderRadius: 10, background: "#fff",
          border: `1.5px solid ${open ? focused : "#d8ddd6"}`,
          boxShadow: open ? shadow : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <WorkspaceIcon
          name="search"
          size={18}
          className={q ? "text-[#5c655e]" : "text-[#8b938c]"}
        />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder="Search by name, email, phone, company…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          style={{
            flex: 1, minWidth: 0, border: "none", outline: "none",
            background: "transparent", fontSize: 14,
            color: "#1d2823", fontFamily: "inherit",
          }}
        />
        {q ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { clearAndClose(); inputRef.current?.focus(); }}
            style={{
              display: "grid", placeItems: "center",
              width: 24, height: 24, borderRadius: "50%",
              border: "none", background: "#f2f4f0",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <WorkspaceIcon name="close" size={13} strokeWidth={2} className="text-[#5c655e]" />
          </button>
        ) : (
          <span
            aria-label="Press / to search"
            style={{
              display: "inline-grid", placeItems: "center",
              minWidth: 20, height: 20, padding: "0 4px",
              borderRadius: 5, border: "1px solid #d8ddd6",
              fontFamily: "ui-monospace, monospace",
              fontSize: 11, color: "#8b938c", lineHeight: 1, flexShrink: 0,
            }}
          >
            /
          </span>
        )}
      </div>

      {/* ── dropdown panel ────────────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0, right: 0,
            zIndex: 50,
          }}
        >
          <SearchPanel
            q={q}
            status={status}
            sections={sections}
            total={total}
            activeId={activeId}
            expanded={expanded}
            labelRegistry={labelRegistry}
            onOpen={openContact}
            onHover={(id) => setActiveIdx(visRows.findIndex((r) => r.id === id))}
            onExpand={(field) => setExpanded((e) => ({ ...e, [field]: true }))}
            onPickSearch={pickSearch}
          />
        </div>
      )}
    </div>
  );
}
