"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

import { ConfirmDialog } from "~/app/_components/confirm-dialog";
import {
  createSavedFilter,
  deleteSavedFilter,
  duplicateSavedFilter,
  renameSavedFilter,
} from "~/app/actions/saved-filters";
import {
  archiveAddressBook,
  createAddressBook,
  renameAddressBook,
} from "~/app/actions/address-books";
import {
  fromJson,
  fromParams,
  isEmpty,
  matches,
  summarise,
  toQueryString,
  type ContactFilterState,
} from "~/lib/contact-filter-state";

export type SmartList = { id: string; name: string; filterState: unknown };
export type PersonalBook = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  count: number;
};

// ── small SVG glyphs (List / BookOpen / dots), matching the design brief ──────
const ListIcon = ({ active }: { active?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#17352e" : "#5c655e"} strokeWidth="1.9" strokeLinecap="round">
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);
const BookIcon = ({ active }: { active?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#17352e" : "#5c655e"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 6.5C10.4 5.1 7.9 4.6 4 5.2V18c3.9-.6 6.4-.1 8 1.3M12 6.5c1.6-1.4 4.1-1.9 8-1.3V18c-3.9-.6-6.4-.1-8 1.3M12 6.5V19.3" />
  </svg>
);
const DotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#5c655e">
    <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
  </svg>
);

// ── modal shell (portal + scrim) ──────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(29,40,35,0.5)" }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ position: "relative", width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, boxShadow: "0 24px 60px rgba(20,30,25,0.28)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 22px 0" }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "#1d2823" }}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: "#5c655e", cursor: "pointer", fontSize: 18 }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1.5px solid #4158f4",
  boxShadow: "0 0 0 3px rgba(65,88,244,0.12)",
  padding: "0 14px",
  fontSize: 14.5,
  fontWeight: 500,
  color: "#1d2823",
  outline: "none",
};

function Btn({ variant = "ghost", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ghost" | "blue" | "red" }) {
  const bg = variant === "blue" ? "#4158f4" : variant === "red" ? "#b5472f" : "#fff";
  const color = variant === "ghost" ? "#1d2823" : "#fff";
  return (
    <button
      type="button"
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 44,
        padding: "0 18px",
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        border: variant === "ghost" ? "1px solid #d8ddd6" : "1px solid transparent",
        background: bg,
        color,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.55 : 1,
        ...props.style,
      }}
    />
  );
}

// ── filter summary chips ──────────────────────────────────────────────────────
function FilterChips({ state, bookName }: { state: ContactFilterState; bookName: (id: string) => string | undefined }) {
  const chips = summarise(state, bookName);
  if (chips.length === 0) {
    return <div style={{ fontSize: 13, color: "#8b938c" }}>No filters applied yet — apply one, then save it.</div>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {chips.map((c) => (
        <span key={c.k + c.v} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 999, background: "rgba(65,88,244,0.12)", color: "#2f3fb0", fontSize: 12, fontWeight: 600 }}>
          <b style={{ fontWeight: 500, color: "#5a66c4" }}>{c.k}:</b> {c.v}
        </span>
      ))}
    </div>
  );
}

// ── section header (label + "+ New" action) ──────────────────────────────────
function SectionHeader({ label, action, onAction }: { label: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-center px-2.5 py-1">
      <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">{label}</span>
      <button
        type="button"
        onClick={onAction}
        className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold text-[#4158f4] transition hover:bg-[rgba(65,88,244,0.1)]"
      >
        {action}
      </button>
    </div>
  );
}

// ── one row (list or book) with inline rename + hover ⋯ menu ──────────────────
function Row({
  icon,
  name,
  count,
  active,
  href,
  renaming,
  onRenameSubmit,
  onRenameCancel,
  menu,
}: {
  icon: React.ReactNode;
  name: string;
  count?: number | null;
  active: boolean;
  href: string;
  renaming: boolean;
  onRenameSubmit: (value: string) => void;
  onRenameCancel: () => void;
  menu?: { label: string; onClick: () => void; destructive?: boolean }[];
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [menuOpen]);

  return (
    <div
      ref={ref}
      className="group relative flex h-9 items-center gap-2.5 rounded-lg pl-2.5 pr-1.5 text-[13px] transition"
      style={{
        background: active ? "#e3efe7" : undefined,
        borderLeft: `3px solid ${active ? "#17352e" : "transparent"}`,
        color: active ? "#17352e" : "#5c655e",
        fontWeight: active ? 600 : 500,
      }}
    >
      {icon}
      {renaming ? (
        <input
          autoFocus
          defaultValue={name}
          onBlur={(e) => onRenameSubmit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameSubmit((e.target as HTMLInputElement).value);
            if (e.key === "Escape") onRenameCancel();
          }}
          className="h-[26px] min-w-0 flex-1 rounded-[7px] border-[1.5px] border-[#4158f4] px-2 text-[13px] font-semibold text-[#1d2823] outline-none"
          style={{ boxShadow: "0 0 0 3px rgba(65,88,244,0.12)" }}
        />
      ) : (
        <button
          type="button"
          onClick={() => router.push(href)}
          className="min-w-0 flex-1 truncate text-left"
        >
          {name}
        </button>
      )}
      {!renaming && menu && menu.length > 0 ? (
        <>
          <button
            type="button"
            aria-label="List options"
            onClick={() => setMenuOpen((v) => !v)}
            className="hidden h-6 w-6 place-items-center rounded-md hover:bg-[rgba(20,30,25,0.06)] group-hover:grid"
            style={{ display: menuOpen ? "grid" : undefined }}
          >
            <DotsIcon />
          </button>
          {count != null ? (
            <span className={`text-[11.5px] tabular-nums text-[#8b938c] ${menuOpen ? "hidden" : "group-hover:hidden"}`}>{count}</span>
          ) : null}
          {menuOpen ? (
            <div className="absolute right-1 top-8 z-30 min-w-[172px] rounded-[11px] border border-[rgba(20,30,25,0.06)] bg-white p-1.5 shadow-[0_14px_40px_rgba(20,30,25,0.22)]">
              {menu.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    m.onClick();
                  }}
                  className="flex h-9 w-full items-center rounded-[7px] px-2.5 text-left text-[13px] font-medium transition"
                  style={{ color: m.destructive ? "#b5472f" : "#1d2823" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = m.destructive ? "rgba(181,71,47,0.08)" : "#f2f4f0")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : !renaming && count != null ? (
        <span className="text-[11.5px] tabular-nums text-[#8b938c]">{count}</span>
      ) : null}
    </div>
  );
}

// ── main island ───────────────────────────────────────────────────────────────
export function SmartListsBooks({ lists, books }: { lists: SmartList[]; books: PersonalBook[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showSaveList, setShowSaveList] = useState(false);
  const [showNewBook, setShowNewBook] = useState(false);
  const [manageBook, setManageBook] = useState<PersonalBook | null>(null);
  const [deleteList, setDeleteList] = useState<SmartList | null>(null);
  const [archiveBook, setArchiveBook] = useState<PersonalBook | null>(null);
  const [busy, setBusy] = useState(false);

  const bookName = (id: string) => books.find((b) => b.id === id)?.name;
  const currentState = fromParams(searchParams);
  const activeBookId = searchParams.get("book");

  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    void (async () => {
      try {
        await fn();
        after?.();
        startTransition(() => router.refresh());
      } catch (err) {
        // Surface the server message without crashing the sidebar.
        alert(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <>
      {/* My Lists */}
      <div className="mt-3">
        <SectionHeader label="My Lists" action="+ New list" onAction={() => setShowSaveList(true)} />
        {lists.length === 0 ? (
          <p className="px-2.5 pb-2 text-[12px] leading-snug text-[#8b938c]">Save any filter as a list to recall it in one click.</p>
        ) : (
          lists.map((list) => {
            const state = fromJson(list.filterState);
            return (
              <Row
                key={list.id}
                icon={<ListIcon active={matches(state, searchParams)} />}
                name={list.name}
                active={matches(state, searchParams)}
                href={`/contacts?${toQueryString(state)}`}
                renaming={renamingId === list.id}
                onRenameCancel={() => setRenamingId(null)}
                onRenameSubmit={(value) => {
                  setRenamingId(null);
                  if (value.trim() && value.trim() !== list.name) {
                    run(() => renameSavedFilter({ id: list.id, name: value }));
                  }
                }}
                menu={[
                  { label: "Rename", onClick: () => setRenamingId(list.id) },
                  { label: "Duplicate", onClick: () => run(() => duplicateSavedFilter(list.id)) },
                  { label: "Delete", onClick: () => setDeleteList(list), destructive: true },
                ]}
                count={null}
              />
            );
          })
        )}
      </div>

      {/* Books (personal) */}
      <div className="mt-3">
        <SectionHeader label="Books" action="+ New book" onAction={() => setShowNewBook(true)} />
        {books.map((book) => (
          <Row
            key={book.id}
            icon={<BookIcon active={activeBookId === book.id} />}
            name={book.name}
            count={book.count}
            active={activeBookId === book.id}
            href={`/contacts?tab=people&filter=all&book=${book.id}`}
            renaming={renamingId === book.id}
            onRenameCancel={() => setRenamingId(null)}
            onRenameSubmit={(value) => {
              setRenamingId(null);
              if (value.trim() && value.trim() !== book.name) {
                run(() => renameAddressBook({ id: book.id, name: value }));
              }
            }}
            menu={
              book.isDefault
                ? []
                : [
                    { label: "Rename", onClick: () => setRenamingId(book.id) },
                    { label: "Manage", onClick: () => setManageBook(book) },
                    { label: "Archive", onClick: () => setArchiveBook(book), destructive: true },
                  ]
            }
          />
        ))}
      </div>

      {/* Save-as-list modal */}
      {showSaveList ? (
        <SaveListModal
          state={currentState}
          bookName={bookName}
          busy={busy}
          onClose={() => setShowSaveList(false)}
          onSave={(name) => run(() => createSavedFilter({ name, filterState: currentState }), () => setShowSaveList(false))}
        />
      ) : null}

      {/* New book modal */}
      {showNewBook ? (
        <NameModal
          title="New address book"
          placeholder="e.g. Work, Personal, Clients"
          cta="Create book"
          busy={busy}
          onClose={() => setShowNewBook(false)}
          onSubmit={(name) => run(() => createAddressBook({ name }), () => setShowNewBook(false))}
        />
      ) : null}

      {/* Book manage modal */}
      {manageBook ? (
        <BookManageModal
          book={manageBook}
          busy={busy}
          onClose={() => setManageBook(null)}
          onRename={(name) => run(() => renameAddressBook({ id: manageBook.id, name }))}
          onArchive={() => {
            setArchiveBook(manageBook);
            setManageBook(null);
          }}
        />
      ) : null}

      {/* Delete-list confirm */}
      <ConfirmDialog
        open={deleteList != null}
        busy={busy}
        destructive
        title={deleteList ? `Delete “${deleteList.name}”?` : ""}
        body="This removes the saved filter. Your contacts aren’t affected — only the list shortcut is deleted."
        confirmLabel="Delete list"
        onClose={() => setDeleteList(null)}
        onConfirm={() => {
          const target = deleteList;
          if (target) run(() => deleteSavedFilter(target.id), () => setDeleteList(null));
        }}
      />

      {/* Archive-book confirm */}
      <ConfirmDialog
        open={archiveBook != null}
        busy={busy}
        destructive
        title={archiveBook ? `Archive “${archiveBook.name}”?` : ""}
        body={archiveBook ? `This book and its ${archiveBook.count} contact${archiveBook.count === 1 ? "" : "s"} will be archived. You can restore them from the Archived view.` : ""}
        confirmLabel="Archive book"
        onClose={() => setArchiveBook(null)}
        onConfirm={() => {
          const target = archiveBook;
          if (target) run(() => archiveAddressBook(target.id), () => setArchiveBook(null));
        }}
      />
    </>
  );
}

// ── modals ────────────────────────────────────────────────────────────────────
function SaveListModal({
  state,
  bookName,
  busy,
  onClose,
  onSave,
}: {
  state: ContactFilterState;
  bookName: (id: string) => string | undefined;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const empty = isEmpty(state);
  return (
    <Modal title="Save this filter as a list" onClose={onClose}>
      <div style={{ padding: "18px 22px 0" }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#1d2823", margin: "0 0 7px" }}>Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. VCs in NYC"
          style={inputStyle}
        />
        <div style={{ marginTop: 18, fontSize: 13, color: "#5c655e" }}>Saves the current filter:</div>
        <div style={{ marginTop: 9 }}>
          <FilterChips state={state} bookName={bookName} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "22px" }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="blue" disabled={busy || empty || !name.trim()} onClick={() => onSave(name.trim())}>
          Save list
        </Btn>
      </div>
    </Modal>
  );
}

function NameModal({
  title,
  placeholder,
  cta,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  placeholder: string;
  cta: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ padding: "18px 22px 0" }}>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} style={inputStyle} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "22px" }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="blue" disabled={busy || !name.trim()} onClick={() => onSubmit(name.trim())}>
          {cta}
        </Btn>
      </div>
    </Modal>
  );
}

function BookManageModal({
  book,
  busy,
  onClose,
  onRename,
  onArchive,
}: {
  book: PersonalBook;
  busy: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onArchive: () => void;
}) {
  const [name, setName] = useState(book.name);
  const [copied, setCopied] = useState(false);
  const slugPath = `/dav/books/${book.slug}`;
  return (
    <Modal title="Manage book" onClose={onClose}>
      <div style={{ padding: "18px 24px 0" }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#1d2823", margin: "0 0 7px" }}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <div style={{ marginTop: 5, fontSize: 13, color: "#5c655e" }}>{book.count} contact{book.count === 1 ? "" : "s"}</div>

        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#1d2823", margin: "18px 0 7px" }}>CardDAV slug</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 6px 0 13px", borderRadius: 10, background: "#f6f7f4", border: "1px solid #e9ece7" }}>
          <code style={{ flex: 1, fontFamily: "ui-monospace, monospace", fontSize: 12.5, color: "#5c655e" }}>{slugPath}</code>
          <Btn
            style={{ height: 30, padding: "0 11px", fontSize: 13 }}
            onClick={() => {
              void navigator.clipboard?.writeText(slugPath);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Btn>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, fontSize: 11.5, color: "#8b938c" }}>
          Fixed at creation — renaming the book won’t change the slug, so device subscriptions keep working.
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 24px" }}>
        <Btn variant="red" style={{ marginRight: "auto", borderColor: "transparent" }} disabled={busy} onClick={onArchive}>
          Archive book
        </Btn>
        <Btn onClick={onClose}>Close</Btn>
        <Btn variant="blue" disabled={busy || !name.trim() || name.trim() === book.name} onClick={() => onRename(name.trim())}>
          Save changes
        </Btn>
      </div>
    </Modal>
  );
}
