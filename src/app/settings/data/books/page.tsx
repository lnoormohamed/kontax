import Link from "next/link";

import { SettingsCard, SettingsPageHead, SectionLabel } from "~/app/_components/settings-ui";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import {
  archiveAddressBook,
  createAddressBookFromForm,
  renameAddressBook,
  setDefaultAddressBook,
} from "~/app/actions/address-books";
import { redirectToLogin } from "~/server/auth/require-page-auth";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getUserFamilyMembership } from "~/server/family-access";
import {
  getAccessibleTeamBooks,
  getUserTeamMembership,
  resolveBookPermission,
} from "~/server/team-access";

export const metadata = { title: "Books" };

const roleTone = (role: "Owner" | "Editor" | "Viewer") =>
  role === "Owner"
    ? "bg-[#e7efe9] text-[#17352e]"
    : role === "Editor"
      ? "bg-[#edf0fe] text-[#3142c4]"
      : "bg-[#f2f4f0] text-[#5c655e]";


export default async function BooksSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return redirectToLogin("/settings/data/books");
  const userId = session.user.id;

  const [
    personalBooks,
    personalBookCounts,
    familyMembership,
    teamMembership,
    familyGroup,
    teamBooks,
    teamSyncCounts,
  ] = await Promise.all([
    db.addressBook.findMany({
      where: { userId },
      orderBy: [{ archivedAt: "asc" }, { isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isDefault: true,
        deviceWritable: true,
        archivedAt: true,
      },
    }),
    // P40-06: per-book counts from membership (matches the membership-based list).
    db.contactBookMembership.groupBy({
      by: ["addressBookId"],
      where: {
        addressBook: { userId },
        contact: { groupContacts: { none: {} } },
      },
      _count: { _all: true },
    }),
    getUserFamilyMembership(userId),
    getUserTeamMembership(userId),
    db.group.findFirst({
      where: {
        type: "FAMILY",
        members: { some: { userId, inviteStatus: "ACCEPTED" } },
      },
      select: {
        id: true,
        name: true,
        defaultAddressBookId: true,
      },
    }),
    db.groupAddressBook.findMany({
      where: {
        group: {
          type: "TEAM",
          members: { some: { userId, inviteStatus: "ACCEPTED" } },
        },
      },
      orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        archivedAt: true,
        groupId: true,
        group: { select: { name: true } },
        _count: { select: { contacts: true, teamSyncAccounts: true } },
      },
    }),
    db.teamSyncAccount.groupBy({
      by: ["addressBookId"],
      where: {
        group: {
          members: { some: { userId, inviteStatus: "ACCEPTED" } },
        },
      },
      _count: { _all: true },
    }),
  ]);

  const personalBooksWithCounts = personalBooks.map((book) => ({
    ...book,
    count: personalBookCounts.find((row) => row.addressBookId === book.id)?._count._all ?? 0,
  }));

  const accessibleTeamBookIds = new Set((await getAccessibleTeamBooks(userId)).map((book) => book.id));
  const syncCountByBookId = new Map(
    teamSyncCounts.map((row) => [row.addressBookId, row._count._all]),
  );
  const visibleTeamBooks = teamBooks
    .filter((book) => accessibleTeamBookIds.has(book.id))
    .map((book) => {
      const permission = teamMembership ? resolveBookPermission(teamMembership, book.id) : "VIEW";
      const role: "Owner" | "Editor" | "Viewer" =
        teamMembership?.isManager ? "Owner" : permission === "EDIT" ? "Editor" : "Viewer";
      return {
        ...book,
        role,
        linkedSyncs: syncCountByBookId.get(book.id) ?? book._count.teamSyncAccounts,
      };
    });


  return (
    <>
      <SettingsPageHead
        title="Books"
        sub="Organise contacts into personal and shared books, choose where new contacts land by default, and see who can edit shared books."
      />

      <div className="grid gap-[18px]">
        <SettingsCard className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
          <div>
            <p className="text-[14.5px] font-semibold text-[#1d2823]">How books work</p>
            <div className="mt-2 grid gap-2 text-[13.5px] text-[#5c655e]">
              <p>New private contacts save into your default book.</p>
              <p>Use bulk edit in Contacts to move contacts between your personal books.</p>
              <p>Family and team books stay separate from your private library, but they still appear in Contacts and sync surfaces where relevant.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[#e9ece7] bg-[#f6f7f4] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8b938c]">
              Current default
            </p>
            <p className="mt-2 text-[16px] font-semibold text-[#1d2823]">
              {personalBooksWithCounts.find((book) => book.isDefault)?.name ?? "All Contacts"}
            </p>
            <p className="mt-1 text-[13px] text-[#5c655e]">
              Legacy unassigned contacts stay attached to the old default when you switch, so your book structure remains stable.
            </p>
          </div>
        </SettingsCard>

        <div>
          <SectionLabel>Personal books</SectionLabel>
          <SettingsCard>
            <div className="grid gap-3">
              {personalBooksWithCounts.map((book) => (
                <div
                  className="rounded-2xl border border-[#e9ece7] bg-[#fbfcf9] p-4"
                  key={book.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold text-[#1d2823]">{book.name}</p>
                        {book.isDefault ? (
                          <span className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#17352e]">
                            Default
                          </span>
                        ) : null}
                        {book.archivedAt ? (
                          <span className="rounded-full bg-[#f2f4f0] px-2 py-0.5 text-[11px] font-semibold text-[#5c655e]">
                            Archived
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12.5px] text-[#8b938c]">
                        Slug: {book.slug} · {book.count.toLocaleString()} contact{book.count === 1 ? "" : "s"} ·{" "}
                        {book.deviceWritable ? "Device writable" : "Read-only to devices"}
                      </p>
                      {book.description ? (
                        <p className="mt-1 text-[13px] text-[#5c655e]">{book.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!book.isDefault && !book.archivedAt ? (
                        <form action={setDefaultAddressBook.bind(null, book.id)}>
                          <button
                            className="rounded-xl border border-[#d8ddd6] bg-white px-3 py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
                            type="submit"
                          >
                            Make default
                          </button>
                        </form>
                      ) : null}
                      {!book.isDefault ? (
                        <form action={archiveAddressBook.bind(null, book.id)}>
                          <button
                            className="rounded-xl border border-[#d8ddd6] bg-white px-3 py-2 text-[13px] font-semibold text-[#5c655e] transition hover:bg-[#f6f7f4]"
                            type="submit"
                          >
                            {book.archivedAt ? "Restore" : "Archive"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>

                  {!book.isDefault ? (
                    <form action={renameAddressBook} className="mt-3 flex flex-wrap items-center gap-2">
                      <input name="id" type="hidden" value={book.id} />
                      <input
                        className="min-w-[220px] flex-1 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[14px] outline-none transition focus:border-[#4158f4] focus:shadow-[0_0_0_3px_#edf0fe]"
                        defaultValue={book.name}
                        name="name"
                        required
                      />
                      <button
                        className="rounded-xl bg-[#17352e] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#20443b]"
                        type="submit"
                      >
                        Save name
                      </button>
                    </form>
                  ) : (
                    <p className="mt-3 text-[12.5px] text-[#8b938c]">
                      The default book keeps its stable name and slug so existing DAV clients and old unassigned contacts do not move unexpectedly.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <form action={createAddressBookFromForm} className="mt-4 flex flex-wrap items-center gap-2">
              <input
                className="min-w-[220px] flex-1 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[14px] outline-none transition focus:border-[#4158f4] focus:shadow-[0_0_0_3px_#edf0fe]"
                name="name"
                placeholder="New personal book"
                required
              />
              <button
                className="rounded-xl bg-[#4158f4] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#3248db]"
                type="submit"
              >
                Create book
              </button>
            </form>
          </SettingsCard>
        </div>

        <div>
          <SectionLabel>Shared books</SectionLabel>
          <SettingsCard>
            <div className="grid gap-3">
              {familyMembership && familyGroup ? (
                <div className="rounded-2xl border border-[#e9ece7] bg-[#fbfcf9] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <WorkspaceIcon className="text-[#17352e]" name="users" size={16} />
                        <p className="text-[15px] font-semibold text-[#1d2823]">{familyGroup.name}</p>
                      </div>
                      <p className="mt-1 text-[13px] text-[#5c655e]">
                        Family book · role shown from your accepted membership
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleTone(
                      familyMembership.isOwner ? "Owner" : familyMembership.canEdit ? "Editor" : "Viewer",
                    )}`}>
                      {familyMembership.isOwner ? "Owner" : familyMembership.canEdit ? "Editor" : "Viewer"}
                    </span>
                  </div>
                  <p className="mt-3 text-[12.5px] text-[#8b938c]">
                    Changes to family editing access are managed under{" "}
                    <Link className="font-semibold text-[#4158f4]" href="/settings/family">
                      Family management
                    </Link>
                    .
                  </p>
                </div>
              ) : null}

              {visibleTeamBooks.map((book) => (
                <div className="rounded-2xl border border-[#e9ece7] bg-[#fbfcf9] p-4" key={book.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <WorkspaceIcon className="text-[#17352e]" name="team" size={16} />
                        <p className="text-[15px] font-semibold text-[#1d2823]">{book.name}</p>
                        {book.archivedAt ? (
                          <span className="rounded-full bg-[#f2f4f0] px-2 py-0.5 text-[11px] font-semibold text-[#5c655e]">
                            Archived
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] text-[#5c655e]">
                        {book.group.name} · {book._count.contacts.toLocaleString()} contact
                        {book._count.contacts === 1 ? "" : "s"} · {book.linkedSyncs} linked sync
                        {book.linkedSyncs === 1 ? "" : "s"}
                      </p>
                      {book.description ? (
                        <p className="mt-1 text-[12.5px] text-[#8b938c]">{book.description}</p>
                      ) : null}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleTone(book.role)}`}>
                      {book.role}
                    </span>
                  </div>
                </div>
              ))}

              {!familyMembership && visibleTeamBooks.length === 0 ? (
                <p className="text-[13.5px] text-[#8b938c]">
                  You do not currently belong to any shared books.
                </p>
              ) : null}
            </div>
          </SettingsCard>
        </div>

        {/* P46-15 / DB07: the hub is an INDEX pointing to owners — the inline
            permission-audit list duplicated the Teams audit log and could
            drift; it's a pointer now. */}
        {teamMembership ? (
          <div>
            <SectionLabel>Permission history</SectionLabel>
            <SettingsCard className="flex flex-wrap items-center justify-between gap-4">
              <p className="min-w-0 text-[13.5px] leading-relaxed text-[#5c655e]">
                Shared-book permission changes live in the team audit log,
                alongside every other team event.
              </p>
              <Link
                className="shrink-0 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                href="/settings/teams/audit"
              >
                Open team audit log
              </Link>
            </SettingsCard>
          </div>
        ) : null}
      </div>
    </>
  );
}
