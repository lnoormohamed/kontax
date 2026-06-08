import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ContactPhoneticAssistant } from "~/app/_components/contact-phonetic-assistant";
import {
  archiveContact,
  undoMergeContacts,
  permanentlyDeleteContact,
  restoreContact,
  toggleFavoriteContact,
  updateContact,
} from "~/app/actions/contacts";
import { auth } from "~/server/auth";
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

const getPrimaryStructuredEntry = <T,>(value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  return value[0] as T;
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
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!contact) {
    notFound();
  }

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

  const additionalEmails = parseContactStringArray(contact.emailAddresses)
    .filter((item) => item !== contact.email)
    .join("\n");
  const additionalPhones = parseContactStringArray(contact.phoneNumbers)
    .filter((item) => item !== contact.phone)
    .join("\n");
  const additionalAddresses = getFormattedAddressArray(contact.postalAddresses)
    .filter((item) => item !== contact.address)
    .join("\n");
  const primaryEmailEntry = getPrimaryStructuredEntry<{ label?: string }>(contact.emailEntries);
  const primaryPhoneEntry = getPrimaryStructuredEntry<{ label?: string }>(contact.phoneEntries);
  const primaryAddressEntry = getPrimaryStructuredEntry<{
    label?: string;
    countryOrRegion?: string;
    streetLine1?: string;
    streetLine2?: string;
    cityOrTown?: string;
    postcode?: string;
    poBox?: string;
  }>(contact.addressEntries);
  const primaryWebsiteEntry = getPrimaryStructuredEntry<{ label?: string }>(contact.websiteEntries);
  const labelsValue = Array.isArray(contact.labels) ? contact.labels.join(", ") : "";
  const additionalWebsites =
    Array.isArray(contact.websiteEntries)
      ? contact.websiteEntries
          .map((entry) => {
            if (!entry || typeof entry !== "object" || !("value" in entry)) {
              return undefined;
            }

            const value = (entry as { value?: string }).value;
            return typeof value === "string" && value !== contact.website ? value : undefined;
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

  const detailStats = [
    {
      label: "Primary email",
      value: contact.email ?? "Missing",
    },
    {
      label: "Primary phone",
      value: contact.phone ?? "Missing",
    },
    {
      label: "Company",
      value: contact.company ?? "Independent",
    },
    {
      label: "Phonetic",
      value: phoneticSummary.nameReading ?? phoneticSummary.companyReading ?? "Not set",
    },
  ];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5efe6_0%,#edf3ef_34%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
        <section className="overflow-hidden rounded-[2.4rem] border border-[#d8ddd6] bg-[#17352e] text-white shadow-[0_25px_80px_rgba(23,53,46,0.18)]">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
            <div>
              <Link className="text-sm font-semibold text-[#9fd6c6] hover:text-white" href="/">
                ← Back to contacts
              </Link>

              <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.8rem] bg-[#dcefe8] text-2xl font-semibold text-[#145c4f]">
                  {getInitials(contact.fullName)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-4xl font-semibold tracking-tight text-white">{contact.fullName}</h1>
                    {contact.archivedAt ? (
                      <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                        Archived
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                        Active
                      </span>
                    )}
                    {contact.isFavorite ? (
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                        Favorite
                      </span>
                    ) : null}
                  </div>

                  {phoneticSummary.nameReading || phoneticSummary.companyReading ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-[#d6e6df]">
                      {phoneticSummary.nameReading ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                          Phonetic name: {phoneticSummary.nameReading}
                        </span>
                      ) : null}
                      {phoneticSummary.companyReading ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                          Phonetic company: {phoneticSummary.companyReading}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d6e6df]">
                    Edit this contact in grouped sections so everyday updates stay light, while the
                    richer metadata Kontax needs for import quality, merge confidence, and future
                    CardDAV parity stays close at hand.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {detailStats.map((item) => (
                      <div
                        className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-3"
                        key={item.label}
                      >
                        <p className="text-xs uppercase tracking-[0.18em] text-[#9fd6c6]">{item.label}</p>
                        <p className="mt-2 truncate text-sm font-medium text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <form action={toggleFavoriteContact}>
                      <input name="contactId" type="hidden" value={contact.id} />
                      <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                      <button
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          contact.isFavorite
                            ? "border border-cyan-300/40 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20"
                            : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                        }`}
                        type="submit"
                      >
                        {contact.isFavorite ? "Unstar favorite" : "Star favorite"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.8rem] border border-white/10 bg-white/5 p-5 text-sm text-[#d6e6df]">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <span className="uppercase tracking-[0.18em] text-[#9fd6c6]">Record health</span>
                <span className="text-white">{syncLinks.length > 0 ? "Synced" : "Local only"}</span>
              </div>
              <p>
                <span className="text-[#9fd6c6]">Created:</span> {formatTimestamp(contact.createdAt)}
              </p>
              <p>
                <span className="text-[#9fd6c6]">Updated:</span> {formatTimestamp(contact.updatedAt)}
              </p>
              <p>
                <span className="text-[#9fd6c6]">Linked sources:</span> {syncLinks.length}
              </p>
              <p>
                <span className="text-[#9fd6c6]">Labels:</span> {labelsValue || "None yet"}
              </p>
              <p>
                <span className="text-[#9fd6c6]">Structured coverage:</span> {enrichedFieldCount} /{" "}
                {structuredCoverage.length} areas
              </p>
            </div>
          </div>
        </section>

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

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-6">
            <div className={sectionCardClassName}>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">
                  Edit contact
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Grouped for faster everyday editing
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-500">
                  The core profile stays up front, then communication, address, and richer personal
                  context each get their own space instead of hiding behind stacked advanced panels.
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
                      <span>Phonetic first name</span>
                      <input
                        className={inputClassName}
                        defaultValue={contact.phoneticFirstName ?? ""}
                        name="phoneticFirstName"
                        type="text"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Middle name</span>
                      <input className={inputClassName} defaultValue={contact.middleName ?? ""} name="middleName" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Last name</span>
                      <input className={inputClassName} defaultValue={contact.lastName ?? ""} name="lastName" type="text" />
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
                      <span>Company</span>
                      <input className={inputClassName} defaultValue={contact.company ?? ""} name="company" type="text" />
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
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Job title</span>
                      <input className={inputClassName} defaultValue={contact.jobTitle ?? ""} name="jobTitle" type="text" />
                    </label>
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
                    <div className="rounded-[1.2rem] border border-[#dfe7e1] bg-[#f7fbf9] px-4 py-3 text-sm text-slate-600 lg:col-span-2">
                      Kontax builds the display name from the person fields when present, and falls back to company for organization-only contacts.
                    </div>
                    <div className="rounded-[1.2rem] border border-[#dfe7e1] bg-[#f7fbf9] px-4 py-3 text-sm text-slate-600 lg:col-span-2">
                      If phonetic auto-fill is enabled in settings, Kontax only fills these values when they
                      are blank. Chinese names use real phonetic generation, fallback phonetic values support
                      other non-Latin scripts, and manual edits always win.
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.8rem] border border-[#d8ddd6] bg-[#fdfdfb] p-5">
                  <div className="mb-5">
                    <p className="text-lg font-semibold text-slate-900">Communication</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Keep primary email and phone clear, then layer in labeled secondary contact
                      methods where portability and merge quality benefit from the extra structure.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Primary email</span>
                      <input className={inputClassName} defaultValue={contact.email ?? ""} name="email" type="email" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Email label</span>
                      <input className={inputClassName} defaultValue={primaryEmailEntry?.label ?? ""} name="emailLabel" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Additional emails</span>
                      <textarea className={textareaClassName} defaultValue={additionalEmails} name="additionalEmails" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Primary phone</span>
                      <input className={inputClassName} defaultValue={contact.phone ?? ""} name="phone" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Phone label</span>
                      <input className={inputClassName} defaultValue={primaryPhoneEntry?.label ?? ""} name="phoneLabel" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Additional phones</span>
                      <textarea className={textareaClassName} defaultValue={additionalPhones} name="additionalPhones" />
                    </label>
                  </div>

                  <div className="mt-4 rounded-[1.4rem] border border-[#dfe7e1] bg-[#f7fbf9] p-4 text-sm text-slate-600">
                    One entry per line works well for secondary values. Primary email and phone stay
                    your strongest export and sync anchors.
                  </div>
                </section>

                <section className="rounded-[1.8rem] border border-[#d8ddd6] bg-[#fdfdfb] p-5">
                  <div className="mb-5">
                    <p className="text-lg font-semibold text-slate-900">Address and web presence</p>
                    <p className="mt-1 text-sm text-slate-500">
                      This section keeps a human-readable address close to the structured parts that
                      matter for vCard fidelity and cleaner future sync behavior.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
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
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Website</span>
                      <input className={inputClassName} defaultValue={contact.website ?? ""} name="website" type="url" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Website label</span>
                      <input className={inputClassName} defaultValue={primaryWebsiteEntry?.label ?? ""} name="websiteLabel" type="text" />
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Additional websites</span>
                      <textarea className={textareaClassName} defaultValue={additionalWebsites} name="additionalWebsites" />
                    </label>
                  </div>
                </section>

                <section className="rounded-[1.8rem] border border-[#d8ddd6] bg-[#fdfdfb] p-5">
                  <div className="mb-5">
                    <p className="text-lg font-semibold text-slate-900">Personal context</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Keep birthdays, important relationships, custom notes, and Kontax-specific
                      context in one place so the record feels personal rather than purely transactional.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Birthday</span>
                      <input className={inputClassName} defaultValue={contact.birthday ?? ""} name="birthday" type="date" />
                    </label>
                    <div className="rounded-[1.2rem] border border-[#dfe7e1] bg-[#f7fbf9] p-4 text-sm text-slate-600">
                      Use the primary birthday field for the most portable date. Extra dates can be
                      added below in <span className="font-medium text-slate-800">Label | YYYY-MM-DD</span> format.
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
                    <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                      <span>Notes</span>
                      <textarea className="min-h-40 rounded-[1.2rem] border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#67b59f] focus:bg-white" defaultValue={contact.notes ?? ""} name="notes" />
                    </label>
                  </div>
                </section>

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

            <section className={sectionCardClassName}>
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
              <div className="mt-4 grid gap-3">
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

            <div className={sectionCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">
                Editing posture
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <p>Identity and communication fields stay up front so normal edits remain quick.</p>
                <p>Structured address, websites, and personal context are easier to find because they now live in dedicated cards instead of nested disclosure panels.</p>
                <p>This page is now better aligned with the denser homepage introduced in `P8-01`.</p>
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
      </div>
    </main>
  );
}
