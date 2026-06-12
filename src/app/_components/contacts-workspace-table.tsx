"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  archiveContact,
  archiveContactsBulk,
  deleteContactsBulk,
  favoriteContactsBulk,
  permanentlyDeleteContact,
  restoreContact,
  restoreContactsBulk,
  toggleFavoriteContact,
} from "~/app/actions/contacts";
import { ContactBadgeCluster } from "~/app/_components/contact-badge-cluster";
import { SwipeableRow } from "~/app/_components/contact-list/swipeable-row";

type WorkspaceContact = {
  id: string;
  fullName: string;
  phoneticFirstName: string | null;
  phoneticLastName: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  phoneticCompany: string | null;
  jobTitle: string | null;
  website: string | null;
  birthday: string | null;
  address: string | null;
  isFavorite: boolean;
  isEmergency: boolean;
  sharedKind: "family" | "team" | null;
  notes: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
};

type ContactsWorkspaceTableProps = {
  contacts: WorkspaceContact[];
  emptyState: string;
  mode: "active" | "archived";
  viewMode: "compact" | "cozy";
  groupByLetter: boolean;
  query: string;
};

const AVATAR_TINTS: Array<[string, string]> = [
  ["#e6ece4", "#3f6b53"],
  ["#e9e7f4", "#5a55a6"],
  ["#f3e7df", "#9a623a"],
  ["#e2edf2", "#3d6f8a"],
  ["#f2e6ea", "#9a4a63"],
  ["#e8efe0", "#5f7a3a"],
  ["#efe9df", "#85703f"],
  ["#e3eef0", "#3f7d7a"],
];

const tintForName = (value: string): [string, string] => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]!;
};

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const getDisplayName = (contact: WorkspaceContact) => {
  const fullName = contact.fullName?.trim() ?? "";
  if (fullName.length > 0) {
    return fullName;
  }
  const company = contact.company?.trim() ?? "";
  return company.length > 0 ? company : "Unnamed contact";
};

const getGroupLetter = (contact: WorkspaceContact) => {
  const fullName = contact.fullName?.trim() ?? "";
  const company = contact.company?.trim() ?? "";
  const source = fullName.length > 0 ? fullName : company;
  const lastToken = source.split(/\s+/).filter(Boolean).pop() ?? "";
  const first = (lastToken[0] ?? source[0] ?? "#").toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
};

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) {
    return <>{text}</>;
  }
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-[3px] bg-[#fff0bf] px-0.5 text-inherit">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

function Avatar({ name, size }: { name: string; size: number }) {
  const [bg, fg] = tintForName(name);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }}
    >
      {getInitials(name)}
    </span>
  );
}

// Inline cluster after the name: favorite toggle + governed status badges.
// Delegates to the shared ContactBadgeCluster (P15-01) so the icon vocabulary
// is identical across rows, the detail page, and future sidebar groupings.
function RowBadges({ contact, mode }: { contact: WorkspaceContact; mode: "active" | "archived" }) {
  return (
    <ContactBadgeCluster
      contactId={contact.id}
      flags={{
        isFavorite: contact.isFavorite,
        isEmergency: contact.isEmergency,
        inFamilyBook: contact.sharedKind === "family",
        inTeamBook: contact.sharedKind === "team",
      }}
      redirectTo={mode === "active" ? "/contacts?tab=people" : "/contacts?tab=archived"}
    />
  );
}

function RowActions({ contact, mode }: { contact: WorkspaceContact; mode: "active" | "archived" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="relative flex items-center justify-end gap-0.5">
      <Link
        aria-label="Edit contact"
        className="hidden h-[30px] w-[30px] place-items-center rounded-md text-slate-500 transition hover:bg-[rgba(0,0,0,0.06)] hover:text-slate-700 group-hover:grid"
        href={`/contacts/${contact.id}`}
        prefetch={false}
        onClick={(event) => event.stopPropagation()}
      >
        ✎
      </Link>
      <button
        aria-label="More actions"
        className="hidden h-[30px] w-[30px] place-items-center rounded-md text-lg leading-none text-slate-500 transition hover:bg-[rgba(0,0,0,0.06)] hover:text-slate-700 group-hover:grid"
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        type="button"
      >
        ⋯
      </button>
      {menuOpen ? (
        <>
          <button
            aria-hidden
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenuOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-[0.9rem] border border-[#d8ddd6] bg-white py-1 shadow-[0_12px_34px_rgba(20,30,25,0.16)]">
            <Link className="block px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50" href={`/contacts/${contact.id}`} prefetch={false}>
              Open
            </Link>
            {mode === "active" ? (
              <form action={archiveContact}>
                <input name="contactId" type="hidden" value={contact.id} />
                <input name="redirectTo" type="hidden" value="/contacts?tab=people" />
                <button className="block w-full px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50" type="submit">
                  Archive
                </button>
              </form>
            ) : (
              <form action={restoreContact}>
                <input name="contactId" type="hidden" value={contact.id} />
                <input name="redirectTo" type="hidden" value="/contacts?tab=archived" />
                <button className="block w-full px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50" type="submit">
                  Restore
                </button>
              </form>
            )}
            <form action={permanentlyDeleteContact}>
              <input name="contactId" type="hidden" value={contact.id} />
              <input name="redirectTo" type="hidden" value={mode === "active" ? "/contacts?tab=people" : "/contacts?tab=archived"} />
              <button className="block w-full px-4 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50" type="submit">
                Delete permanently
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}

const GRID = "grid-cols-[44px_minmax(150px,2.3fr)_minmax(110px,1.35fr)_minmax(170px,1.95fr)_158px_92px]";

function Cell({ value, query }: { value: string | null; query: string }) {
  if (!value?.trim()) {
    return <span className="text-slate-300">—</span>;
  }
  return <Highlight query={query} text={value} />;
}

function ContactRow({
  contact,
  mode,
  viewMode,
  query,
  selected,
  onToggleSelect,
  onArchived,
  onOpenContact,
}: {
  contact: WorkspaceContact;
  mode: "active" | "archived";
  viewMode: "compact" | "cozy";
  query: string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onArchived: (contactId: string) => void;
  onOpenContact: () => void;
}) {
  const [, startTransition] = useTransition();
  const displayName = getDisplayName(contact);
  const avatarSize = viewMode === "compact" ? 32 : 40;

  const handleSwipeArchive = () => {
    onArchived(contact.id);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("contactId", contact.id);
      await archiveContact(fd);
    });
  };

  const handleSwipeFavourite = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("contactId", contact.id);
      await toggleFavoriteContact(fd);
    });
  };

  const avatarSlot = (
    <span className="relative inline-grid place-items-center" style={{ width: 40, height: 40 }}>
      <span className={selected ? "opacity-0" : "opacity-100 group-hover:opacity-0"}>
        <Avatar name={displayName} size={avatarSize} />
      </span>
      <button
        aria-label={selected ? "Deselect contact" : "Select contact"}
        className={`absolute inset-0 z-10 grid place-items-center rounded-full transition ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelect(contact.id);
        }}
        type="button"
      >
        <span
          className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] border-[1.6px] text-[10px] ${
            selected ? "border-[#4158f4] bg-[#4158f4] text-white" : "border-slate-400 bg-white text-transparent"
          }`}
        >
          ✓
        </span>
      </button>
    </span>
  );

  const meta = [contact.company, contact.email, contact.phone].filter((value) => value?.trim());

  const stacked = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {avatarSlot}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link className="min-w-0 truncate" href={`/contacts/${contact.id}`} onClick={onOpenContact} prefetch={false}>
            <span className="truncate text-[14.5px] font-semibold text-[#1d2823]">
              <Highlight query={query} text={displayName} />
            </span>
          </Link>
          <RowBadges contact={contact} mode={mode} />
        </div>
        <p className="truncate text-[12.5px] text-[#8b938c]">
          {meta.length > 0
            ? meta.map((value, index) => (
                <span key={index}>
                  {index > 0 ? <span className="mx-1.5 text-[#aeb4ac]">·</span> : null}
                  <Highlight query={query} text={value!} />
                </span>
              ))
            : "No details yet"}
        </p>
      </div>
      <RowActions contact={contact} mode={mode} />
    </div>
  );

  // Cozy: stacked two-line at every width.
  if (viewMode === "cozy") {
    return (
      <SwipeableRow
        isFavourite={contact.isFavorite}
        onArchive={handleSwipeArchive}
        onToggleFavourite={handleSwipeFavourite}
      >
        <div
          className={`group flex min-h-[60px] items-center gap-3 border-b border-[#edf0ea] px-3 transition ${
            selected ? "bg-[#edf0fe]" : "bg-white hover:bg-[#f2f4f0]"
          }`}
        >
          {stacked}
        </div>
      </SwipeableRow>
    );
  }

  // Compact: column grid on desktop, 60px stacked row on mobile (<lg).
  return (
    <div
      className={`group border-b border-[#edf0ea] transition ${
        selected ? "bg-[#edf0fe]" : "hover:bg-[#f2f4f0]"
      }`}
      data-selected={selected ? "1" : "0"}
    >
      <div className={`hidden ${GRID} items-center gap-4 px-3 py-2 lg:grid`}>
        {avatarSlot}
        <div className="flex min-w-0 items-center gap-1.5">
          <Link className="min-w-0 truncate" href={`/contacts/${contact.id}`} onClick={onOpenContact} prefetch={false}>
            <span className="truncate text-sm font-semibold text-[#1d2823]">
              <Highlight query={query} text={displayName} />
            </span>
          </Link>
          <RowBadges contact={contact} mode={mode} />
        </div>
        <div className="truncate text-[13px] text-[#5c655e]">
          <Cell query={query} value={contact.company} />
        </div>
        <div className="truncate text-[13px] text-[#5c655e]">
          <Cell query={query} value={contact.email} />
        </div>
        <div className="truncate text-[13px] tabular-nums text-[#5c655e]">
          <Cell query={query} value={contact.phone} />
        </div>
        <RowActions contact={contact} mode={mode} />
      </div>
      <div className="lg:hidden">
        <SwipeableRow
          isFavourite={contact.isFavorite}
          onArchive={handleSwipeArchive}
          onToggleFavourite={handleSwipeFavourite}
        >
          <div className={`flex min-h-[60px] items-center px-3 ${selected ? "bg-[#edf0fe]" : "bg-white"}`}>
            {stacked}
          </div>
        </SwipeableRow>
      </div>
    </div>
  );
}

function GroupHeading({ label, favorites }: { label: string; favorites?: boolean }) {
  if (favorites) {
    return (
      <div
        style={{
          height: 28,
          display: "flex",
          alignItems: "center",
          gap: 6,
          backgroundColor: "#f2f4f0",
          paddingLeft: 16,
        }}
      >
        <span style={{ fontSize: 12, color: "#c9960c", lineHeight: 1 }}>★</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#a07a10", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Favourites
        </span>
      </div>
    );
  }
  return (
    <div
      style={{
        height: 28,
        display: "flex",
        alignItems: "center",
        backgroundColor: "#f2f4f0",
        paddingLeft: 16,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: "#8b938c", lineHeight: 1 }}>
        {label}
      </span>
    </div>
  );
}

type VRow =
  | { type: "group-header"; label: string; favorites?: boolean }
  | { type: "contact"; contact: WorkspaceContact };

const FAVE_H = 28; // Favourites header — same height as letter headers
const LETTER_H = 28; // Alphabetical letter headers per design spec
const CONTACT_LIST_SCROLL_KEY = "kontax:contacts:list-scroll";

export function ContactsWorkspaceTable({
  contacts,
  emptyState,
  mode,
  viewMode,
  groupByLetter,
  query,
}: ContactsWorkspaceTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [undoContactId, setUndoContactId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [, startUndoTransition] = useTransition();

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  // mounted is set in a layout effect so it becomes true before the first paint,
  // allowing initialRect to use window.innerHeight without an SSR/hydration mismatch
  // (server renders height=0 → 0 items; client layout effect immediately re-renders
  // with actual viewport height so items appear before paint).
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let el: Element | null = listRef.current?.parentElement ?? null;
    while (el && el !== document.documentElement) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") {
        setScrollEl(el as HTMLElement);
        break;
      }
      el = el.parentElement;
    }
  }, []);

  const visibleContacts = useMemo(
    () => contacts.filter((c) => !hiddenIds.has(c.id)),
    [contacts, hiddenIds],
  );

  const scrollMemoryKey = useMemo(
    () => JSON.stringify({ mode, viewMode, groupByLetter, query }),
    [groupByLetter, mode, query, viewMode],
  );

  const saveListScrollPosition = useCallback(() => {
    if (typeof window === "undefined") return;

    sessionStorage.setItem(
      CONTACT_LIST_SCROLL_KEY,
      JSON.stringify({
        key: scrollMemoryKey,
        scrollTop: scrollEl?.scrollTop ?? null,
        windowY: window.scrollY,
      }),
    );
  }, [scrollEl, scrollMemoryKey]);

  const handleArchived = useCallback((contactId: string) => {
    setHiddenIds((prev) => new Set([...prev, contactId]));
    clearTimeout(undoTimer.current);
    setUndoContactId(contactId);
    undoTimer.current = setTimeout(() => setUndoContactId(null), 5000);
  }, []);

  const handleUndo = () => {
    if (!undoContactId) return;
    clearTimeout(undoTimer.current);
    const id = undoContactId;
    setUndoContactId(null);
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    startUndoTransition(async () => {
      const fd = new FormData();
      fd.set("contactId", id);
      await restoreContact(fd);
    });
  };

  const isSearching = query.trim().length > 0;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hasSelection = selectedIds.length > 0;
  const visibleIds = visibleContacts.map((contact) => contact.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const toggleSelect = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : visibleIds);

  const favorites = !isSearching && mode === "active" ? visibleContacts.filter((c) => c.isFavorite) : [];
  const rest = !isSearching && mode === "active" ? visibleContacts.filter((c) => !c.isFavorite) : visibleContacts;

  const groups = useMemo(() => {
    if (!groupByLetter || isSearching) return null;
    const map = new Map<string, WorkspaceContact[]>();
    for (const contact of rest) {
      const letter = getGroupLetter(contact);
      const bucket = map.get(letter) ?? [];
      bucket.push(contact);
      map.set(letter, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [groupByLetter, isSearching, rest]);

  // Flatten groups + favorites into a single array for the virtualizer.
  const flatRows = useMemo<VRow[]>(() => {
    const rows: VRow[] = [];
    if (favorites.length > 0) {
      rows.push({ type: "group-header", label: "Favorites", favorites: true });
      for (const c of favorites) rows.push({ type: "contact", contact: c });
    }
    if (groups) {
      for (const [letter, bucket] of groups) {
        rows.push({ type: "group-header", label: letter });
        for (const c of bucket) rows.push({ type: "contact", contact: c });
      }
    } else {
      for (const c of rest) rows.push({ type: "contact", contact: c });
    }
    return rows;
  }, [favorites, groups, rest]);

  const rowH = viewMode === "cozy" ? 60 : 52;

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => {
      const row = flatRows[i];
      if (row?.type === "group-header") return row.favorites ? FAVE_H : LETTER_H;
      return rowH;
    },
    overscan: 12,
    // 0 during SSR so server and client render the same empty list (no hydration
    // mismatch). The layout effect above sets mounted=true synchronously before
    // the first paint, so the actual viewport height kicks in immediately on mount.
    initialRect: { width: 0, height: mounted ? window.innerHeight : 0 },
    measureElement:
      typeof window !== "undefined" && !navigator.userAgent.includes("Firefox")
        ? (el) => el.getBoundingClientRect().height
        : undefined,
  });

  const restoredScrollRef = useRef(false);
  useLayoutEffect(() => {
    if (!mounted || restoredScrollRef.current || typeof window === "undefined") return;

    const isMobileViewport = window.matchMedia("(max-width: 1023px)").matches;
    const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (isMobileViewport && navigationEntry?.type === "reload") {
      sessionStorage.removeItem(CONTACT_LIST_SCROLL_KEY);
      restoredScrollRef.current = true;
      return;
    }

    const raw = sessionStorage.getItem(CONTACT_LIST_SCROLL_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw) as {
        key?: string;
        scrollTop?: number | null;
        windowY?: number;
      };

      if (saved.key !== scrollMemoryKey) return;

      restoredScrollRef.current = true;
      requestAnimationFrame(() => {
        if (scrollEl && typeof saved.scrollTop === "number") {
          scrollEl.scrollTop = saved.scrollTop;
        }
        if (typeof saved.windowY === "number") {
          window.scrollTo({ top: saved.windowY, behavior: "instant" });
        }
      });
    } catch {
      sessionStorage.removeItem(CONTACT_LIST_SCROLL_KEY);
    }
  }, [mounted, scrollEl, scrollMemoryKey]);

  if (contacts.length === 0) {
    return (
      <div className="m-4 rounded-[1.6rem] border border-dashed border-[#d8ddd6] bg-white px-6 py-12 text-center text-sm text-slate-500">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="bg-white">
      {hasSelection ? (
        <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+72px)] z-40 flex flex-wrap items-center gap-3 rounded-2xl border border-[#d8ddfb] bg-[#edf0fe] px-4 py-2.5 shadow-[0_12px_30px_rgba(36,54,130,0.18)] md:static md:rounded-none md:border-x-0 md:border-t-0 md:border-[#e9ece7] md:shadow-none">
          <button
            aria-label="Clear selection"
            className="grid h-7 w-7 place-items-center rounded-md text-slate-600 transition hover:bg-[rgba(0,0,0,0.06)]"
            onClick={() => setSelectedIds([])}
            type="button"
          >
            ✕
          </button>
          <span className="text-sm font-semibold text-slate-700">{selectedIds.length} selected</span>
          <div className="mx-1 h-5 w-px bg-[#d8ddd6]" />
          <div className="flex flex-wrap items-center gap-2">
            {mode === "active" ? (
              <form action={favoriteContactsBulk}>
                {selectedIds.map((id) => (
                  <input key={id} name="contactIds" type="hidden" value={id} />
                ))}
                <input name="redirectTo" type="hidden" value="/contacts?tab=people" />
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ddd6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                  type="submit"
                >
                  <span aria-hidden>☆</span> Favorite
                </button>
              </form>
            ) : null}
            <form action={mode === "active" ? archiveContactsBulk : restoreContactsBulk}>
              {selectedIds.map((id) => (
                <input key={id} name="contactIds" type="hidden" value={id} />
              ))}
              <input name="redirectTo" type="hidden" value={mode === "active" ? "/contacts?tab=people" : "/contacts?tab=archived"} />
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ddd6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                type="submit"
              >
                {mode === "active" ? "Archive" : "Restore"}
              </button>
            </form>
            <a
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ddd6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
              href={`/api/exports/contacts/csv?ids=${encodeURIComponent(selectedIds.join(","))}`}
            >
              <span aria-hidden>↓</span> Export
            </a>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#b5472f] bg-white px-3 py-1.5 text-xs font-semibold text-[#b5472f] transition hover:bg-[#fbeae6]"
              onClick={() => setConfirmDelete(true)}
              type="button"
            >
              <span aria-hidden>🗑</span> Delete
            </button>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog">
          <div className="w-full max-w-md rounded-[1.4rem] border border-[#d8ddd6] bg-white p-6 shadow-xl">
            <p className="text-lg font-semibold text-[#1d2823]">
              Delete {selectedIds.length} contact{selectedIds.length === 1 ? "" : "s"} permanently?
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This can&apos;t be undone. The contact{selectedIds.length === 1 ? "" : "s"} and their sync links will be removed from Kontax.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-[0.9rem] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => setConfirmDelete(false)}
                type="button"
              >
                Cancel
              </button>
              <form action={deleteContactsBulk}>
                {selectedIds.map((id) => (
                  <input key={id} name="contactIds" type="hidden" value={id} />
                ))}
                <input name="redirectTo" type="hidden" value={mode === "active" ? "/contacts?tab=people" : "/contacts?tab=archived"} />
                <button className="rounded-[0.9rem] bg-[#b5472f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9c3c28]" type="submit">
                  Delete {selectedIds.length}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {/* Sticky column header — compact desktop only, sits above the virtual list */}
      {viewMode === "compact" ? (
        <div className={`sticky top-0 z-[3] hidden ${GRID} items-center gap-4 border-b border-[#e9ece7] bg-white px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8b938c] lg:grid`}>
          <button
            aria-label={allSelected ? "Deselect all" : "Select all"}
            className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] border-[1.6px] text-[10px] transition ${
              allSelected ? "border-[#4158f4] bg-[#4158f4] text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-400"
            } ${hasSelection ? "" : "opacity-0 hover:opacity-100"}`}
            onClick={toggleSelectAll}
            type="button"
          >
            ✓
          </button>
          <span>Name</span>
          <span>Company</span>
          <span>Email</span>
          <span>Phone</span>
          <span />
        </div>
      ) : null}

      {/* Virtualised list — only renders rows near the viewport */}
      <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const row = flatRows[vItem.index]!;
          return (
            <div
              key={vItem.key}
              data-index={vItem.index}
              ref={virtualizer.measureElement}
              style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${vItem.start}px)` }}
            >
              {row.type === "group-header" ? (
                <GroupHeading favorites={row.favorites} label={row.label} />
              ) : (
                <ContactRow
                  contact={row.contact}
                  mode={mode}
                  onArchived={handleArchived}
                  onOpenContact={saveListScrollPosition}
                  onToggleSelect={toggleSelect}
                  query={query}
                  selected={selectedSet.has(row.contact.id)}
                  viewMode={viewMode}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Undo toast — mobile only, appears above the bottom nav after swipe-archive */}
      {undoContactId ? (
        <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom)+8px)] left-4 right-4 z-[60] md:hidden" role="status">
          <div style={{ background: "#1d2823", color: "#fff", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
            <span>Archived.</span>
            <button
              onClick={handleUndo}
              style={{ color: "#7c9ef4", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "0 4px" }}
              type="button"
            >
              Undo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
