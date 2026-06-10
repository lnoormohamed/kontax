import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { ContactHistory } from "~/app/_components/contact-history";
import { ContactInlineEditor } from "~/app/_components/contact-inline-editor";
import { CopyField } from "~/app/_components/copy-field";
import {
  createLiveShare,
  createStaticShare,
  createVcardShareLink,
  revokeShare,
  unlinkLiveShare,
} from "~/app/actions/shares";
import { LastUpdatedBy } from "~/app/_components/last-updated-by";
import { SourceBadge } from "~/app/_components/source-badge";
import {
  archiveContact,
  permanentlyDeleteContact,
  restoreContact,
  toggleFavoriteContact,
} from "~/app/actions/contacts";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";

type ContactDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const formatTimestamp = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);

const formatNullableTimestamp = (value: Date | null) => (value ? formatTimestamp(value) : "Not yet");

const formatStoredDateValue = (value: string | null | undefined) => {
  if (!value) {
    return "Not added yet";
  }
  const exactDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!exactDateMatch) {
    return value;
  }
  const [, year, month, day] = exactDateMatch;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
};

const getSyncLinkStatusLabel = (link: {
  lastSyncedAt: Date | null;
  tombstonedAt: Date | null;
  remoteDeletedAt: Date | null;
  lastErrorCode: string | null;
}) => {
  if (link.tombstonedAt) {
    return "Local tombstone";
  }
  if (link.remoteDeletedAt) {
    return "Remote delete detected";
  }
  if (link.lastErrorCode) {
    return "Needs review";
  }
  if (link.lastSyncedAt) {
    return "Linked and healthy";
  }
  return "Linked, waiting for first sync";
};

const getInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const sectionCardClassName =
  "rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm sm:p-6";

export default async function ContactDetailPage({ params, searchParams }: ContactDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const savedParam = resolvedSearchParams?.saved;
  const saveState = Array.isArray(savedParam) ? savedParam[0] : savedParam;
  const wasSaved = saveState === "1";
  const mergedParam = resolvedSearchParams?.merged;
  const mergedState = Array.isArray(mergedParam) ? mergedParam[0] : mergedParam;
  const wasMerged = mergedState === "1";
  const mergeUndoneParam = resolvedSearchParams?.mergeUndone;
  const mergeUndoneState = Array.isArray(mergeUndoneParam)
    ? mergeUndoneParam[0]
    : mergeUndoneParam;
  const wasMergeUndone = mergeUndoneState === "1";
  const tabParam = resolvedSearchParams?.tab;
  const tabValue = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const detailTab: "details" | "sharing" | "history" =
    tabValue === "sharing" || tabValue === "history" ? tabValue : "details";

  const contact = await db.contact.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phoneticFirstName: true,
      phoneticLastName: true,
      namePrefix: true,
      nameSuffix: true,
      nickname: true,
      email: true,
      emailAddresses: true,
      emailEntries: true,
      phone: true,
      phoneNumbers: true,
      phoneEntries: true,
      company: true,
      phoneticCompany: true,
      jobTitle: true,
      website: true,
      websiteEntries: true,
      birthday: true,
      address: true,
      postalAddresses: true,
      addressEntries: true,
      avatarUrl: true,
      isFavorite: true,
      labels: true,
      significantDates: true,
      relatedPeople: true,
      customFields: true,
      notes: true,
      sourceType: true,
      sourceDetail: true,
      lastMutatedBy: true,
      lastMutatedByDetail: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!contact) {
    notFound();
  }

  const [shellPlan, shellPeople, shellFavorites, shellArchived, shellDuplicates] = await Promise.all(
    [
      getUserPlanSummary(session.user.id),
      db.contact.count({ where: { userId: session.user.id, archivedAt: null } }),
      db.contact.count({ where: { userId: session.user.id, archivedAt: null, isFavorite: true } }),
      db.contact.count({ where: { userId: session.user.id, NOT: { archivedAt: null } } }),
      db.mergeSuggestion.count({ where: { userId: session.user.id, status: "OPEN" } }),
    ],
  );
  const shellAccount = {
    name: session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax",
    email: session.user.email ?? "",
    plan: shellPlan.planLabel,
  };
  const shellCounts = {
    people: shellPeople,
    favorites: shellFavorites,
    archived: shellArchived,
    duplicates: shellDuplicates,
  };

  // Sharing (Phase 12): owner-side shares for this contact + the public origin.
  const headerList = await headers();
  const shareHost = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const shareProto =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (shareHost.startsWith("localhost") ? "http" : "https");
  const shareOrigin = `${shareProto}://${shareHost}`;
  const contactShares = await db.contactShare.findMany({
    where: { contactId: contact.id, ownerUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shareType: true,
      token: true,
      status: true,
      expiresAt: true,
      downloadCount: true,
      recipientEmail: true,
      recipientContactId: true,
      lastPushedAt: true,
      lastErrorCode: true,
    },
  });
  const vcardLinks = contactShares.filter(
    (share) => share.shareType === "VCARD_LINK" && share.status === "ACTIVE",
  );
  const staticShares = contactShares.filter((share) => share.shareType === "STATIC_COPY");
  const liveShares = contactShares.filter((share) => share.shareType === "LIVE_SYNC");
  const staticShareEnabled = shellPlan.entitlements.staticShareEnabled;
  const liveShareEnabled = shellPlan.entitlements.liveShareEnabled;
  // This contact is a live copy the current user received (recipient side).
  const isLiveReceived = contact.sourceType === "SHARED_LIVE";

  const syncLinks = await db.syncContactLink.findMany({
    where: {
      contactId: contact.id,
      syncAccount: {
        userId: session.user.id,
      },
    },
    orderBy: [{ lastSyncedAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      remoteUid: true,
      remoteHref: true,
      remoteETag: true,
      lastSyncedAt: true,
      tombstonedAt: true,
      remoteDeletedAt: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      syncAccount: {
        select: {
          id: true,
          label: true,
          addressBookDisplayName: true,
          status: true,
          lastSyncedAt: true,
        },
      },
      _count: {
        select: {
          syncConflicts: true,
        },
      },
    },
  });


  return (
    <AppShell account={shellAccount} counts={shellCounts}>
      <div className="bg-white text-[#1d2823]">
        {/* slim sticky sub-header (back · name · Share/Archive/Favorite/⋯) */}
        <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#d8ddd6] bg-white/95 px-4 backdrop-blur lg:px-6">
          <Link className="text-sm font-semibold text-[#5c655e] transition hover:text-[#1d2823]" href="/">
            ← Contacts
          </Link>
          <span className="flex-1 truncate text-center text-[15px] font-semibold text-[#1d2823]">
            {contact.fullName}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              className="rounded-[0.8rem] border border-[#d8ddd6] bg-white px-3.5 py-1.5 text-sm font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
              href={`/contacts/${contact.id}?tab=sharing`}
            >
              Share
            </Link>
            <form action={contact.archivedAt ? restoreContact : archiveContact}>
              <input name="contactId" type="hidden" value={contact.id} />
              <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
              <button
                className="rounded-[0.8rem] border border-[#d8ddd6] bg-white px-3.5 py-1.5 text-sm font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                type="submit"
              >
                {contact.archivedAt ? "Restore" : "Archive"}
              </button>
            </form>
            <details className="relative">
              <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-[0.8rem] border border-[#d8ddd6] bg-white text-[#5c655e] transition hover:bg-[#f2f4f0]">
                ⋯
              </summary>
              <div className="absolute right-0 z-10 mt-1 w-56 rounded-[1rem] border border-[#d8ddd6] bg-white p-1.5 shadow-lg">
                <form action={permanentlyDeleteContact}>
                  <input name="contactId" type="hidden" value={contact.id} />
                  <input name="redirectTo" type="hidden" value="/" />
                  <button
                    className="w-full rounded-[0.7rem] px-3 py-2 text-left text-sm font-semibold text-[#b5472f] transition hover:bg-[#fbeae6]"
                    type="submit"
                  >
                    Delete permanently
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>

        <div className="flex">
          {/* left rail (sticky) */}
          <aside
            className="hidden w-[320px] shrink-0 self-start border-r border-[#d8ddd6] bg-white p-6 lg:block"
            style={{ position: "sticky", top: 56 }}
          >
            <div className="relative inline-flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#e7efe9] text-3xl font-semibold text-[#17352e]">
              {getInitials(contact.fullName)}
              {contact.isFavorite ? (
                <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full bg-white text-[15px] text-[#e0a31c] shadow">
                  ★
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 text-[21px] font-semibold leading-tight tracking-[-0.01em] text-[#1d2823]">
              {contact.fullName}
            </h1>
            {contact.company || contact.jobTitle ? (
              <p className="mt-1 text-[13.5px] text-[#5c655e]">
                {[contact.jobTitle, contact.company].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {contact.birthday ? (
              <p className="mt-1 text-[13px] text-[#8b938c]">🎂 {formatStoredDateValue(contact.birthday)}</p>
            ) : null}

            <div className="mt-3.5 flex flex-wrap gap-2">
              <SourceBadge sourceType={contact.sourceType} sourceDetail={contact.sourceDetail} />
              {contact.archivedAt ? (
                <span className="rounded-full bg-[#f6edd9] px-2.5 py-1 text-[11px] font-semibold text-[#7a5a1a]">
                  Archived
                </span>
              ) : null}
            </div>

            <div className="my-5 h-px bg-[#edf0ea]" />

            {/* quick actions */}
            <div className="flex flex-wrap items-center gap-2">
              {contact.phone ? (
                <a
                  className="rounded-[0.7rem] border border-[#d8ddd6] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                  href={`tel:${contact.phone}`}
                >
                  Call
                </a>
              ) : null}
              {contact.email ? (
                <a
                  className="rounded-[0.7rem] border border-[#d8ddd6] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                  href={`mailto:${contact.email}`}
                >
                  Email
                </a>
              ) : null}
              <form action={toggleFavoriteContact}>
                <input name="contactId" type="hidden" value={contact.id} />
                <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                <button
                  className="rounded-[0.7rem] border border-[#d8ddd6] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#e0a31c] transition hover:bg-[#f2f4f0]"
                  type="submit"
                >
                  {contact.isFavorite ? "★ Favorited" : "☆ Favorite"}
                </button>
              </form>
            </div>

            <div className="my-5 h-px bg-[#edf0ea] " />

            {/* metadata */}
            <dl className="grid gap-2 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b938c]">Added</dt>
                <dd className="text-right text-[#5c655e]">{formatTimestamp(contact.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b938c]">Modified</dt>
                <dd className="text-right text-[#5c655e]">{formatTimestamp(contact.updatedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b938c]">UID</dt>
                <dd className="text-right font-mono text-[#5c655e]">{contact.id.slice(0, 8)}…</dd>
              </div>
              <div className="text-[#5c655e]">
                <LastUpdatedBy
                  lastMutatedBy={contact.lastMutatedBy}
                  lastMutatedByDetail={contact.lastMutatedByDetail}
                  updatedAt={contact.updatedAt.toISOString()}
                />
              </div>
            </dl>
          </aside>

          {/* right pane */}
          <main className="min-w-0 flex-1 px-4 py-5 lg:px-8 lg:py-6">
            <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5">

        {wasSaved ? (
          <div className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">
            Contact changes saved successfully.
          </div>
        ) : null}
        {wasMerged ? (
          <div className="rounded-[1.6rem] border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-700 shadow-sm">
            Merge completed successfully. You can still undo the latest merge from the action rail
            while this contact remains in the reversible merge model.
          </div>
        ) : null}
        {wasMergeUndone ? (
          <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow-sm">
            Merge undo completed. The archived secondary contact has been restored and the primary
            contact has been rolled back to its pre-merge state.
          </div>
        ) : null}

        {/* Details · Sharing · History tabs (P17-02) */}
        <div className="flex items-center gap-1 border-b border-[#d8ddd6]">
          {[
            ["details", "Details"],
            ["sharing", "Sharing"],
            ["history", "History"],
          ].map(([key, label]) => (
            <Link
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                detailTab === key
                  ? "border-[#17352e] text-[#1d2823]"
                  : "border-transparent text-[#8b938c] hover:text-[#5c655e]"
              }`}
              href={`/contacts/${contact.id}?tab=${key}`}
              key={key}
            >
              {label}
            </Link>
          ))}
        </div>

        {detailTab === "details" ? (
          <div className="grid gap-4">
            <ContactInlineEditor
              contact={{
                id: contact.id,
                fullName: contact.fullName,
                firstName: contact.firstName,
                middleName: contact.middleName,
                lastName: contact.lastName,
                namePrefix: contact.namePrefix,
                nameSuffix: contact.nameSuffix,
                nickname: contact.nickname,
                phoneticFirstName: contact.phoneticFirstName,
                phoneticLastName: contact.phoneticLastName,
                phoneticCompany: contact.phoneticCompany,
                company: contact.company,
                jobTitle: contact.jobTitle,
                email: contact.email,
                phone: contact.phone,
                website: contact.website,
                birthday: contact.birthday,
                address: contact.address,
                notes: contact.notes,
              }}
              editableShared={!isLiveReceived}
            />

            <section className="rounded-[1.2rem] border border-[#d8ddd6] bg-white p-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b938c]">
                Sync
              </h3>
              {syncLinks.length === 0 ? (
                <p className="text-[13px] text-[#8b938c]">
                  Not linked to any CardDAV account yet. Connect an account to keep this contact in
                  sync.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {syncLinks.map((link) => (
                    <li
                      className="flex items-center justify-between gap-3 border-b border-[#edf0ea] pb-2 text-[13px] last:border-b-0"
                      key={link.id}
                    >
                      <span className="text-[#1d2823]">
                        {link.syncAccount.label ??
                          link.syncAccount.addressBookDisplayName ??
                          "CardDAV account"}
                      </span>
                      <span className="text-[#8b938c]">
                        {getSyncLinkStatusLabel(link)} · {formatNullableTimestamp(link.lastSyncedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {detailTab === "sharing" ? (
          <section className={sectionCardClassName} id="contact-sharing">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Sharing</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Share this contact</h2>

            {/* vCard share link (all plans) */}
            <div className="mt-5 rounded-[1.4rem] border border-[#d8ddd6] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#1d2823]">vCard link</p>
                  <p className="mt-0.5 text-[13px] text-[#5c655e]">
                    Anyone with the link can download this contact as a .vcf file.
                    {shellPlan.plan === "FREE" ? " Free links expire after 7 days." : ""}
                  </p>
                </div>
                <form action={createVcardShareLink}>
                  <input name="contactId" type="hidden" value={contact.id} />
                  <button
                    className="rounded-[0.8rem] bg-[#17352e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#20443b]"
                    type="submit"
                  >
                    Create share link
                  </button>
                </form>
              </div>

              {vcardLinks.length > 0 ? (
                <div className="mt-4 grid gap-3">
                  {vcardLinks.map((link) => (
                    <div key={link.id}>
                      <CopyField
                        helper={`${link.downloadCount} download${link.downloadCount === 1 ? "" : "s"}${
                          link.expiresAt
                            ? ` · expires ${formatTimestamp(link.expiresAt)}`
                            : " · no expiry"
                        }`}
                        label="Share link"
                        value={`${shareOrigin}/share/${link.token}`}
                      />
                      <form action={revokeShare}>
                        <input name="shareId" type="hidden" value={link.id} />
                        <input name="contactId" type="hidden" value={contact.id} />
                        <button
                          className="mt-1.5 text-[13px] font-semibold text-[#b5472f]"
                          type="submit"
                        >
                          Revoke link
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* static Kontax-to-Kontax share (Pro and above) */}
            <div className="mt-4 rounded-[1.4rem] border border-[#d8ddd6] bg-white p-5">
              <p className="text-sm font-semibold text-[#1d2823]">Share with a Kontax user</p>
              <p className="mt-0.5 text-[13px] text-[#5c655e]">
                Send a one-time copy to another Kontax account. Their copy is independent of yours.
              </p>
              {staticShareEnabled ? (
                <form action={createStaticShare} className="mt-3 flex flex-wrap items-center gap-2">
                  <input name="contactId" type="hidden" value={contact.id} />
                  <input
                    className="min-w-[220px] flex-1 rounded-[0.7rem] border border-[#d8ddd6] bg-white px-3 py-2 text-sm text-[#1d2823] outline-none focus:border-[#4158f4]"
                    name="recipientEmail"
                    placeholder="name@email.com"
                    required
                    type="email"
                  />
                  <button
                    className="rounded-[0.8rem] bg-[#4158f4] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3248db]"
                    type="submit"
                  >
                    Send copy
                  </button>
                </form>
              ) : (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-[0.9rem] bg-[#f6edd9] px-4 py-3 text-[13px] text-[#7a5a1a]">
                  <span>Sharing with another Kontax user is a Pro feature.</span>
                  <Link className="shrink-0 font-semibold underline" href="/pricing">
                    Upgrade
                  </Link>
                </div>
              )}

              {staticShares.length > 0 ? (
                <ul className="mt-4 grid gap-2">
                  {staticShares.map((share) => (
                    <li
                      className="flex items-center justify-between gap-3 border-b border-[#edf0ea] pb-2 text-[13px] last:border-b-0"
                      key={share.id}
                    >
                      <span className="min-w-0 truncate text-[#1d2823]">{share.recipientEmail}</span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-[#8b938c]">
                          {share.status === "DECLINED"
                            ? "Declined"
                            : share.status === "REVOKED"
                              ? "Revoked"
                              : share.recipientContactId
                                ? "Accepted"
                                : "Pending"}
                        </span>
                        {share.status === "ACTIVE" && !share.recipientContactId ? (
                          <form action={revokeShare}>
                            <input name="shareId" type="hidden" value={share.id} />
                            <input name="contactId" type="hidden" value={contact.id} />
                            <button className="font-semibold text-[#b5472f]" type="submit">
                              Revoke
                            </button>
                          </form>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* live Kontax-to-Kontax share (Pro and above, both parties) */}
            {isLiveReceived ? (
              <div className="mt-4 rounded-[1.4rem] border border-[#cfe0d2] bg-[#eef5ef] p-5">
                <p className="text-sm font-semibold text-[#17352e]">
                  Live from {contact.sourceDetail ?? "another Kontax user"}
                </p>
                <p className="mt-0.5 text-[13px] text-[#3f5a50]">
                  This contact stays in sync with its owner — shared fields are read-only. Your notes
                  stay private. Unlink to keep a frozen copy you can edit.
                </p>
                <form action={unlinkLiveShare} className="mt-3">
                  <input name="contactId" type="hidden" value={contact.id} />
                  <button
                    className="rounded-[0.8rem] border border-[#d8ddd6] bg-white px-3.5 py-2 text-sm font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                    type="submit"
                  >
                    Unlink (keep a static copy)
                  </button>
                </form>
              </div>
            ) : (
              <div className="mt-4 rounded-[1.4rem] border border-[#d8ddd6] bg-white p-5">
                <p className="text-sm font-semibold text-[#1d2823]">Share live — keeps in sync</p>
                <p className="mt-0.5 text-[13px] text-[#5c655e]">
                  The recipient gets a linked copy that updates whenever you edit this contact. Both
                  of you must be on a paid plan.
                </p>
                {liveShareEnabled ? (
                  <form action={createLiveShare} className="mt-3 flex flex-wrap items-center gap-2">
                    <input name="contactId" type="hidden" value={contact.id} />
                    <input
                      className="min-w-[220px] flex-1 rounded-[0.7rem] border border-[#d8ddd6] bg-white px-3 py-2 text-sm text-[#1d2823] outline-none focus:border-[#4158f4]"
                      name="recipientEmail"
                      placeholder="name@email.com"
                      required
                      type="email"
                    />
                    <button
                      className="rounded-[0.8rem] bg-[#17352e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#20443b]"
                      type="submit"
                    >
                      Share live
                    </button>
                  </form>
                ) : (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-[0.9rem] bg-[#f6edd9] px-4 py-3 text-[13px] text-[#7a5a1a]">
                    <span>Live sharing is a Pro feature.</span>
                    <Link className="shrink-0 font-semibold underline" href="/pricing">
                      Upgrade
                    </Link>
                  </div>
                )}

                {liveShares.length > 0 ? (
                  <ul className="mt-4 grid gap-2">
                    {liveShares.map((share) => (
                      <li
                        className="flex items-center justify-between gap-3 border-b border-[#edf0ea] pb-2 text-[13px] last:border-b-0"
                        key={share.id}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[#1d2823]">{share.recipientEmail}</span>
                          {share.status === "ACTIVE" && share.recipientContactId ? (
                            share.lastErrorCode === "RECIPIENT_LOCKED" ? (
                              <span className="block text-[12px] text-[#bf8526]">
                                Sync paused — recipient account issue
                              </span>
                            ) : share.lastErrorCode ? (
                              <span className="block text-[12px] text-[#bf8526]">
                                Sync error — will retry
                              </span>
                            ) : share.lastPushedAt ? (
                              <span className="block text-[12px] text-[#8b938c]">
                                Last synced {formatTimestamp(share.lastPushedAt)}
                              </span>
                            ) : null
                          ) : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="text-[#8b938c]">
                            {share.status === "REVOKED"
                              ? "Revoked"
                              : share.status === "DECLINED"
                                ? "Declined"
                                : share.recipientContactId
                                  ? "Live"
                                  : "Pending"}
                          </span>
                          {share.status === "ACTIVE" ? (
                            <form action={revokeShare}>
                              <input name="shareId" type="hidden" value={share.id} />
                              <input name="contactId" type="hidden" value={contact.id} />
                              <button className="font-semibold text-[#b5472f]" type="submit">
                                Revoke
                              </button>
                            </form>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {detailTab === "history" ? (
        <section className={sectionCardClassName} id="contact-history">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">History</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            Every change to this contact — edits, imports, merges, and sync — in reverse order.
          </p>
          <div className="mt-4 overflow-hidden rounded-[1.4rem] border border-[#e9ece7] bg-white">
            <ContactHistory contactId={contact.id} />
          </div>
        </section>
        ) : null}
            </div>
          </main>
        </div>
      </div>
    </AppShell>
  );
}
