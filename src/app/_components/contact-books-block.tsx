"use client";

// P40-08: contact-detail "Books" block (design brief P40-DB01 §3). Shows the
// personal books a contact lives in as chips, lets the user add/remove books and
// set the home (primary) book. Removing the last book is blocked (decision #1).

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addContactToBook,
  removeContactFromBook,
  setContactPrimaryBook,
} from "~/app/actions/contact-books";

export type BooksBlockMembership = {
  bookId: string;
  name: string;
  isPrimary: boolean;
};

export type BooksBlockBook = { id: string; name: string };

const HomeIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4158f4" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export function ContactBooksBlock({
  contactId,
  memberships,
  books,
}: {
  contactId: string;
  memberships: BooksBlockMembership[];
  books: BooksBlockBook[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chipMenu, setChipMenu] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen && !chipMenu) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setChipMenu(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen, chipMenu]);

  const isLast = memberships.length <= 1;
  const joinedIds = new Set(memberships.map((m) => m.bookId));
  const addable = books.filter((b) => !joinedIds.has(b.id));

  const run = (fn: () => Promise<void>) => {
    setError(null);
    setMenuOpen(false);
    setChipMenu(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };

  return (
    <div ref={wrapRef}>
      <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">Books</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="contact-books-block">
        {memberships.map((m) => {
          const open = chipMenu === m.bookId;
          return (
            <div key={m.bookId} className="relative inline-flex">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef1ec] py-1 pl-2 pr-1 text-[12px] font-semibold text-[#1d2823]">
                <span aria-hidden className="text-[9px] text-[#8b938c]">●</span>
                {m.isPrimary ? (
                  <span className="text-[#17352e]" title="Home book"><HomeIcon /></span>
                ) : null}
                <button
                  type="button"
                  className="max-w-[140px] truncate outline-none"
                  onClick={() => setChipMenu(open ? null : m.bookId)}
                  disabled={pending}
                  title="Book options"
                >
                  {m.name}
                </button>
                <button
                  type="button"
                  aria-label={isLast ? "A contact must stay in at least one book" : `Remove from ${m.name}`}
                  title={isLast ? "A contact must stay in at least one book. Delete the contact to remove it entirely." : `Remove from ${m.name}`}
                  className="grid h-5 w-5 place-items-center rounded-full text-[#8b938c] transition hover:bg-[#e0e5dd] hover:text-[#1d2823] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  disabled={isLast || pending}
                  onClick={() =>
                    run(() => removeContactFromBook({ contactId, bookId: m.bookId }))
                  }
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </span>
              {open && !m.isPrimary ? (
                <div className="absolute left-0 top-[calc(100%+4px)] z-20 min-w-[150px] rounded-[10px] border border-[#d8ddd6] bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[12.5px] text-[#1d2823] transition hover:bg-[#f2f4f0]"
                    onClick={() =>
                      run(() => setContactPrimaryBook({ contactId, bookId: m.bookId }))
                    }
                  >
                    <span className="text-[#17352e]"><HomeIcon /></span> Make home book
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {addable.length > 0 ? (
          <div className="relative inline-flex">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#c5ccc2] px-2.5 py-1 text-[12px] font-semibold text-[#4158f4] transition hover:bg-[#f4f6ff] disabled:opacity-50"
              onClick={() => setMenuOpen((v) => !v)}
              disabled={pending}
            >
              <PlusIcon /> Add to book
            </button>
            {menuOpen ? (
              <div className="absolute left-0 top-[calc(100%+4px)] z-20 min-w-[160px] rounded-[10px] border border-[#d8ddd6] bg-white p-1 shadow-lg">
                {addable.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[12.5px] text-[#1d2823] transition hover:bg-[#f2f4f0]"
                    onClick={() => run(() => addContactToBook({ contactId, bookId: b.id }))}
                  >
                    <span aria-hidden className="text-[9px] text-[#8b938c]">●</span>
                    <span className="truncate">{b.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-1.5 text-[11.5px] text-[#b5472f]">{error}</p> : null}
    </div>
  );
}
