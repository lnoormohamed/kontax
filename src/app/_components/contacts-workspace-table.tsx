"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  archiveContact,
  permanentlyDeleteContact,
  restoreContact,
  toggleFavoriteContact,
} from "~/app/actions/contacts";
import { BulkEditToolbar, type ToolbarBook } from "~/app/_components/bulk-edit-toolbar";
import { ContactBadgeCluster } from "~/app/_components/contact-badge-cluster";
import { LabelChip, LabelDot } from "~/app/_components/label-chip";
import { SwipeableRow } from "~/app/_components/contact-list/swipeable-row";
import { KeyboardShortcutsOverlay } from "~/app/contacts/_components/keyboard-shortcuts-overlay";
import { fromJson, toQueryString } from "~/lib/contact-filter-state";
import { getDisplayName } from "~/lib/display-name";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

type WorkspaceContact = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
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
  // P31B-06: JSON string[] from Prisma (optional — may be absent on older data)
  labels?: unknown;
};

type ContactsWorkspaceTableProps = {
  contacts: WorkspaceContact[];
  emptyState: string;
  mode: "active" | "archived";
  viewMode: "compact" | "cozy";
  groupByLetter: boolean;
  query: string;
  nameDisplayOrder?: "first-last" | "last-first";
  // P28-04: bulk-edit toolbar data.
  books: ToolbarBook[];
  labelSuggestions: string[];
  // P28-05: smart lists for the 1–9 keyboard shortcuts.
  smartLists: { id: string; name: string; filterState: unknown }[];
  // P31B-06: label name → color lookup for row chips.
  labelRegistry: { name: string; color: string }[];
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

const tintForName = (primary: string | null | undefined, fallback?: string | null): [string, string] => {
  const src = (primary?.trim() ?? fallback?.trim()) ?? "?";
  let hash = 0;
  for (let index = 0; index < src.length; index += 1) {
    hash = (hash * 31 + src.charCodeAt(index)) >>> 0;
  }
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]!;
};

const getInitials = (primary: string | null | undefined, fallback?: string | null) => {
  const src = (primary?.trim() ?? fallback?.trim()) ?? "";
  return src
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

const getGroupLetter = (contact: WorkspaceContact) => {
  const fullName = contact.fullName?.trim() ?? "";
  const company = contact.company?.trim() ?? "";
  const source = fullName.length > 0 ? fullName : company;
  const lastToken = source.split(/\s+/).filter(Boolean).pop() ?? "";
  const first = (lastToken[0] ?? source[0] ?? "#").toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
};

// P33-05: when query is active, show why a contact matched if it's not
// immediately obvious from the visible name/company/email/phone cells.
// Returns { field, snippet } only for label and notes matches.
function inferMatchSnippet(
  contact: WorkspaceContact,
  q: string,
): { field: "label" | "notes"; snippet: string } | null {
  if (!q) return null;
  const ql = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  const isPhoneQuery = !/[a-z]/i.test(q) && digits.length >= 2;
  if (isPhoneQuery) return null;
  // name / company / email / phone already highlighted inline — skip them
  if (
    contact.fullName.toLowerCase().includes(ql) ||
    (contact.nickname ?? "").toLowerCase().includes(ql) ||
    (contact.company ?? "").toLowerCase().includes(ql) ||
    (contact.email ?? "").toLowerCase().includes(ql) ||
    (contact.phone ?? "").toLowerCase().includes(ql)
  ) return null;
  // label match
  const labels = Array.isArray(contact.labels)
    ? (contact.labels as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const matchedLabel = labels.find((l) => l.toLowerCase().includes(ql));
  if (matchedLabel) return { field: "label", snippet: matchedLabel };
  // notes match
  if (contact.notes?.toLowerCase().includes(ql)) {
    const notes = contact.notes;
    const i = notes.toLowerCase().indexOf(ql);
    let start = Math.max(0, i - 28);
    if (start > 0) { const sp = notes.indexOf(" ", start); if (sp > -1 && sp < i) start = sp + 1; }
    let end = Math.min(notes.length, start + 90);
    if (end < notes.length) { const sp = notes.lastIndexOf(" ", end); if (sp > start + 20) end = sp; }
    const excerpt = (start > 0 ? "…" : "") + notes.slice(start, end).trim() + (end < notes.length ? "…" : "");
    return { field: "notes", snippet: excerpt };
  }
  return null;
}

const Highlight = memo(function Highlight({ text, query }: { text: string; query: string }) {
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
});

const Avatar = memo(function Avatar({
  fullName,
  company,
  size,
}: {
  fullName: string | null | undefined;
  company?: string | null;
  size: number;
}) {
  const [bg] = tintForName(fullName, company);
  const initials = getInitials(fullName, company);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}
    >
      {initials ? (
        <span style={{ color: tintForName(fullName, company)[1] }}>{initials}</span>
      ) : (
        <WorkspaceIcon name="person" size={Math.round(size * 0.4)} strokeWidth={1.6} className="text-[#aeb4ac]" />
      )}
    </span>
  );
});

// Inline cluster after the name: favorite toggle + governed status badges.
// Delegates to the shared ContactBadgeCluster (P15-01) so the icon vocabulary
// is identical across rows, the detail page, and future sidebar groupings.
const RowBadges = memo(function RowBadges({ contact, mode }: { contact: WorkspaceContact; mode: "active" | "archived" }) {
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
});

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

// P31B-06: parse the Prisma JSON[] into a clean string array.
const parseLabels = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
};

// Desktop: up to 2 chips + +N overflow. Mobile: up to 3 dots + +N count.
const RowLabelChips = memo(function RowLabelChips({
  labels,
  labelColors,
  isMobile,
}: {
  labels: string[];
  labelColors: Record<string, string>;
  isMobile?: boolean;
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  if (labels.length === 0) return null;

  const col = (name: string) => labelColors[name.toLowerCase()] ?? "#8b938c";

  if (isMobile) {
    const shown = labels.slice(0, 3);
    const extra = labels.length - shown.length;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {shown.map((name, i) => (
          <LabelDot key={i} col={col(name)} size={8} />
        ))}
        {extra > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#8b938c", marginLeft: 1 }}>+{extra}</span>
        )}
      </span>
    );
  }

  const shown = labels.slice(0, 2);
  const hidden = labels.slice(2);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
      {shown.map((name) => (
        <LabelChip key={name} name={name} col={col(name)} sz="sm" />
      ))}
      {hidden.length > 0 && (
        <span
          style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
          onMouseEnter={() => setOverflowOpen(true)}
          onMouseLeave={() => setOverflowOpen(false)}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 22,
              padding: "0 9px",
              borderRadius: 999,
              background: "#f2f4f0",
              color: "#5c655e",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1,
              cursor: "default",
            }}
          >
            +{hidden.length}
          </span>
          {overflowOpen && (
            <span
              style={{
                position: "absolute",
                top: "calc(100% + 7px)",
                left: 0,
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 7,
                padding: 9,
                background: "#fff",
                borderRadius: 11,
                boxShadow: "0 12px 34px rgba(20,30,25,0.2), 0 0 0 1px rgba(20,30,25,0.06)",
              }}
            >
              {hidden.map((name) => (
                <LabelChip key={name} name={name} col={col(name)} sz="sm" />
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
});

const GRID = "grid-cols-[44px_minmax(150px,2.3fr)_minmax(110px,1.35fr)_minmax(170px,1.95fr)_158px_92px]";

function Cell({ value, query }: { value: string | null; query: string }) {
  if (!value?.trim()) {
    return <span className="text-slate-300">—</span>;
  }
  return <Highlight query={query} text={value} />;
}

const ContactRow = memo(function ContactRow({
  contact,
  mode,
  viewMode,
  query,
  selected,
  focused,
  labelColors,
  nameDisplayOrder,
  onToggleSelect,
  onArchived,
  onOpenContact,
}: {
  contact: WorkspaceContact;
  mode: "active" | "archived";
  viewMode: "compact" | "cozy";
  query: string;
  selected: boolean;
  focused: boolean;
  labelColors: Record<string, string>;
  nameDisplayOrder?: "first-last" | "last-first";
  onToggleSelect: (id: string) => void;
  onArchived: (contactId: string) => void;
  onOpenContact: (contactId: string) => void;
}) {
  const [, startTransition] = useTransition();
  const [optimisticFavorite, setOptimisticFavorite] = useState(contact.isFavorite);
  const displayName = getDisplayName(contact, { nameDisplayOrder }) || "Unnamed contact";
  const avatarSize = viewMode === "compact" ? 32 : 40;

  useEffect(() => {
    setOptimisticFavorite(contact.isFavorite);
  }, [contact.isFavorite]);

  const handleSwipeArchive = () => {
    onArchived(contact.id);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("contactId", contact.id);
      await archiveContact(fd);
    });
  };

  const handleSwipeFavourite = () => {
    setOptimisticFavorite((current) => !current);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("contactId", contact.id);
      await toggleFavoriteContact(fd);
    });
  };

  const avatarSlot = (
    <span className="relative inline-grid place-items-center" style={{ width: 40, height: 40 }}>
      <span className={selected ? "opacity-0" : "opacity-100 group-hover:opacity-0"}>
        <Avatar fullName={contact.fullName} company={contact.company} size={avatarSize} />
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
  const contactLabels = parseLabels(contact.labels);
  const matchSnippet = inferMatchSnippet(contact, query);

  const stacked = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {avatarSlot}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link
            className="min-w-0 truncate"
            href={`/contacts/${contact.id}`}
            onClick={() => onOpenContact(contact.id)}
            onPointerDown={() => onOpenContact(contact.id)}
            prefetch={false}
          >
            <span className="truncate text-[14.5px] font-semibold text-[#1d2823]">
              <Highlight query={query} text={displayName} />
            </span>
          </Link>
          <RowBadges contact={contact} mode={mode} />
          {contactLabels.length > 0 && <RowLabelChips labels={contactLabels} labelColors={labelColors} isMobile />}
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
        {matchSnippet && (
          <p className="mt-0.5 truncate text-[11.5px] text-[#8b938c]" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {matchSnippet.field === "label" ? (
              <>
                <LabelDot col={labelColors[matchSnippet.snippet] ?? "#aeb4ac"} />
                <span style={{ color: "#5c655e", fontWeight: 500 }}>{matchSnippet.snippet}</span>
              </>
            ) : (
              <>
                <span style={{ color: "#aeb4ac" }}>Note:</span>
                <span className="truncate">
                  <Highlight query={query} text={matchSnippet.snippet} />
                </span>
              </>
            )}
          </p>
        )}
      </div>
      <RowActions contact={contact} mode={mode} />
    </div>
  );

  // Cozy: stacked two-line at every width.
  if (viewMode === "cozy") {
    return (
      <SwipeableRow
        isFavourite={optimisticFavorite}
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
        selected ? "bg-[#edf0fe]" : focused ? "bg-[#f1f5ee]" : "hover:bg-[#f2f4f0]"
      }`}
      data-selected={selected ? "1" : "0"}
      data-contact-row={contact.id}
      style={focused && !selected ? { boxShadow: "inset 2px 0 0 #17352e" } : undefined}
    >
      <div className={`hidden ${GRID} items-center gap-4 px-3 py-2 lg:grid`}>
        {avatarSlot}
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            className="min-w-0 truncate"
            href={`/contacts/${contact.id}`}
            onClick={() => onOpenContact(contact.id)}
            onPointerDown={() => onOpenContact(contact.id)}
            prefetch={false}
          >
            <span className="truncate text-sm font-semibold text-[#1d2823]">
              <Highlight query={query} text={displayName} />
            </span>
          </Link>
          <RowBadges contact={contact} mode={mode} />
          {contactLabels.length > 0 && <RowLabelChips labels={contactLabels} labelColors={labelColors} />}
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
          isFavourite={optimisticFavorite}
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
});

const GroupHeading = memo(function GroupHeading({ label, favorites }: { label: string; favorites?: boolean }) {
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
});

type VRow =
  | { type: "group-header"; label: string; favorites?: boolean }
  | { type: "contact"; contact: WorkspaceContact };

const FAVE_H = 28; // Favourites header — same height as letter headers
const LETTER_H = 28; // Alphabetical letter headers per design spec
const CONTACT_LIST_SCROLL_KEY = "kontax:contacts:list-scroll";
const CONTACT_LIST_SCROLL_MAX_AGE = 10 * 60 * 1000;
const CONTACT_LIST_RESTORE_PARAM = "restoreContact";

const getScrollParent = (node: HTMLElement | null) => {
  let el: Element | null = node?.parentElement ?? null;
  while (el && el !== document.documentElement) {
    const oy = getComputedStyle(el).overflowY;
    if (oy === "auto" || oy === "scroll") {
      return el as HTMLElement;
    }
    el = el.parentElement;
  }
  return null;
};

const clearRestoreContactParam = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(CONTACT_LIST_RESTORE_PARAM)) return;
  url.searchParams.delete(CONTACT_LIST_RESTORE_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
};

export function ContactsWorkspaceTable({
  contacts,
  emptyState,
  mode,
  viewMode,
  groupByLetter,
  query,
  nameDisplayOrder,
  books,
  labelSuggestions,
  smartLists,
  labelRegistry,
}: ContactsWorkspaceTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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
    setScrollEl(getScrollParent(listRef.current));
  }, []);

  const labelColors = useMemo(
    () => Object.fromEntries(labelRegistry.map((l) => [l.name.toLowerCase(), l.color])),
    [labelRegistry],
  );

  const visibleContacts = useMemo(
    () => contacts.filter((c) => !hiddenIds.has(c.id)),
    [contacts, hiddenIds],
  );

  const scrollMemoryKey = useMemo(
    () => JSON.stringify({ mode, viewMode, groupByLetter, query }),
    [groupByLetter, mode, query, viewMode],
  );

  const saveListScrollPosition = useCallback((contactId: string) => {
    if (typeof window === "undefined") return;
    const activeScrollEl = scrollEl ?? getScrollParent(listRef.current);
    const url = new URL(window.location.href);
    url.searchParams.set(CONTACT_LIST_RESTORE_PARAM, contactId);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

    sessionStorage.setItem(
      CONTACT_LIST_SCROLL_KEY,
      JSON.stringify({
        createdAt: Date.now(),
        key: scrollMemoryKey,
        contactId,
        scrollTop: activeScrollEl?.scrollTop ?? null,
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
  const visibleIds = useMemo(() => visibleContacts.map((contact) => contact.id), [visibleContacts]);
  const allSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id)),
    [selectedSet, visibleIds],
  );

  const toggleSelect = useCallback((id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    ), []);
  const toggleSelectAll = useCallback(
    () => setSelectedIds(allSelected ? [] : visibleIds),
    [allSelected, visibleIds],
  );

  const { favorites, rest } = useMemo(() => {
    if (isSearching || mode !== "active") {
      return { favorites: [] as WorkspaceContact[], rest: visibleContacts };
    }
    const nextFavorites: WorkspaceContact[] = [];
    const nextRest: WorkspaceContact[] = [];
    for (const contact of visibleContacts) {
      if (contact.isFavorite) nextFavorites.push(contact);
      else nextRest.push(contact);
    }
    return { favorites: nextFavorites, rest: nextRest };
  }, [isSearching, mode, visibleContacts]);

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
  const virtualItems = virtualizer.getVirtualItems();

  // P28-05: keyboard shortcuts. Focused-row navigation + global actions, scoped
  // to the contacts workspace and suppressed while an input/textarea is focused.
  const contactRows = useMemo(
    () =>
      flatRows.flatMap((row, flatIndex) =>
        row.type === "contact" ? [{ id: row.contact.id, flatIndex }] : [],
      ),
    [flatRows],
  );

  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
    };

    const focusAt = (pos: number) => {
      const target = contactRows[pos];
      if (!target) return;
      setFocusedId(target.id);
      virtualizer.scrollToIndex(target.flatIndex, { align: "auto" });
    };

    const handler = (e: KeyboardEvent) => {
      // `?` always toggles the overlay (even when it's open, to close it).
      if (e.key === "?" && !isInputFocused()) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      if (shortcutsOpen) return; // overlay owns Escape; ignore the rest underneath.
      if (isInputFocused()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) {
        // leave 1–9 list switching for the unmodified keys only.
        if (!/^[1-9]$/.test(e.key)) return;
      }

      const pos = focusedId ? contactRows.findIndex((c) => c.id === focusedId) : -1;
      const focusedContactId = pos >= 0 ? contactRows[pos]!.id : null;
      const runForm = (action: (fd: FormData) => Promise<unknown>, id: string) => {
        const fd = new FormData();
        fd.set("contactId", id);
        startUndoTransition(async () => {
          await action(fd);
        });
      };

      switch (e.key) {
        case "j":
          e.preventDefault();
          focusAt(pos < 0 ? 0 : Math.min(pos + 1, contactRows.length - 1));
          break;
        case "k":
          e.preventDefault();
          focusAt(pos < 0 ? 0 : Math.max(pos - 1, 0));
          break;
        case "/":
          e.preventDefault();
          document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
          break;
        case "c":
          e.preventDefault();
          router.push("/contacts/new");
          break;
        case "Enter":
        case "e":
          if (focusedContactId) {
            e.preventDefault();
            router.push(`/contacts/${focusedContactId}`);
          }
          break;
        case "f":
          if (focusedContactId) {
            e.preventDefault();
            runForm(toggleFavoriteContact, focusedContactId);
          }
          break;
        case "Backspace":
          if (focusedContactId && mode === "active") {
            e.preventDefault();
            handleArchived(focusedContactId);
            runForm(archiveContact, focusedContactId);
            // advance focus to the row that takes its place
            focusAt(Math.min(pos, contactRows.length - 2));
          }
          break;
        case "Escape":
          if (focusedId) {
            e.preventDefault();
            setFocusedId(null);
          }
          break;
        default: {
          if (/^[1-9]$/.test(e.key)) {
            const idx = Number(e.key) - 1;
            const list = smartLists[idx];
            if (list) {
              e.preventDefault();
              router.push(`/contacts?${toQueryString(fromJson(list.filterState))}`);
            }
          }
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [contactRows, focusedId, mode, router, shortcutsOpen, smartLists, virtualizer, handleArchived, startUndoTransition]);

  const stickySection = useMemo(() => {
    if (virtualItems.length === 0) return null;
    const listOffsetTop = listRef.current?.offsetTop ?? 0;
    const offset = Math.max(0, (scrollEl?.scrollTop ?? 0) - listOffsetTop + 2);
    let topIndex = virtualItems[0]!.index;
    for (const item of virtualItems) {
      if (item.start <= offset) topIndex = item.index;
      else break;
    }
    for (let index = topIndex; index >= 0; index -= 1) {
      const row = flatRows[index];
      if (row?.type === "group-header") return row;
    }
    return null;
  }, [flatRows, scrollEl?.scrollTop, virtualItems]);

  const restoredScrollRef = useRef(false);
  const restoreTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useLayoutEffect(() => {
    if (!mounted || restoredScrollRef.current || typeof window === "undefined") return;

    const isMobileViewport = window.matchMedia("(max-width: 1023px)").matches;
    const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (isMobileViewport && navigationEntry?.type === "reload") {
      sessionStorage.removeItem(CONTACT_LIST_SCROLL_KEY);
      clearRestoreContactParam();
      restoredScrollRef.current = true;
      return;
    }

    const restoreContactId = new URL(window.location.href).searchParams.get(CONTACT_LIST_RESTORE_PARAM);
    const raw = sessionStorage.getItem(CONTACT_LIST_SCROLL_KEY);
    if (!raw && !restoreContactId) return;
    if (!scrollEl) return;

    try {
      const saved = raw
        ? JSON.parse(raw) as {
            key?: string;
            createdAt?: number;
            contactId?: string;
            scrollTop?: number | null;
            windowY?: number;
          }
        : {
            key: scrollMemoryKey,
            createdAt: Date.now(),
            contactId: restoreContactId,
            scrollTop: null,
            windowY: undefined,
          };

      if (typeof saved.createdAt !== "number" || Date.now() - saved.createdAt > CONTACT_LIST_SCROLL_MAX_AGE) {
        sessionStorage.removeItem(CONTACT_LIST_SCROLL_KEY);
        if (!restoreContactId) return;
        saved.createdAt = Date.now();
        saved.contactId = restoreContactId;
        saved.key = scrollMemoryKey;
        saved.scrollTop = null;
      }
      if (saved.key !== scrollMemoryKey) return;

      restoredScrollRef.current = true;
      const restorePosition = () => {
        if (scrollEl && typeof saved.scrollTop === "number") {
          scrollEl.scrollTop = saved.scrollTop;
        }
        if (typeof saved.windowY === "number") {
          window.scrollTo({ top: saved.windowY, behavior: "instant" });
        }
        if (isMobileViewport && saved.contactId) {
          const index = flatRows.findIndex((row) => row.type === "contact" && row.contact.id === saved.contactId);
          if (index >= 0) {
            virtualizer.scrollToIndex(index, { align: "center" });
          }
        }
      };
      const restoreDelays = [0, 80, 180, 360, 700, 1200, 2200, 3600, 5200, 7600, 10000];
      restoreTimersRef.current = restoreDelays.map((delay) =>
        setTimeout(() => requestAnimationFrame(restorePosition), delay),
      );
      restoreTimersRef.current.push(
        setTimeout(() => {
          sessionStorage.removeItem(CONTACT_LIST_SCROLL_KEY);
          clearRestoreContactParam();
          restoreTimersRef.current = [];
        }, 10500),
      );
    } catch {
      sessionStorage.removeItem(CONTACT_LIST_SCROLL_KEY);
      clearRestoreContactParam();
    }
  }, [flatRows, mounted, scrollEl, scrollMemoryKey, virtualizer]);

  useEffect(() => () => {
    for (const timer of restoreTimersRef.current) {
      clearTimeout(timer);
    }
    restoreTimersRef.current = [];
  }, []);

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
        <BulkEditToolbar
          selectedIds={selectedIds}
          mode={mode}
          books={books}
          labelSuggestions={labelSuggestions}
          redirectTo={mode === "active" ? "/contacts?tab=people" : "/contacts?tab=archived"}
          onClear={() => setSelectedIds([])}
        />
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
        {/* Sticky group header (mobile) — native sticky can't pin the absolutely
            positioned virtual rows, so we overlay the current section's header at
            the top of the scroll viewport, recomputed each scroll-driven render. */}
        {stickySection ? (
          <div className="md:hidden" style={{ position: "sticky", top: 0, zIndex: 5 }}>
            <GroupHeading favorites={stickySection.favorites} label={stickySection.label} />
          </div>
        ) : null}
        {virtualItems.map((vItem) => {
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
                  nameDisplayOrder={nameDisplayOrder}
                  onArchived={handleArchived}
                  onOpenContact={saveListScrollPosition}
                  onToggleSelect={toggleSelect}
                  query={query}
                  selected={selectedSet.has(row.contact.id)}
                  focused={focusedId === row.contact.id}
                  viewMode={viewMode}
                  labelColors={labelColors}
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

      <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
