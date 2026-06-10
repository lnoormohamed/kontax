import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { ContactHistory } from "~/app/_components/contact-history";
import { CopyField } from "~/app/_components/copy-field";
import {
  createLiveShare,
  createStaticShare,
  createVcardShareLink,
  revokeShare,
  unlinkLiveShare,
} from "~/app/actions/shares";
import { ContactPhoneticAssistant } from "~/app/_components/contact-phonetic-assistant";
import { LastUpdatedBy } from "~/app/_components/last-updated-by";
import { SourceBadge } from "~/app/_components/source-badge";
import {
  archiveContact,
  undoMergeContacts,
  permanentlyDeleteContact,
  restoreContact,
  toggleFavoriteContact,
  updateContact,
} from "~/app/actions/contacts";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { parseContactPostalAddresses, parseContactStringArray } from "~/server/contact-portability";
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

const getFormattedAddressArray = (value: unknown) =>
  parseContactPostalAddresses(value).map((item) => item.formatted);

const formatDisplayValue = (value: string | null | undefined, fallback = "Not added yet") => {
  const trimmed = value?.trim();
  return trimmed ?? fallback;
};

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

const getStructuredEntryAt = <T,>(value: unknown, index: number) => {
  if (!Array.isArray(value) || value.length <= index) {
    return undefined;
  }

  return value[index] as T;
};

const getStructuredEntryCount = (value: unknown) => (Array.isArray(value) ? value.length : 0);

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

const getPhoneticSummary = (contact: {
  phoneticFirstName: string | null;
  phoneticLastName: string | null;
  phoneticCompany: string | null;
}) => {
  const nameReading = [contact.phoneticFirstName, contact.phoneticLastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .trim();
  const companyReading = contact.phoneticCompany?.trim() ?? "";

  return {
    nameReading: nameReading || null,
    companyReading: companyReading || null,
  };
};

const inputClassName =
  "rounded-[1.2rem] border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#67b59f] focus:bg-white";

const textareaClassName = `${inputClassName} min-h-28`;

const sectionCardClassName =
  "rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm sm:p-6";

const helperCardClassName =
  "rounded-[1.5rem] border border-[#dfe7e1] bg-[#f8faf8] p-4 text-sm text-slate-600";
const progressiveDetailsClassName =
  "group rounded-[1.6rem] border border-[#dbe5df] bg-[#f6faf8] px-4 py-3 shadow-sm";
const progressiveSummaryClassName =
  "flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.25rem] px-2 py-1 text-left transition hover:bg-white/70";
const progressiveInnerCardClassName =
  "rounded-[1.4rem] border border-[#dce8e2] bg-white p-4";
const progressiveSectionTitleClassName =
  "text-xs font-semibold uppercase tracking-[0.2em] text-slate-400";

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
  const decisionParam = resolvedSearchParams?.decisionId;
  const decisionId = Array.isArray(decisionParam) ? decisionParam[0] : decisionParam;
  const tabParam = resolvedSearchParams?.tab;
  const tabValue = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const detailTab: "details" | "sharing" | "history" =
    tabValue === "sharing" || tabValue === "history" ? tabValue : "details";
  const userSettings = await db.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      autoFillPhoneticNames: true,
    },
  });

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

  const primaryEmailEntry = getStructuredEntryAt<{ label?: string }>(contact.emailEntries, 0);
  const secondaryEmailEntry = getStructuredEntryAt<{ label?: string; value?: string }>(
    contact.emailEntries,
    1,
  );
  const primaryPhoneEntry = getStructuredEntryAt<{ label?: string }>(contact.phoneEntries, 0);
  const secondaryPhoneEntry = getStructuredEntryAt<{ label?: string; value?: string }>(
    contact.phoneEntries,
    1,
  );
  const primaryAddressEntry = getStructuredEntryAt<{
    label?: string;
    countryOrRegion?: string;
    streetLine1?: string;
    streetLine2?: string;
    cityOrTown?: string;
    postcode?: string;
    poBox?: string;
  }>(contact.addressEntries, 0);
  const primaryWebsiteEntry = getStructuredEntryAt<{ label?: string }>(contact.websiteEntries, 0);
  const secondaryWebsiteEntry = getStructuredEntryAt<{ label?: string; value?: string }>(
    contact.websiteEntries,
    1,
  );
  const secondaryEmailValue =
    typeof secondaryEmailEntry?.value === "string" ? secondaryEmailEntry.value : "";
  const secondaryPhoneValue =
    typeof secondaryPhoneEntry?.value === "string" ? secondaryPhoneEntry.value : "";
  const secondaryWebsiteValue =
    typeof secondaryWebsiteEntry?.value === "string" ? secondaryWebsiteEntry.value : "";
  const additionalEmails = parseContactStringArray(contact.emailAddresses)
    .filter((item) => item !== contact.email && item !== secondaryEmailValue)
    .join("\n");
  const additionalPhones = parseContactStringArray(contact.phoneNumbers)
    .filter((item) => item !== contact.phone && item !== secondaryPhoneValue)
    .join("\n");
  const additionalAddresses = getFormattedAddressArray(contact.postalAddresses)
    .filter((item) => item !== contact.address)
    .join("\n");
  const labelsValue = Array.isArray(contact.labels) ? contact.labels.join(", ") : "";
  const additionalWebsites =
    Array.isArray(contact.websiteEntries)
      ? contact.websiteEntries
          .map((entry) => {
            if (!entry || typeof entry !== "object" || !("value" in entry)) {
              return undefined;
            }

            const value = (entry as { value?: string }).value;
            return typeof value === "string" &&
              value !== contact.website &&
              value !== secondaryWebsiteValue
              ? value
              : undefined;
          })
          .filter((item): item is string => Boolean(item))
          .join("\n")
      : "";
  const significantDatesValue =
    Array.isArray(contact.significantDates)
      ? contact.significantDates
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return undefined;
            }

            const label = "label" in entry ? (entry as { label?: string }).label : undefined;
            const date = "date" in entry ? (entry as { date?: string }).date : undefined;

            if (!label || !date || (label.toLowerCase() === "birthday" && date === contact.birthday)) {
              return undefined;
            }

            return `${label} | ${date}`;
          })
          .filter((item): item is string => Boolean(item))
          .join("\n")
      : "";
  const relatedPeopleValue =
    Array.isArray(contact.relatedPeople)
      ? contact.relatedPeople
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return undefined;
            }

            const relationship =
              "relationship" in entry
                ? (entry as { relationship?: string }).relationship
                : undefined;
            const name = "name" in entry ? (entry as { name?: string }).name : undefined;

            return relationship && name ? `${relationship} | ${name}` : undefined;
          })
          .filter((item): item is string => Boolean(item))
          .join("\n")
      : "";
  const customFieldsValue =
    Array.isArray(contact.customFields)
      ? contact.customFields
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return undefined;
            }

            const label = "label" in entry ? (entry as { label?: string }).label : undefined;
            const value = "value" in entry ? (entry as { value?: string }).value : undefined;

            return label && value ? `${label} | ${value}` : undefined;
          })
          .filter((item): item is string => Boolean(item))
          .join("\n")
      : "";
  const structuredCoverage = [
    { label: "Emails", count: getStructuredEntryCount(contact.emailEntries) },
    { label: "Phones", count: getStructuredEntryCount(contact.phoneEntries) },
    { label: "Websites", count: getStructuredEntryCount(contact.websiteEntries) },
    { label: "Addresses", count: getStructuredEntryCount(contact.addressEntries) },
    { label: "Dates", count: getStructuredEntryCount(contact.significantDates) },
    { label: "Relationships", count: getStructuredEntryCount(contact.relatedPeople) },
    { label: "Custom fields", count: getStructuredEntryCount(contact.customFields) },
  ];
  const enrichedFieldCount = structuredCoverage.filter((item) => item.count > 0).length;
  const phoneticSummary = getPhoneticSummary(contact);

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
          {(
            [
              ["details", "Details"],
              ["sharing", "Sharing"],
              ["history", "History"],
            ] as const
          ).map(([key, label]) => (
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
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-6">
            <section className={sectionCardClassName} id="contact-snapshot">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">
                    Contact snapshot
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    Everything important at a glance
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    This view keeps the contact readable before you edit, with clearer grouped details,
                    gentler empty states, and the richer fields Kontax is already preserving.
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-[#dfe7e1] bg-[#f8faf8] px-4 py-3 text-sm text-slate-600">
                  {contact.archivedAt ? "Archived record" : "Active record"} ·{" "}
                  {contact.isFavorite ? "Favorite" : "Standard"} · {syncLinks.length > 0 ? "Synced" : "Local only"}
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <article className="rounded-[1.6rem] border border-[#d8ddd6] bg-[#fcfcfa] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1f7a67]">
                    Identity
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Display name</p>
                      <p className="mt-1 font-medium text-slate-900">{contact.fullName}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Company</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatDisplayValue(contact.company)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Role</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatDisplayValue(contact.jobTitle)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Nickname</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatDisplayValue(contact.nickname)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Phonetic</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {phoneticSummary.nameReading ??
                          phoneticSummary.companyReading ??
                          "Not added yet"}
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[1.6rem] border border-[#d8ddd6] bg-[#fcfcfa] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1f7a67]">
                    Contact methods
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Email</p>
                      <p className="mt-1 font-medium text-slate-900">{formatDisplayValue(contact.email)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Phone</p>
                      <p className="mt-1 font-medium text-slate-900">{formatDisplayValue(contact.phone)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Website</p>
                      <p className="mt-1 break-words font-medium text-slate-900">
                        {formatDisplayValue(contact.website)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Address</p>
                      <p className="mt-1 whitespace-pre-line font-medium text-slate-900">
                        {formatDisplayValue(contact.address)}
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[1.6rem] border border-[#d8ddd6] bg-[#fcfcfa] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1f7a67]">
                    Personal context
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Birthday</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatStoredDateValue(contact.birthday)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Related people
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {getStructuredEntryCount(contact.relatedPeople) > 0
                          ? `${getStructuredEntryCount(contact.relatedPeople)} saved`
                          : "Not added yet"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Significant dates
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {getStructuredEntryCount(contact.significantDates) > 0
                          ? `${getStructuredEntryCount(contact.significantDates)} saved`
                          : "Not added yet"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Notes</p>
                      <p className="mt-1 whitespace-pre-line font-medium text-slate-900">
                        {formatDisplayValue(contact.notes)}
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[1.6rem] border border-[#d8ddd6] bg-[#fcfcfa] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1f7a67]">
                    Organization and portability
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Labels</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {labelsValue || "Not added yet"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Custom fields
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {getStructuredEntryCount(contact.customFields) > 0
                          ? `${getStructuredEntryCount(contact.customFields)} saved`
                          : "Not added yet"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Structured coverage
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {enrichedFieldCount} of {structuredCoverage.length} richer areas populated
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Sync linkage
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {syncLinks.length > 0 ? `${syncLinks.length} linked source(s)` : "Local-only record"}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <div className={sectionCardClassName} id="contact-editor">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">
                  Edit contact
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Grouped for faster everyday editing
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-500">
                  Keep the everyday fields visible, then add richer details only when this contact
                  needs them.
                </p>
              </div>

              <form action={updateContact} className="mt-6 grid gap-6" id="edit-contact-form">
                <ContactPhoneticAssistant
                  enabled={userSettings?.autoFillPhoneticNames ?? false}
                  formId="edit-contact-form"
                />
                <input name="contactId" type="hidden" value={contact.id} />
                <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}?saved=1`} />

                <section className="rounded-[1.8rem] border border-[#d8ddd6] bg-[#fdfdfb] p-5">
                  <div className="mb-5">
                    <p className="text-lg font-semibold text-slate-900">Identity and role</p>
                    <p className="mt-1 text-sm text-slate-500">
                      The fields most people expect to change first: name, role, favorite state,
                      and how this person appears in your main list.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>First name</span>
                      <input className={inputClassName} defaultValue={contact.firstName ?? ""} name="firstName" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Last name</span>
                      <input className={inputClassName} defaultValue={contact.lastName ?? ""} name="lastName" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Company</span>
                      <input className={inputClassName} defaultValue={contact.company ?? ""} name="company" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Job title</span>
                      <input className={inputClassName} defaultValue={contact.jobTitle ?? ""} name="jobTitle" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Primary email</span>
                      <input className={inputClassName} defaultValue={contact.email ?? ""} name="email" type="email" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Primary phone</span>
                      <input className={inputClassName} defaultValue={contact.phone ?? ""} name="phone" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Birthday</span>
                      <input className={inputClassName} defaultValue={contact.birthday ?? ""} name="birthday" type="date" />
                    </label>
                    <label className="flex items-center gap-3 rounded-[1.2rem] border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-700">
                      <input
                        className="h-4 w-4 rounded border-slate-300 text-[#1f7a67] focus:ring-[#67b59f]"
                        defaultChecked={contact.isFavorite}
                        name="isFavorite"
                        type="checkbox"
                        value="true"
                      />
                      <span>Favorite contact</span>
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Notes</span>
                      <textarea className="min-h-40 rounded-[1.2rem] border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#67b59f] focus:bg-white" defaultValue={contact.notes ?? ""} name="notes" />
                    </label>
                    <div className="rounded-[1.2rem] border border-[#dfe7e1] bg-[#f7fbf9] px-4 py-3 text-sm text-slate-600 lg:col-span-2">
                      Kontax uses the person name when present and falls back to company for organization-only contacts.
                    </div>
                  </div>
                </section>

                <details className={progressiveDetailsClassName}>
                  <summary className={progressiveSummaryClassName}>
                    <div>
                      <p className="text-base font-semibold text-slate-900">Add more name fields</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Phonetic readings, middle name, prefix, suffix, nickname, labels, avatar.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#1f7a67] shadow-sm">+ Add</span>
                  </summary>

                  <div className="mt-4 grid gap-4 border-t border-[#dce8e2] pt-4 lg:grid-cols-2">
                    <div className={`${progressiveInnerCardClassName} lg:col-span-2`}>
                      <p className={progressiveSectionTitleClassName}>Phonetic and sorting</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        These readings help search, sorting, and cross-script handling. Manual edits always win over auto-fill.
                      </p>
                    </div>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Phonetic first name</span>
                      <input
                        className={inputClassName}
                        defaultValue={contact.phoneticFirstName ?? ""}
                        name="phoneticFirstName"
                        type="text"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Phonetic last name</span>
                      <input
                        className={inputClassName}
                        defaultValue={contact.phoneticLastName ?? ""}
                        name="phoneticLastName"
                        type="text"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Middle name</span>
                      <input className={inputClassName} defaultValue={contact.middleName ?? ""} name="middleName" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Prefix</span>
                      <input className={inputClassName} defaultValue={contact.namePrefix ?? ""} name="namePrefix" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Suffix</span>
                      <input className={inputClassName} defaultValue={contact.nameSuffix ?? ""} name="nameSuffix" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Nickname</span>
                      <input className={inputClassName} defaultValue={contact.nickname ?? ""} name="nickname" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Phonetic company</span>
                      <input
                        className={inputClassName}
                        defaultValue={contact.phoneticCompany ?? ""}
                        name="phoneticCompany"
                        type="text"
                      />
                    </label>
                    <div className={`${progressiveInnerCardClassName} lg:col-span-2`}>
                      <p className={progressiveSectionTitleClassName}>Profile extras</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Labels help the list and filters. Avatars and nicknames add context without making the homepage heavier.
                      </p>
                    </div>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Avatar URL</span>
                      <input className={inputClassName} defaultValue={contact.avatarUrl ?? ""} name="avatarUrl" type="url" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Labels</span>
                      <input
                        className={inputClassName}
                        defaultValue={labelsValue}
                        name="labels"
                        placeholder="Family, VIP, School"
                        type="text"
                      />
                    </label>
                  </div>
                </details>

                <details className={progressiveDetailsClassName}>
                  <summary className={progressiveSummaryClassName}>
                    <div>
                      <p className="text-base font-semibold text-slate-900">Add more email and phone fields</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Labels, secondary values, and overflow contact methods.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#1f7a67] shadow-sm">+ Add</span>
                  </summary>

                  <div className="mt-4 grid gap-4 border-t border-[#dce8e2] pt-4 lg:grid-cols-2">
                    <div className={`${progressiveInnerCardClassName} lg:col-span-2`}>
                      <p className={progressiveSectionTitleClassName}>Email</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Labeled secondary methods stay easier to understand in exports than a single generic overflow list.
                      </p>
                    </div>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Email label</span>
                      <input className={inputClassName} defaultValue={primaryEmailEntry?.label ?? ""} name="emailLabel" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Secondary email</span>
                      <input
                        className={inputClassName}
                        defaultValue={secondaryEmailValue}
                        name="secondaryEmail"
                        type="email"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Secondary email label</span>
                      <input
                        className={inputClassName}
                        defaultValue={secondaryEmailEntry?.label ?? ""}
                        name="secondaryEmailLabel"
                        type="text"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Additional emails</span>
                      <textarea className={textareaClassName} defaultValue={additionalEmails} name="additionalEmails" />
                    </label>
                    <div className={`${progressiveInnerCardClassName} lg:col-span-2`}>
                      <p className={progressiveSectionTitleClassName}>Phone</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Use labels like mobile, work, or home so the meaning survives imports and sync.
                      </p>
                    </div>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Phone label</span>
                      <input className={inputClassName} defaultValue={primaryPhoneEntry?.label ?? ""} name="phoneLabel" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Secondary phone</span>
                      <input
                        className={inputClassName}
                        defaultValue={secondaryPhoneValue}
                        name="secondaryPhone"
                        type="text"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Secondary phone label</span>
                      <input
                        className={inputClassName}
                        defaultValue={secondaryPhoneEntry?.label ?? ""}
                        name="secondaryPhoneLabel"
                        type="text"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Additional phones</span>
                      <textarea className={textareaClassName} defaultValue={additionalPhones} name="additionalPhones" />
                    </label>
                  </div>
                </details>

                <details className={progressiveDetailsClassName}>
                  <summary className={progressiveSummaryClassName}>
                    <div>
                      <p className="text-base font-semibold text-slate-900">Add address and website</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Location, websites, and structured address details.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#1f7a67] shadow-sm">+ Add</span>
                  </summary>

                  <div className="mt-4 grid gap-4 border-t border-[#dce8e2] pt-4 lg:grid-cols-2">
                    <div className={`${progressiveInnerCardClassName} lg:col-span-2`}>
                      <p className={progressiveSectionTitleClassName}>Address</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Freeform text is fine, but structured lines make later export and sync safer.
                      </p>
                    </div>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Address</span>
                      <textarea className={textareaClassName} defaultValue={contact.address ?? ""} name="address" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Address label</span>
                      <input className={inputClassName} defaultValue={primaryAddressEntry?.label ?? ""} name="addressLabel" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Country or region</span>
                      <input className={inputClassName} defaultValue={primaryAddressEntry?.countryOrRegion ?? ""} name="countryOrRegion" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Street line 1</span>
                      <input className={inputClassName} defaultValue={primaryAddressEntry?.streetLine1 ?? ""} name="streetLine1" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Street line 2</span>
                      <input className={inputClassName} defaultValue={primaryAddressEntry?.streetLine2 ?? ""} name="streetLine2" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>City or town</span>
                      <input className={inputClassName} defaultValue={primaryAddressEntry?.cityOrTown ?? ""} name="cityOrTown" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Postcode</span>
                      <input className={inputClassName} defaultValue={primaryAddressEntry?.postcode ?? ""} name="postcode" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>PO box</span>
                      <input className={inputClassName} defaultValue={primaryAddressEntry?.poBox ?? ""} name="poBox" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Additional addresses</span>
                      <textarea className={textareaClassName} defaultValue={additionalAddresses} name="additionalAddresses" />
                    </label>
                    <div className={`${progressiveInnerCardClassName} lg:col-span-2`}>
                      <p className={progressiveSectionTitleClassName}>Website</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Structured website labels help preserve what each link is for.
                      </p>
                    </div>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Website</span>
                      <input className={inputClassName} defaultValue={contact.website ?? ""} name="website" type="url" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Website label</span>
                      <input className={inputClassName} defaultValue={primaryWebsiteEntry?.label ?? ""} name="websiteLabel" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Secondary website</span>
                      <input
                        className={inputClassName}
                        defaultValue={secondaryWebsiteValue}
                        name="secondaryWebsite"
                        type="url"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Secondary website label</span>
                      <input
                        className={inputClassName}
                        defaultValue={secondaryWebsiteEntry?.label ?? ""}
                        name="secondaryWebsiteLabel"
                        type="text"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Additional websites</span>
                      <textarea className={textareaClassName} defaultValue={additionalWebsites} name="additionalWebsites" />
                    </label>
                  </div>
                </details>

                <details className={progressiveDetailsClassName}>
                  <summary className={progressiveSummaryClassName}>
                    <div>
                      <p className="text-base font-semibold text-slate-900">Add dates and relationships</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Significant dates, related people, and custom fields.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#1f7a67] shadow-sm">+ Add</span>
                  </summary>

                  <div className="mt-4 grid gap-4 border-t border-[#dce8e2] pt-4 lg:grid-cols-2">
                    <div className={`${progressiveInnerCardClassName} lg:col-span-2`}>
                      <p className={progressiveSectionTitleClassName}>Dates</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Birthday stays near the top. Use this area for anniversaries, milestones, and personal reminders.
                      </p>
                    </div>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Significant dates</span>
                      <textarea
                        className={textareaClassName}
                        defaultValue={significantDatesValue}
                        name="significantDates"
                        placeholder="Anniversary | 2018-06-09"
                      />
                    </label>
                    <div className={`${progressiveInnerCardClassName} lg:col-span-2`}>
                      <p className={progressiveSectionTitleClassName}>Relationships and custom data</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        These fields stay useful for merge context and personal memory even when some external systems cannot round-trip them fully.
                      </p>
                    </div>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Related people</span>
                      <textarea
                        className={textareaClassName}
                        defaultValue={relatedPeopleValue}
                        name="relatedPeople"
                        placeholder="Spouse | Alex Smith"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Custom fields</span>
                      <textarea
                        className={textareaClassName}
                        defaultValue={customFieldsValue}
                        name="customFields"
                        placeholder="Assistant | Jamie"
                      />
                    </label>
                  </div>
                </details>

                <div className={helperCardClassName}>
                  <p className="font-semibold text-slate-900">Portability guidance</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {structuredCoverage.map((item) => (
                      <div
                        className="rounded-[1rem] border border-[#d8ddd6] bg-white px-3 py-2"
                        key={item.label}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{item.count}</p>
                      </div>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-2">
                    <li>Core identity fields remain your safest export and sync anchors.</li>
                    <li>Structured secondary values improve merge quality and richer vCard output.</li>
                    <li>Custom fields, labels, favorites, and related people may remain Kontax-local depending on the target format.</li>
                    <li>Grouping these details here keeps the page powerful without making the homepage noisy.</li>
                  </ul>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-full bg-[#17352e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#20443b]"
                    type="submit"
                  >
                    Save changes
                  </button>
                  <Link
                    className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#2c8c74] hover:text-[#145c4f]"
                    href="/"
                  >
                    Back to contacts
                  </Link>
                </div>
              </form>
            </div>

            <section className={sectionCardClassName} id="contact-sync-origin">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">
                    Sync origin
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    Local detail with visible CardDAV linkage
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    This keeps the contact-level sync story readable: which remote book owns the
                    link, whether recovery work is open, and how much remote identity Kontax is already tracking.
                  </p>
                </div>
                <Link className="text-sm font-semibold text-[#1f7a67] hover:text-[#145c4f]" href="/sync">
                  Open sync center →
                </Link>
              </div>

              {syncLinks.length === 0 ? (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  This contact is local-only right now. It has not been linked to a CardDAV record yet,
                  so edits here stay inside Kontax until a future sync or relink attaches a remote source.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {syncLinks.map((link) => (
                    <article
                      className="rounded-[1.5rem] border border-[#d8ddd6] bg-[#fcfcfa] p-5"
                      key={link.id}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1f7a67]">
                          {link.syncAccount.label}
                        </p>
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {getSyncLinkStatusLabel(link)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {link.syncAccount.addressBookDisplayName ?? "CardDAV address book"} · account{" "}
                        {link.syncAccount.status.toLowerCase()}
                      </p>
                      <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        <p>Last link sync: {formatNullableTimestamp(link.lastSyncedAt)}</p>
                        <p>Account last sync: {formatNullableTimestamp(link.syncAccount.lastSyncedAt)}</p>
                        <p>Remote UID: {link.remoteUid ?? "Not stored yet"}</p>
                        <p>Remote ETag: {link.remoteETag ?? "Not stored yet"}</p>
                        <p>Remote href: {link.remoteHref ?? "Not stored yet"}</p>
                        <p>Open conflicts: {link._count.syncConflicts}</p>
                      </div>
                      {link.lastErrorMessage ? (
                        <p className="mt-4 rounded-[1.2rem] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                          {link.lastErrorCode ? `${link.lastErrorCode}: ` : ""}
                          {link.lastErrorMessage}
                        </p>
                      ) : (
                        <p className="mt-4 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                          This link is visible to the sync layer, so future CardDAV recovery and
                          conflict actions can target this contact directly.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="grid gap-6 self-start xl:sticky xl:top-24">
            <div className={sectionCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">
                Action rail
              </p>
              <div className="mt-4 grid gap-4">
                <div className="rounded-[1.4rem] border border-[#dfe7e1] bg-[#f8faf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Quick jumps
                  </p>
                  <div className="mt-3 grid gap-2">
                    <a
                      className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#2c8c74] hover:text-[#145c4f]"
                      href="#contact-snapshot"
                    >
                      Contact snapshot
                    </a>
                    <a
                      className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#2c8c74] hover:text-[#145c4f]"
                      href="#contact-editor"
                    >
                      Edit details
                    </a>
                    <a
                      className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#2c8c74] hover:text-[#145c4f]"
                      href="#contact-sync-origin"
                    >
                      View sync links
                    </a>
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-[#dfe7e1] bg-[#fcfcfa] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Record actions
                  </p>
                  <div className="mt-3 grid gap-3">
                    {contact.archivedAt ? (
                      <form action={restoreContact}>
                        <input name="contactId" type="hidden" value={contact.id} />
                        <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                        <button className="w-full rounded-full bg-[#1f7a67] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#176454]" type="submit">
                          Restore contact
                        </button>
                      </form>
                    ) : (
                      <form action={archiveContact}>
                        <input name="contactId" type="hidden" value={contact.id} />
                        <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                        <button className="w-full rounded-full border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:border-amber-400 hover:bg-amber-50" type="submit">
                          Archive contact
                        </button>
                      </form>
                    )}

                    {decisionId ? (
                      <form action={undoMergeContacts}>
                        <input name="decisionId" type="hidden" value={decisionId} />
                        <button className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#2c8c74] hover:text-[#145c4f]" type="submit">
                          Undo latest merge
                        </button>
                      </form>
                    ) : null}

                    <form action={permanentlyDeleteContact}>
                      <input name="contactId" type="hidden" value={contact.id} />
                      <button className="w-full rounded-full border border-rose-300 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-50" type="submit">
                        Permanently delete
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            <div className={sectionCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">
                Detail page posture
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <p>Read-first cards now make this page useful on mobile before you open the editor.</p>
                <p>Quick jumps reduce scrolling friction between overview, editing, and sync linkage.</p>
                <p>The detail surface is now closer to the calmer, denser workspace direction from `P8-01`.</p>
              </div>
            </div>

            <div className={sectionCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">
                Mobile and export fit
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <p>Apple Contacts and Android CardDAV clients remain parity targets for the core fields.</p>
                <p>When clients cannot round-trip richer metadata cleanly, Kontax should preserve it in its own model instead of flattening it away.</p>
                <p>That gives us better consumer trust now and a steadier path into deeper sync hardening later.</p>
              </div>
            </div>
          </aside>
        </section>
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
                          {share.status === "ACTIVE" && share.recipientContactId && share.lastPushedAt ? (
                            <span className="block text-[12px] text-[#8b938c]">
                              Last synced {formatTimestamp(share.lastPushedAt)}
                            </span>
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
