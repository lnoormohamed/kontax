"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  archiveContact,
  archiveContactsBulk,
  restoreContact,
  restoreContactsBulk,
  toggleFavoriteContact,
} from "~/app/actions/contacts";

type WorkspaceContact = {
  id: string;
  fullName: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  birthday: string | null;
  address: string | null;
  isFavorite: boolean;
  notes: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
};

type ContactsWorkspaceTableProps = {
  contacts: WorkspaceContact[];
  emptyState: string;
  mode: "active" | "archived";
  viewMode: "compact" | "cozy";
};

const formatTimestamp = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const getInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const getPreviewLine = (contact: WorkspaceContact) => {
  if (contact.notes?.trim()) {
    return contact.notes.trim();
  }

  if (contact.jobTitle?.trim() || contact.company?.trim()) {
    return [contact.jobTitle, contact.company].filter(Boolean).join(" at ");
  }

  if (contact.address?.trim()) {
    return contact.address.trim();
  }

  if (contact.website?.trim()) {
    return contact.website.trim();
  }

  return "Open the contact to add more detail.";
};

const IconStar = ({ filled }: { filled: boolean }) => (
  <span aria-hidden="true" className="text-sm leading-none">
    {filled ? "★" : "☆"}
  </span>
);

const IconOpen = () => (
  <span aria-hidden="true" className="text-sm leading-none">
    ↗
  </span>
);

const IconArchive = () => (
  <span aria-hidden="true" className="text-sm leading-none">
    ⎘
  </span>
);

const IconRestore = () => (
  <span aria-hidden="true" className="text-sm leading-none">
    ↻
  </span>
);

export function ContactsWorkspaceTable({
  contacts,
  emptyState,
  mode,
  viewMode,
}: ContactsWorkspaceTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allSelected = contacts.length > 0 && selectedIds.length === contacts.length;
  const hasSelection = selectedIds.length > 0;
  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedIds.includes(contact.id)),
    [contacts, selectedIds],
  );
  const firstSelectedContact = selectedContacts[0];

  const toggleSelection = (contactId: string) => {
    setSelectedIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId],
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : contacts.map((contact) => contact.id));
  };

  if (contacts.length === 0) {
    return (
      <div className="rounded-[1.8rem] border border-dashed border-[#d8ddd6] bg-white px-6 py-12 text-sm text-slate-500">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-[#dfe4dc] bg-white">
      <div className="border-b border-[#e8ede6] bg-[#fbfcf9] px-4 py-3 lg:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex items-center gap-3 text-sm text-slate-600">
            <input
              checked={allSelected}
              className="h-4 w-4 rounded border-slate-300 text-[#4158f4] focus:ring-[#4158f4]"
              onChange={toggleSelectAll}
              type="checkbox"
            />
            <span>
              {hasSelection ? `${selectedIds.length} selected` : `Select all ${contacts.length} visible`}
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {hasSelection ? (
              <>
                {firstSelectedContact ? (
                  <Link
                    className="rounded-full border border-[#d8ddd6] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#c9d0c9] hover:bg-slate-50"
                    href={`/contacts/${firstSelectedContact.id}`}
                  >
                    Open selected
                  </Link>
                ) : null}
                <form action={mode === "active" ? archiveContactsBulk : restoreContactsBulk}>
                  {selectedIds.map((contactId) => (
                    <input key={contactId} name="contactIds" type="hidden" value={contactId} />
                  ))}
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={mode === "active" ? "/?tab=people" : "/?tab=archived"}
                  />
                  <button
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      mode === "active"
                        ? "border border-amber-300 text-amber-700 hover:border-amber-400 hover:bg-amber-50"
                        : "bg-[#4158f4] text-white hover:bg-[#3248db]"
                    }`}
                    type="submit"
                  >
                    {mode === "active" ? "Archive selected" : "Restore selected"}
                  </button>
                </form>
                <button
                  className="rounded-full border border-[#d8ddd6] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#c9d0c9] hover:bg-slate-50"
                  onClick={() => setSelectedIds([])}
                  type="button"
                >
                  Clear
                </button>
              </>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                List view
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="hidden grid-cols-[44px_minmax(280px,1.6fr)_minmax(210px,1fr)_minmax(170px,0.9fr)_minmax(180px,0.95fr)_110px_170px] items-center gap-4 border-b border-[#e8ede6] bg-[#fbfcf9] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:grid">
        <span />
        <span>Summary</span>
        <span>Email</span>
        <span>Phone</span>
        <span>Company</span>
        <span>Updated</span>
        <span className="text-right">Actions</span>
      </div>

      {contacts.map((contact, index) => {
        const isSelected = selectedIds.includes(contact.id);
        const showDesktopActions = hoveredId === contact.id || isSelected;
        const rowPaddingClass = viewMode === "cozy" ? "py-4" : "py-2.5";
        const rowGapClass = viewMode === "cozy" ? "gap-5" : "gap-4";
        const previousContact = index > 0 ? contacts[index - 1] : undefined;
        const showFavoritesStart = mode === "active" && index === 0 && contact.isFavorite;
        const showFavoritesEnd =
          mode === "active" && previousContact?.isFavorite === true && !contact.isFavorite;

        return (
          <div key={contact.id}>
            {showFavoritesStart ? (
              <div className="border-b border-[#e8ede6] bg-[#f4fbfa] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f7a67] lg:px-5">
                Pinned favorites
              </div>
            ) : null}
            {showFavoritesEnd ? (
              <div className="border-b border-[#e8ede6] bg-[#fbfcf9] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 lg:px-5">
                All contacts
              </div>
            ) : null}
            <article
              className={`border-b border-[#edf0ea] px-4 ${rowPaddingClass} transition last:border-b-0 lg:px-5 ${
                isSelected
                  ? "bg-[#f4f6ff] shadow-[inset_3px_0_0_0_#4158f4]"
                  : contact.isFavorite
                    ? "bg-[#fcfefd] hover:bg-[#f8fcfb]"
                    : "bg-white hover:bg-[#fafbf8]"
              }`}
              onMouseEnter={() => setHoveredId(contact.id)}
              onMouseLeave={() =>
                setHoveredId((current) => (current === contact.id ? null : current))
              }
            >
              <div
                className={`grid ${rowGapClass} lg:grid-cols-[44px_minmax(280px,1.6fr)_minmax(210px,1fr)_minmax(170px,0.9fr)_minmax(180px,0.95fr)_110px_170px] lg:items-center`}
              >
                <label className="hidden items-center justify-center pt-1 lg:flex lg:pt-0">
                  <input
                    checked={isSelected}
                    className="h-4 w-4 rounded border-slate-300 text-[#4158f4] focus:ring-[#4158f4]"
                    onChange={() => toggleSelection(contact.id)}
                    type="checkbox"
                  />
                </label>

                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8ecff] text-xs font-semibold text-[#4158f4]">
                      {getInitials(contact.fullName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="truncate text-[15px] font-semibold text-slate-900 hover:text-[#3248db]"
                          href={`/contacts/${contact.id}`}
                        >
                          {contact.fullName}
                        </Link>
                        {contact.isFavorite ? (
                          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                            Favorite
                          </span>
                        ) : null}
                        {contact.archivedAt ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                            Archived
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-slate-500">
                        {contact.nickname ? `${contact.nickname} · ` : ""}
                        {getPreviewLine(contact)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="hidden text-sm text-slate-700 lg:block">
                  <p className="truncate font-medium text-[#3341c7]">
                    {contact.email ?? "No email saved"}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">
                    {contact.website ?? "No website saved"}
                  </p>
                </div>

                <div className="hidden text-sm text-slate-700 lg:block">
                  <p className="font-medium">{contact.phone ?? "No phone saved"}</p>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    {contact.birthday ?? "No birthday saved"}
                  </p>
                </div>

                <div className="hidden text-sm text-slate-700 lg:block">
                  <p className="truncate font-medium">{contact.company ?? "Independent"}</p>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">
                    {contact.jobTitle ?? "No role saved"}
                  </p>
                </div>

                <div className="hidden text-sm text-slate-500 lg:block">
                  {formatTimestamp(contact.updatedAt)}
                </div>

                <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                  <form action={toggleFavoriteContact}>
                    <input name="contactId" type="hidden" value={contact.id} />
                    <input
                      name="redirectTo"
                      type="hidden"
                      value={mode === "active" ? "/?tab=people" : "/?tab=archived"}
                    />
                    <button
                      className={`rounded-full w-9 h-9 p-0 flex items-center justify-center border text-xs font-semibold transition ${
                        showDesktopActions
                          ? contact.isFavorite
                            ? "border-cyan-300 text-cyan-700 opacity-100 hover:border-cyan-400 hover:bg-cyan-50"
                            : "border-[#d8ddd6] text-slate-700 opacity-100 hover:border-[#c9d0c9] hover:bg-slate-50"
                          : "pointer-events-none border-transparent text-transparent opacity-0"
                      }`}
                      tabIndex={showDesktopActions ? 0 : -1}
                      type="submit"
                      aria-label={contact.isFavorite ? "Unstar contact" : "Star contact"}
                    >
                      <span className="sr-only">{contact.isFavorite ? "Unstar" : "Star"}</span>
                      <IconStar filled={contact.isFavorite} />
                    </button>
                  </form>
                  <Link
                    className={`rounded-full w-9 h-9 p-0 flex items-center justify-center border text-xs font-semibold transition ${
                      showDesktopActions
                        ? "border-[#d8ddd6] text-slate-700 opacity-100 hover:border-[#c9d0c9] hover:bg-slate-50"
                        : "pointer-events-none border-transparent text-slate-400 opacity-0"
                    }`}
                    href={`/contacts/${contact.id}`}
                    tabIndex={showDesktopActions ? 0 : -1}
                    aria-label="Open contact"
                  >
                    <span className="sr-only">Open</span>
                    <IconOpen />
                  </Link>
                  {contact.archivedAt ? (
                    <form action={restoreContact}>
                      <input name="contactId" type="hidden" value={contact.id} />
                      <input name="redirectTo" type="hidden" value="/?tab=archived" />
                      <button
                        className={`rounded-full w-9 h-9 p-0 flex items-center justify-center text-xs font-semibold transition ${
                          showDesktopActions
                            ? "bg-[#4158f4] text-white opacity-100 hover:bg-[#3248db]"
                            : "pointer-events-none bg-transparent text-transparent opacity-0"
                        }`}
                        tabIndex={showDesktopActions ? 0 : -1}
                        type="submit"
                        aria-label="Restore contact"
                      >
                        <span className="sr-only">Restore</span>
                        <IconRestore />
                      </button>
                    </form>
                  ) : (
                    <form action={archiveContact}>
                      <input name="contactId" type="hidden" value={contact.id} />
                      <input name="redirectTo" type="hidden" value="/?tab=people" />
                      <button
                        className={`rounded-full border w-9 h-9 p-0 flex items-center justify-center text-xs font-semibold transition ${
                          showDesktopActions
                            ? "border-amber-300 text-amber-700 opacity-100 hover:border-amber-400 hover:bg-amber-50"
                            : "pointer-events-none border-transparent text-transparent opacity-0"
                        }`}
                        tabIndex={showDesktopActions ? 0 : -1}
                        type="submit"
                        aria-label="Archive contact"
                      >
                        <span className="sr-only">Archive</span>
                        <IconArchive />
                      </button>
                    </form>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 lg:hidden">
                <form action={toggleFavoriteContact}>
                  <input name="contactId" type="hidden" value={contact.id} />
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={mode === "active" ? "/?tab=people" : "/?tab=archived"}
                  />
                  <button
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      contact.isFavorite
                        ? "border border-cyan-300 text-cyan-700 hover:border-cyan-400 hover:bg-cyan-50"
                        : "border border-[#d8ddd6] text-slate-700 hover:border-[#c9d0c9] hover:bg-slate-50"
                    }`}
                    type="submit"
                  >
                    {contact.isFavorite ? "Unstar" : "Star"}
                  </button>
                </form>
                {contact.archivedAt ? (
                  <form action={restoreContact}>
                    <input name="contactId" type="hidden" value={contact.id} />
                    <input name="redirectTo" type="hidden" value="/?tab=archived" />
                    <button
                      className="rounded-full bg-[#4158f4] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3248db]"
                      type="submit"
                    >
                      Restore
                    </button>
                  </form>
                ) : (
                  <form action={archiveContact}>
                    <input name="contactId" type="hidden" value={contact.id} />
                    <input name="redirectTo" type="hidden" value="/?tab=people" />
                    <button
                      className="rounded-full border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-400 hover:bg-amber-50"
                      type="submit"
                    >
                      Archive
                    </button>
                  </form>
                )}
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
