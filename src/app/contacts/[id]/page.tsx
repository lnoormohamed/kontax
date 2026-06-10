import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { ContactHistory } from "~/app/_components/contact-history";
import { ContactInlineEditor } from "~/app/_components/contact-inline-editor";
import { ContactSharing } from "~/app/_components/contact-sharing";
import { CopyMonoRow } from "~/app/_components/copy-field";
import { LastUpdatedBy } from "~/app/_components/last-updated-by";
import { SourceBadge } from "~/app/_components/source-badge";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
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

// Left-rail metadata dates match the design: non-padded day (e.g. "8 Jun 2026").
const formatMetaDate = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);


const formatStoredDateValue = (value: string | null | undefined) => {
  if (!value) {
    return "Not added yet";
  }
  // Year-less vCard form: --MMDD or --MM-DD
  const noYearMatch = /^--(\d{2})-?(\d{2})$/.exec(value);
  if (noYearMatch) {
    const [, month, day] = noYearMatch;
    const parsed = new Date(Date.UTC(2000, Number(month) - 1, Number(day)));
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "long",
      timeZone: "UTC",
    }).format(parsed);
  }
  // Full date: YYYY-MM-DD (extended) or YYYYMMDD (vCard basic)
  const exactDateMatch = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value);
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

// Short status word + palette colours for the Sync card account badge,
// mirroring the design's StatusBadge (Linked / Conflict / Error / Syncing).
const getSyncBadge = (link: {
  lastSyncedAt: Date | null;
  tombstonedAt: Date | null;
  remoteDeletedAt: Date | null;
  lastErrorCode: string | null;
  conflicts: number;
}): { label: string; className: string } => {
  if (link.conflicts > 0) {
    return { label: "Conflict", className: "bg-[#f6edd9] text-[#7a5a1a]" };
  }
  if (link.lastErrorCode || link.tombstonedAt || link.remoteDeletedAt) {
    return { label: "Needs review", className: "bg-[#f3e1da] text-[#b5472f]" };
  }
  if (link.lastSyncedAt) {
    return { label: "Linked", className: "bg-[#e3efe7] text-[#1c6b48]" };
  }
  return { label: "Syncing", className: "bg-[#f2f4f0] text-[#5c655e]" };
};

const getInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

// 8-pair name-hash tints matching the locked design kit (same set as contacts list rows).
const AVATAR_TINTS: [string, string][] = [
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
  for (let i = 0; i < value.length; i++) hash = ((hash * 31 + value.charCodeAt(i)) >>> 0);
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]!;
};


// Normalise the contact's Json entry columns into the shapes the inline editor
// expects. Tolerates legacy shapes ({relationship,name}, {date}, CardDAV postal
// keys) and falls back to the scalar mirror column when no entries exist.
const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value.filter((v) => v && typeof v === "object") as Record<string, unknown>[]) : [];

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const normaliseSimple = (
  raw: unknown,
  scalar: string | null,
  fallbackLabel: string,
): { label: string; value: string }[] => {
  const items = asArray(raw)
    .map((e) => ({ label: str(e.label) || fallbackLabel, value: str(e.value) }))
    .filter((e) => e.value.length > 0);
  if (items.length === 0 && scalar) {
    return [{ label: fallbackLabel, value: scalar }];
  }
  return items;
};

const normaliseRelated = (raw: unknown): { label: string; value: string }[] =>
  asArray(raw)
    .map((e) => ({
      label: str(e.label) || str(e.relationship) || "Other",
      value: str(e.value) || str(e.name),
    }))
    .filter((e) => e.value.length > 0);

const normaliseDates = (raw: unknown): { label: string; value: string }[] =>
  asArray(raw)
    .map((e) => ({ label: str(e.label) || "Anniversary", value: str(e.value) || str(e.date) }))
    .filter((e) => e.value.length > 0);

const normaliseAddresses = (
  raw: unknown,
  scalar: string | null,
): {
  label: string;
  street: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}[] => {
  const items = asArray(raw).map((a) => {
    const street = str(a.street) || [str(a.streetLine1), str(a.streetLine2)].filter(Boolean).join(", ");
    const city = str(a.city) || str(a.cityOrTown);
    const state = str(a.state) || str(a.region) || str(a.stateOrProvince);
    const postcode = str(a.postcode) || str(a.postalCode);
    const country = str(a.country) || str(a.countryOrRegion);
    const anyStructured = street || city || state || postcode || country;
    return {
      label: str(a.label) || "Home",
      street: anyStructured ? street : str(a.formatted),
      city,
      state,
      postcode,
      country,
    };
  });
  if (items.length === 0 && scalar) {
    return [{ label: "Home", street: scalar, city: "", state: "", postcode: "", country: "" }];
  }
  return items;
};

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
      syncUid: true,
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
      department: true,
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

  // Shared books the user owns/belongs to (for the "Add to a shared book"
  // section of the Sharing tab). Adding a contact to a book lands in Phase 13.
  const sharedBooks = await db.group.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id, inviteStatus: "ACCEPTED" } } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, type: true, _count: { select: { members: true } } },
  });

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
      <div className="min-h-full bg-white text-[#1d2823]">
        {/* slim sticky sub-header (back · name · Share/Archive/Favorite/⋯) */}
        <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#d8ddd6] bg-white/95 px-4 backdrop-blur lg:px-6">
          <Link
            className="flex items-center gap-1.5 text-sm font-semibold text-[#5c655e] transition hover:text-[#1d2823]"
            href="/"
          >
            <WorkspaceIcon name="back" size={17} />
            Contacts
          </Link>
          <span className="flex-1 truncate text-center text-[15px] font-semibold text-[#1d2823]">
            {contact.fullName}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              className="flex h-[34px] items-center gap-1.5 rounded-[8px] border border-transparent px-3 text-[13px] font-semibold text-[#5c655e] transition hover:border-[#d8ddd6] hover:bg-[#f2f4f0]"
              href={`/contacts/${contact.id}?tab=sharing`}
            >
              <WorkspaceIcon name="share" size={16} />
              Share
            </Link>
            <form action={contact.archivedAt ? restoreContact : archiveContact}>
              <input name="contactId" type="hidden" value={contact.id} />
              <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
              <button
                className="flex h-[34px] items-center gap-1.5 rounded-[8px] border border-[#d8ddd6] bg-white px-3 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                type="submit"
              >
                <WorkspaceIcon name={contact.archivedAt ? "restore" : "archive"} size={16} />
                {contact.archivedAt ? "Restore" : "Archive"}
              </button>
            </form>
            <details className="relative">
              <summary className="grid size-[34px] cursor-pointer list-none place-items-center rounded-[8px] border border-transparent text-[#5c655e] transition hover:border-[#d8ddd6] hover:bg-[#f2f4f0]">
                <WorkspaceIcon name="more" size={18} />
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

        <div className="flex bg-white">
          {/* left rail (sticky) */}
          <aside
            className="hidden w-[320px] shrink-0 self-start border-r border-[#d8ddd6] bg-white p-6 lg:block"
            style={{ position: "sticky", top: 56 }}
          >
            {(() => {
              const [avatarBg, avatarFg] = tintForName(contact.fullName);
              return (
                <div
                  className="relative inline-flex h-[88px] w-[88px] items-center justify-center rounded-full text-3xl font-bold"
                  style={{ background: avatarBg, color: avatarFg }}
                >
                  {getInitials(contact.fullName)}
                  {contact.isFavorite ? (
                    <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full bg-white text-[#e0a31c] shadow">
                      <WorkspaceIcon fill="#e0a31c" name="star" size={14} />
                    </span>
                  ) : null}
                </div>
              );
            })()}
            <h1 className="mt-4 text-[21px] font-bold leading-tight tracking-[-0.01em] text-[#1d2823]">
              {contact.fullName}
            </h1>
            {contact.company || contact.jobTitle ? (
              <p className="mt-1 text-[13.5px] text-[#5c655e]">
                {[contact.jobTitle, contact.company].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {contact.birthday ? (
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#8b938c]">
                <WorkspaceIcon name="gift" size={14} />
                {formatStoredDateValue(contact.birthday)}
              </p>
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

            {/* quick actions — borderless icon buttons, hover fills surface */}
            <div className="flex items-center gap-0.5">
              {contact.phone ? (
                <a
                  aria-label="Call"
                  className="grid h-9 w-9 place-items-center rounded-[9px] text-[#5c655e] transition hover:bg-[#f2f4f0]"
                  href={`tel:${contact.phone}`}
                  title="Call"
                >
                  <WorkspaceIcon name="phone" size={17} />
                </a>
              ) : null}
              {contact.email ? (
                <a
                  aria-label="Email"
                  className="grid h-9 w-9 place-items-center rounded-[9px] text-[#5c655e] transition hover:bg-[#f2f4f0]"
                  href={`mailto:${contact.email}`}
                  title="Email"
                >
                  <WorkspaceIcon name="mail" size={17} />
                </a>
              ) : null}
              <form action={toggleFavoriteContact}>
                <input name="contactId" type="hidden" value={contact.id} />
                <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                <button
                  aria-label={contact.isFavorite ? "Unfavorite" : "Favorite"}
                  className="grid h-9 w-9 place-items-center rounded-[9px] text-[#e0a31c] transition hover:bg-[#f2f4f0]"
                  title="Favourite"
                  type="submit"
                >
                  <WorkspaceIcon fill={contact.isFavorite ? "#e0a31c" : "none"} name="star" size={17} />
                </button>
              </form>
              <Link
                aria-label="Share"
                className="grid h-9 w-9 place-items-center rounded-[9px] text-[#5c655e] transition hover:bg-[#f2f4f0]"
                href={`/contacts/${contact.id}?tab=sharing`}
                title="Share"
              >
                <WorkspaceIcon name="share" size={17} />
              </Link>
              <form action={contact.archivedAt ? restoreContact : archiveContact}>
                <input name="contactId" type="hidden" value={contact.id} />
                <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                <button
                  aria-label={contact.archivedAt ? "Restore" : "Archive"}
                  className="grid h-9 w-9 place-items-center rounded-[9px] text-[#5c655e] transition hover:bg-[#f2f4f0]"
                  title={contact.archivedAt ? "Restore" : "Archive"}
                  type="submit"
                >
                  <WorkspaceIcon name={contact.archivedAt ? "restore" : "archive"} size={17} />
                </button>
              </form>
            </div>

            <div className="my-5 h-px bg-[#edf0ea] " />

            {/* metadata */}
            <dl className="grid gap-2 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b938c]">Added</dt>
                <dd className="text-right text-[#5c655e]">{formatMetaDate(contact.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b938c]">Modified</dt>
                <dd className="text-right text-[#5c655e]">{formatMetaDate(contact.updatedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b938c]">UID</dt>
                <dd className="text-right font-mono text-[#5c655e]" title={contact.syncUid}>
                  {contact.syncUid.slice(0, 8)}…
                </dd>
              </div>
              <LastUpdatedBy
                lastMutatedBy={contact.lastMutatedBy}
                lastMutatedByDetail={contact.lastMutatedByDetail}
                updatedAt={contact.updatedAt.toISOString()}
              />
            </dl>
          </aside>

          {/* right pane */}
          <main className="min-w-0 flex-1 bg-white px-4 py-5 lg:px-8 lg:py-6">
            <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5">

        {wasSaved ? (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-[#e3efe7] px-4 py-2.5 text-[13px] text-[#1c6b48]">
            <WorkspaceIcon name="check" size={15} strokeWidth={2} />
            Contact saved successfully.
          </div>
        ) : null}
        {wasMerged ? (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-[#e3efe7] px-4 py-2.5 text-[13px] text-[#1c6b48]">
            <WorkspaceIcon name="check" size={15} strokeWidth={2} />
            Merge completed. You can undo the latest merge from the action rail.
          </div>
        ) : null}
        {wasMergeUndone ? (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-[#f6edd9] px-4 py-2.5 text-[13px] text-[#7a5a1a]">
            <WorkspaceIcon name="restore" size={15} strokeWidth={2} />
            Merge undone. Secondary contact restored and primary rolled back.
          </div>
        ) : null}
        {contact.archivedAt && detailTab === "details" ? (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-[#f6edd9] px-4 py-2.5 text-[13px] text-[#7a5a1a]">
            <WorkspaceIcon name="archive" size={15} strokeWidth={2} />
            This contact is archived — it won&apos;t appear in your main list.
          </div>
        ) : null}

        {/* Details · Sharing · History tabs */}
        <div className="flex items-center gap-1 border-b border-[#e9ece7]">
          {(
            [
              ["details", "Details", "briefcase"],
              ["sharing", "Sharing", "share"],
              ["history", "History", "clock"],
            ] as const
          ).map(([key, label, icon]) => (
            <Link
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[14px] transition ${
                detailTab === key
                  ? "border-[#17352e] font-bold text-[#1d2823]"
                  : "border-transparent font-medium text-[#8b938c] hover:text-[#5c655e]"
              }`}
              href={`/contacts/${contact.id}?tab=${key}`}
              key={key}
            >
              <WorkspaceIcon name={icon} size={16} />
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
                department: contact.department,
                email: contact.email,
                phone: contact.phone,
                website: contact.website,
                birthday: contact.birthday,
                address: contact.address,
                notes: contact.notes,
              }}
              entries={{
                emails: normaliseSimple(contact.emailEntries, contact.email, "Work"),
                phones: normaliseSimple(contact.phoneEntries, contact.phone, "Mobile"),
                websites: normaliseSimple(contact.websiteEntries, contact.website, "Portfolio"),
                addresses: normaliseAddresses(contact.addressEntries, contact.address),
                dates: normaliseDates(contact.significantDates),
                related: normaliseRelated(contact.relatedPeople),
              }}
              editableShared={!isLiveReceived}
            />

            <section className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white">
              <h3 className="px-5 pt-3.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
                Sync
              </h3>
              <div className="mt-3 h-px bg-[#e9ece7]" />
              {syncLinks.length === 0 ? (
                <p className="px-5 py-4 text-[13.5px] italic text-[#b9c0b8]">
                  Not linked to any account yet. Connect a CardDAV account to keep this contact in
                  sync.
                </p>
              ) : (
                <div className="px-3 pb-3 pt-1">
                  {syncLinks.map((link) => {
                    const badge = getSyncBadge({
                      lastSyncedAt: link.lastSyncedAt,
                      tombstonedAt: link.tombstonedAt,
                      remoteDeletedAt: link.remoteDeletedAt,
                      lastErrorCode: link.lastErrorCode,
                      conflicts: link._count.syncConflicts,
                    });
                    return (
                      <div
                        className="flex items-center gap-3 border-b border-[#e9ece7] px-2 py-2.5 last:border-b-0"
                        key={link.id}
                      >
                        <WorkspaceIcon className="shrink-0 text-[#5c655e]" name="cloud" size={18} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold text-[#1d2823]">
                            {link.syncAccount.label ??
                              link.syncAccount.addressBookDisplayName ??
                              "CardDAV account"}
                            <span className="font-normal text-[12.5px] text-[#8b938c]">
                              {" · CardDAV"}
                            </span>
                          </p>
                          <p className="mt-px text-[12px] text-[#8b938c]">
                            {getSyncLinkStatusLabel(link)} ·{" "}
                            {link.lastSyncedAt
                              ? `last synced ${formatTimestamp(link.lastSyncedAt)}`
                              : "not yet synced"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}

                  {/* CardDAV sync identifiers (P-parity): per-contact UID + the
                      primary link's remote ETag, read-only with copy. */}
                  <div className="my-1.5 h-px bg-[#e9ece7]" />
                  {syncLinks[0]?.remoteETag ? (
                    <CopyMonoRow label="ETag" value={syncLinks[0].remoteETag} />
                  ) : null}
                  <CopyMonoRow label="UID" value={contact.syncUid} />
                </div>
              )}
            </section>
          </div>
        ) : null}

        {detailTab === "sharing" ? (
          <ContactSharing
            books={sharedBooks.map((b) => ({
              id: b.id,
              name: b.name,
              type: b.type,
              memberCount: b._count.members,
            }))}
            contactId={contact.id}
            isFree={shellPlan.plan === "FREE"}
            isLiveReceived={isLiveReceived}
            liveOwnerLabel={contact.sourceDetail}
            liveShareEnabled={liveShareEnabled}
            liveShares={liveShares.map((s) => ({
              id: s.id,
              status: s.status,
              recipientEmail: s.recipientEmail,
              accepted: Boolean(s.recipientContactId),
              lastPushedAt: s.lastPushedAt ? s.lastPushedAt.toISOString() : null,
              lastErrorCode: s.lastErrorCode,
            }))}
            shareOrigin={shareOrigin}
            staticShareEnabled={staticShareEnabled}
            staticShares={staticShares.map((s) => ({
              id: s.id,
              status: s.status,
              recipientEmail: s.recipientEmail,
              accepted: Boolean(s.recipientContactId),
              lastPushedAt: null,
              lastErrorCode: s.lastErrorCode,
            }))}
            vcardLinks={vcardLinks.map((l) => ({
              id: l.id,
              token: l.token,
              downloadCount: l.downloadCount,
              expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
            }))}
          />
        ) : null}

        {detailTab === "history" ? (
          <div id="contact-history">
            <ContactHistory contactId={contact.id} />
          </div>
        ) : null}
            </div>
          </main>
        </div>
      </div>
    </AppShell>
  );
}
