"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  archiveContact,
  archiveContactsBulk,
  permanentlyDeleteContact,
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

const parseBirthdayDate = (value: string): Date | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const isValidDate = (year: number, month: number, day: number) => {
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }

    if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const candidate = new Date(year, month - 1, day);
    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day
    ) {
      return candidate;
    }

    return null;
  };

  const normalizeTwoDigitYear = (year: number) => (year <= 40 ? 2000 + year : 1900 + year);

  const normalized = trimmed.replace(/,/g, "");
  const compactDigits = normalized.replace(/[-./\s]/g, "");

  const separatorParts = normalized.split(/[-./]/);

  if (separatorParts.length === 3) {
    const [first, second, third] = separatorParts;
    if (!first || !second || !third) {
      return null;
    }

    const rawFirst = Number(first);
    const rawSecond = Number(second);
    const rawThird = Number(third);

    if (!Number.isNaN(rawFirst) && !Number.isNaN(rawSecond) && !Number.isNaN(rawThird)) {
      const firstPartLooksYear = first.length === 4;
      if (firstPartLooksYear) {
        const candidate = isValidDate(rawFirst, rawSecond, rawThird);
        if (candidate) {
          return candidate;
        }
      }

      if (rawFirst > 12 && rawSecond <= 12) {
        const year = rawThird.toString().length === 2 ? normalizeTwoDigitYear(rawThird) : rawThird;
        return isValidDate(year, rawSecond, rawFirst);
      }

      if (rawSecond > 12 && rawFirst <= 12) {
        const year = rawThird.toString().length === 2 ? normalizeTwoDigitYear(rawThird) : rawThird;
        return isValidDate(year, rawFirst, rawSecond);
      }

      // ambiguous separator format; prefer dd/mm/yyyy style
      const ambiguousYear = rawThird.toString().length === 2 ? normalizeTwoDigitYear(rawThird) : rawThird;
      const asDmy = isValidDate(ambiguousYear, rawSecond, rawFirst);
      if (asDmy) {
        return asDmy;
      }

      const asMdy = isValidDate(ambiguousYear, rawFirst, rawSecond);
      if (asMdy) {
        return asMdy;
      }
    }
  }

  const compactDigitsRegex = /^\d{8}$/u;
  const compactMatch = compactDigitsRegex.exec(compactDigits);
  if (compactMatch) {
    const valueOnlyDigits = compactMatch[0];
    const first4 = Number(valueOnlyDigits.slice(0, 4));

    const candidateYmd = isValidDate(first4, Number(valueOnlyDigits.slice(4, 6)), Number(valueOnlyDigits.slice(6, 8)));
    if (candidateYmd && first4 >= 1000) {
      return candidateYmd;
    }

    const dmyDate = isValidDate(
      Number(valueOnlyDigits.slice(4, 8)),
      Number(valueOnlyDigits.slice(2, 4)),
      Number(valueOnlyDigits.slice(0, 2)),
    );
    if (dmyDate) {
      return dmyDate;
    }

    const mdyDate = isValidDate(
      Number(valueOnlyDigits.slice(4, 8)),
      Number(valueOnlyDigits.slice(0, 2)),
      Number(valueOnlyDigits.slice(2, 4)),
    );
    if (mdyDate) {
      return mdyDate;
    }
  }

  return null;
};

const formatBirthday = (value: string | null) => {
  if (!value?.trim()) {
    return "";
  }

  const birthday = parseBirthdayDate(value);

  if (!birthday) {
    return value.trim();
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(birthday);
};

const getInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const IconStar = ({ filled }: { filled: boolean }) => (
  <span aria-hidden="true" className="text-sm leading-none">
    {filled ? "★" : "☆"}
  </span>
);

const IconEdit = () => (
  <span aria-hidden="true" className="text-sm leading-none">
    ✎
  </span>
);

const IconPerson = () => (
  <span aria-hidden="true" className="text-sm leading-none">
    👤
  </span>
);

const IconBuilding = () => (
  <span aria-hidden="true" className="text-sm leading-none">
    🏢
  </span>
);

const IconMore = () => (
  <span aria-hidden="true" className="text-lg leading-none">
    ⋯
  </span>
);

const getDisplayName = (contact: WorkspaceContact) => {
  const fullName = contact.fullName?.trim() ?? "";
  const company = contact.company?.trim() ?? "";
  return fullName || company || "Unnamed contact";
};

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

  const openPrintContact = (contactId: string) => {
    const printWindow = window.open(`/contacts/${contactId}?print=1`, "_blank", "noopener,noreferrer");

    if (!printWindow) {
      window.location.assign(`/contacts/${contactId}?print=1`);
      return;
    }

    printWindow.addEventListener("load", () => {
      printWindow.print();
    });
  };

  const getSingleContactExportUrl = (contact: WorkspaceContact) => {
    const query = [
      contact.fullName,
      contact.email,
      contact.phone,
      contact.company,
      contact.jobTitle,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const params = query.length > 0 ? `?q=${encodeURIComponent(query)}` : "";
    return `/api/exports/contacts/csv${params}`;
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
        <span>Birthday</span>
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
        const hasName = (contact.fullName?.trim().length ?? 0) > 0;
        const hasCompany = (contact.company?.trim().length ?? 0) > 0;
        const displayName = getDisplayName(contact);

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
                      {hasName ? (
                        getInitials(contact.fullName)
                      ) : hasCompany ? (
                        <IconBuilding />
                      ) : (
                        <IconPerson />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="truncate text-[15px] font-semibold text-slate-900 hover:text-[#3248db]"
                          href={`/contacts/${contact.id}`}
                        >
                          {displayName}
                        </Link>
                        {contact.isFavorite ? (
                          <span
                            aria-label="Favorite contact"
                            className="text-[13px] text-amber-500"
                            title="Favorite contact"
                          >
                            ★
                          </span>
                        ) : null}
                        {contact.archivedAt ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                            Archived
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden text-sm text-slate-700 lg:block">
                  <p className="truncate font-medium text-[#3341c7]">
                    {contact.email ?? ""}
                  </p>
                </div>

                <div className="hidden text-sm text-slate-700 lg:block">
                  <p className="font-medium">{contact.phone ?? ""}</p>
                </div>

                <div className="hidden text-sm text-slate-700 lg:block">
                  <p className="truncate font-medium">{contact.company?.trim() ?? ""}</p>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">
                    {contact.jobTitle?.trim() ?? ""}
                  </p>
                </div>

                <div className="hidden text-sm text-slate-500 lg:block">
                  {formatBirthday(contact.birthday)}
                </div>

                <div className="hidden items-center justify-end gap-2 lg:flex">
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
                        : "pointer-events-none border-transparent text-transparent opacity-0"
                    }`}
                    href={`/contacts/${contact.id}`}
                    tabIndex={showDesktopActions ? 0 : -1}
                    aria-label="Edit contact"
                  >
                    <span className="sr-only">Edit contact</span>
                    <IconEdit />
                  </Link>
                  <details
                    className="relative"
                    suppressHydrationWarning
                  >
                    <summary
                      className={`list-none cursor-pointer rounded-full w-9 h-9 p-0 flex items-center justify-center border text-xs font-semibold transition ${
                        showDesktopActions
                          ? "border-[#d8ddd6] text-slate-700 opacity-100 hover:border-[#c9d0c9] hover:bg-slate-50"
                          : "pointer-events-none border-transparent text-transparent opacity-0"
                      }`}
                      role="button"
                      aria-label="More actions"
                      tabIndex={showDesktopActions ? 0 : -1}
                    >
                      <span className="sr-only">More actions</span>
                      <IconMore />
                    </summary>
                    <div
                      className={`absolute right-0 top-full z-20 mt-2 min-w-[160px] overflow-hidden rounded-xl border border-[#d8ddd6] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.15)] ${
                        showDesktopActions ? "opacity-100" : "pointer-events-none opacity-0"
                      }`}
                    >
                      <button
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => openPrintContact(contact.id)}
                        type="button"
                      >
                        中 Print C
                      </button>
                      <a
                        className="block px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        href={getSingleContactExportUrl(contact)}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        I Export
                      </a>
                      {contact.archivedAt ? (
                        <form action={restoreContact}>
                          <input name="contactId" type="hidden" value={contact.id} />
                          <input name="redirectTo" type="hidden" value="/?tab=archived" />
                          <button
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
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
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            type="submit"
                          >
                            Hide from contacts
                          </button>
                        </form>
                      )}
                      <form action={permanentlyDeleteContact}>
                        <input name="contactId" type="hidden" value={contact.id} />
                        <input name="redirectTo" type="hidden" value="/?tab=people" />
                        <button
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          type="submit"
                        >
                          回 Delete
                        </button>
                      </form>
                      <Link
                        className="block px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        href={`/contacts/${contact.id}`}
                      >
                        Change labels
                      </Link>
                    </div>
                  </details>
                </div>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
