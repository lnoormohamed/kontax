"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

export function MobileSearchButton() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setValue(searchParams.get("q") ?? "");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, searchParams]);

  const navigate = (q: string) => {
    const params = new URLSearchParams();
    params.set("tab", searchParams.get("tab") ?? "people");
    params.set("filter", searchParams.get("filter") ?? "active");
    params.set("sort", searchParams.get("sort") ?? "name");
    params.set("view", searchParams.get("view") ?? "cozy");
    if (q.trim()) params.set("q", q);
    router.replace(`/contacts?${params.toString()}`, { scroll: false });
  };

  const handleChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(next), 200);
  };

  const cancel = () => {
    setOpen(false);
    setValue("");
    navigate("");
  };

  const showResults = () => {
    if (!value.trim()) { cancel(); return; }
    navigate(value);
    setOpen(false);
  };

  return (
    <>
      <button
        aria-label="Search contacts"
        onClick={() => setOpen(true)}
        style={{
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#5c655e",
          WebkitTapHighlightColor: "transparent",
        }}
        type="button"
      >
        <WorkspaceIcon name="search" size={22} />
      </button>

      {open && (
        <>
          {/* Dim backdrop — tap to show results */}
          <div
            onClick={showResults}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(15,23,42,0.18)",
              zIndex: 90,
            }}
          />

          {/* Search panel slides down from top */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              backgroundColor: "#fff",
              zIndex: 100,
              borderBottom: "1px solid #d8ddd6",
              paddingBottom: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px 0",
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#f2f4f0",
                  borderRadius: 12,
                  padding: "0 12px",
                  height: 44,
                }}
              >
                <WorkspaceIcon name="search" size={18} />
                <input
                  ref={inputRef}
                  autoComplete="off"
                  autoCorrect="off"
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") showResults();
                    if (e.key === "Escape") cancel();
                  }}
                  placeholder="Search contacts…"
                  spellCheck={false}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "none",
                    outline: "none",
                    fontSize: 16,
                    color: "#1d2823",
                    minWidth: 0,
                  }}
                  type="search"
                  value={value}
                />
                {value ? (
                  <button
                    aria-label="Clear search"
                    onClick={() => handleChange("")}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      color: "#8b938c",
                      flexShrink: 0,
                      display: "flex",
                    }}
                    type="button"
                  >
                    <WorkspaceIcon name="x" size={16} />
                  </button>
                ) : null}
              </div>
              <button
                onClick={cancel}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#17352e",
                  padding: "0 4px",
                  height: 44,
                  flexShrink: 0,
                  WebkitTapHighlightColor: "transparent",
                  whiteSpace: "nowrap",
                }}
                type="button"
              >
                Cancel
              </button>
            </div>

            {value ? (
              <button
                onClick={showResults}
                style={{
                  display: "block",
                  width: "calc(100% - 24px)",
                  margin: "10px 12px 0",
                  height: 44,
                  borderRadius: 12,
                  background: "#17352e",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  WebkitTapHighlightColor: "transparent",
                }}
                type="button"
              >
                Show results
              </button>
            ) : (
              <p
                style={{
                  margin: "12px 12px 0",
                  fontSize: 13,
                  color: "#8b938c",
                  textAlign: "center",
                }}
              >
                Search by name, company, or email
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
