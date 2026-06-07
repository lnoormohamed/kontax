import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  archiveContact,
  undoMergeContacts,
  permanentlyDeleteContact,
  restoreContact,
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#07111d_45%,#0f172a_100%)] text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-12">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(2,8,23,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-cyan-200 hover:text-cyan-100" href="/">
              ← Back to dashboard
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
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
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Quick-save the core fields people update most often, then expand the advanced panels when you want richer structured detail for portability, merge quality, and future sync.
            </p>
          </div>

          <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-[#08101c] p-4 text-sm text-slate-300">
            <p>
              <span className="text-slate-500">Created:</span> {formatTimestamp(contact.createdAt)}
            </p>
            <p>
              <span className="text-slate-500">Updated:</span> {formatTimestamp(contact.updatedAt)}
            </p>
          </div>
        </div>

        {wasSaved ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Contact changes saved successfully.
          </div>
        ) : null}
        {wasMerged ? (
          <div className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
            Merge completed successfully. You can undo this merge from the merge audit card below while we are still in the reversible merge model.
          </div>
        ) : null}
        {wasMergeUndone ? (
          <div className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100 shadow-[0_20px_60px_rgba(251,191,36,0.12)]">
            Merge undo completed. The archived secondary contact has been restored and the primary contact has been rolled back to its pre-merge state.
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Sync origin</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                See whether this contact is local-only or already linked to CardDAV
              </h2>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">
                Ticket `P7-04` adds contact-level sync visibility so imported records are not a
                black box. You can see which CardDAV account owns the link, the remote identity
                Kontax is tracking, and whether recovery work is still open.
              </p>
            </div>
            <Link
              className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
              href="/sync"
            >
              Open sync center →
            </Link>
          </div>

          {syncLinks.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-5 text-sm text-slate-400">
              This contact is local-only right now. It has not been linked to a CardDAV record yet,
              so edits here stay inside Kontax until a future sync or relink attaches a remote
              source.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {syncLinks.map((link) => (
                <article
                  className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5"
                  key={link.id}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                      {link.syncAccount.label}
                    </p>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                      {getSyncLinkStatusLabel(link)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {link.syncAccount.addressBookDisplayName ?? "CardDAV address book"} · account{" "}
                    {link.syncAccount.status.toLowerCase()}
                  </p>
                  <div className="mt-4 grid gap-2 text-sm text-slate-400">
                    <p>Last link sync: {formatNullableTimestamp(link.lastSyncedAt)}</p>
                    <p>Account last sync: {formatNullableTimestamp(link.syncAccount.lastSyncedAt)}</p>
                    <p>Remote UID: {link.remoteUid ?? "Not stored yet"}</p>
                    <p>Remote ETag: {link.remoteETag ?? "Not stored yet"}</p>
                    <p>Remote href: {link.remoteHref ?? "Not stored yet"}</p>
                    <p>Open conflicts: {link._count.syncConflicts}</p>
                  </div>
                  {link.lastErrorMessage ? (
                    <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                      {link.lastErrorCode ? `${link.lastErrorCode}: ` : ""}
                      {link.lastErrorMessage}
                    </p>
                  ) : (
                    <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                      This link is visible to the sync layer, so future CardDAV recovery and
                      conflict actions can target this contact directly.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Contact details</p>
              <h2 className="text-2xl font-semibold text-white">Quick save first, expand when needed</h2>
            </div>

            <form action={updateContact} className="mt-6 grid gap-6">
              <input name="contactId" type="hidden" value={contact.id} />
              <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}?saved=1`} />

              <section className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <p className="text-sm font-semibold text-white">Essentials</p>
                  <p className="mt-1 text-sm text-slate-400">
                    These are the fields we expect to round-trip most cleanly across CSV, vCard, merge, and future sync flows.
                  </p>
                </div>

                <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                  <span>Full name</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                    defaultValue={contact.fullName}
                    name="fullName"
                    required
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Email</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                    defaultValue={contact.email ?? ""}
                    name="email"
                    type="email"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Phone</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                    defaultValue={contact.phone ?? ""}
                    name="phone"
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Company</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                    defaultValue={contact.company ?? ""}
                    name="company"
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Job title</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                    defaultValue={contact.jobTitle ?? ""}
                    name="jobTitle"
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                  <span>Notes</span>
                  <textarea
                    className="min-h-32 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                    defaultValue={contact.notes ?? ""}
                    name="notes"
                  />
                </label>
              </section>

              <details className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Profile and organization</p>
                      <p className="text-sm text-slate-400">
                        Split names, labels, favorite state, and avatar metadata for a richer personal profile.
                      </p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                      Advanced
                    </span>
                  </div>
                </summary>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Prefix</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={contact.namePrefix ?? ""} name="namePrefix" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>First name</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={contact.firstName ?? ""} name="firstName" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Middle name</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={contact.middleName ?? ""} name="middleName" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Last name</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={contact.lastName ?? ""} name="lastName" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Suffix</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={contact.nameSuffix ?? ""} name="nameSuffix" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Nickname</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={contact.nickname ?? ""} name="nickname" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                    <span>Avatar URL</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={contact.avatarUrl ?? ""} name="avatarUrl" type="url" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Labels</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={labelsValue} name="labels" placeholder="Family, VIP, School" type="text" />
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <input className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300 focus:ring-cyan-300" defaultChecked={contact.isFavorite} name="isFavorite" type="checkbox" value="true" />
                    <span>Favorite contact</span>
                  </label>
                </div>
              </details>

              <details className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Structured communication and addresses</p>
                      <p className="text-sm text-slate-400">
                        Add labels, secondary values, and structured address parts without cluttering the quick-edit surface.
                      </p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                      Advanced
                    </span>
                  </div>
                </summary>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Email label</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={primaryEmailEntry?.label ?? ""} name="emailLabel" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                    <span>Additional emails</span>
                    <textarea className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={additionalEmails} name="additionalEmails" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Phone label</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={primaryPhoneEntry?.label ?? ""} name="phoneLabel" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                    <span>Additional phones</span>
                    <textarea className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={additionalPhones} name="additionalPhones" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Address</span>
                    <textarea className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={contact.address ?? ""} name="address" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Address label</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={primaryAddressEntry?.label ?? ""} name="addressLabel" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Country or region</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={primaryAddressEntry?.countryOrRegion ?? ""} name="countryOrRegion" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Street line 1</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={primaryAddressEntry?.streetLine1 ?? ""} name="streetLine1" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Street line 2</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={primaryAddressEntry?.streetLine2 ?? ""} name="streetLine2" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>City or town</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={primaryAddressEntry?.cityOrTown ?? ""} name="cityOrTown" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Postcode</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={primaryAddressEntry?.postcode ?? ""} name="postcode" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>PO box</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={primaryAddressEntry?.poBox ?? ""} name="poBox" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                    <span>Additional addresses</span>
                    <textarea className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={additionalAddresses} name="additionalAddresses" />
                  </label>
                </div>
              </details>

              <details className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Dates, websites, relationships, and custom context</p>
                      <p className="text-sm text-slate-400">
                        These fields deepen the contact record. Some export cleanly to vCard, while others may remain Kontax-local depending on the target format.
                      </p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                      Advanced
                    </span>
                  </div>
                </summary>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Website</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={contact.website ?? ""} name="website" type="url" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Website label</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={primaryWebsiteEntry?.label ?? ""} name="websiteLabel" type="text" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                    <span>Additional websites</span>
                    <textarea className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={additionalWebsites} name="additionalWebsites" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Birthday</span>
                    <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={contact.birthday ?? ""} name="birthday" type="date" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                    <span>Significant dates</span>
                    <textarea className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={significantDatesValue} name="significantDates" placeholder="Anniversary | 2018-06-09" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                    <span>Related people</span>
                    <textarea className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={relatedPeopleValue} name="relatedPeople" placeholder="Spouse | Alex Smith" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                    <span>Custom fields</span>
                    <textarea className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300" defaultValue={customFieldsValue} name="customFields" placeholder="Assistant | Jamie" />
                  </label>
                </div>
              </details>

              <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/10 p-5 text-sm text-cyan-100">
                <p className="font-semibold text-white">Portability guidance</p>
                <ul className="mt-3 space-y-2 text-sm text-cyan-50/90">
                  <li>Canonical fields like full name, primary email, primary phone, birthday, and primary address should remain your safest export and sync anchors.</li>
                  <li>Labeled secondary values and structured addresses improve merge quality and vCard fidelity, but CSV targets may flatten them depending on the mapping profile.</li>
                  <li>Related people, labels, favorites, avatars, and custom fields are valuable in Kontax even when a destination format only supports them partially.</li>
                  <li>iPhone Contacts and Android CardDAV clients should handle the core identity fields well, while richer metadata may degrade gracefully or stay Kontax-local until client support is confirmed.</li>
                </ul>
              </div>

              <div>
                <button className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200" type="submit">
                  Save changes
                </button>
              </div>
            </form>
          </div>

          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Lifecycle</p>
              <div className="mt-4 grid gap-3">
                {contact.archivedAt ? (
                  <form action={restoreContact}>
                    <input name="contactId" type="hidden" value={contact.id} />
                    <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                    <button className="w-full rounded-full bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200" type="submit">
                      Restore contact
                    </button>
                  </form>
                ) : (
                  <form action={archiveContact}>
                    <input name="contactId" type="hidden" value={contact.id} />
                    <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                    <button className="w-full rounded-full border border-amber-300/30 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-200 hover:text-white" type="submit">
                      Archive contact
                    </button>
                  </form>
                )}

                {decisionId ? (
                  <form action={undoMergeContacts}>
                    <input name="decisionId" type="hidden" value={decisionId} />
                    <button className="w-full rounded-full border border-cyan-300/30 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white" type="submit">
                      Undo latest merge
                    </button>
                  </form>
                ) : null}

                <form action={permanentlyDeleteContact}>
                  <input name="contactId" type="hidden" value={contact.id} />
                  <button className="w-full rounded-full border border-rose-300/30 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:border-rose-200 hover:text-white" type="submit">
                    Permanently delete
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 text-sm text-slate-300 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Editing mode</p>
              <div className="mt-4 space-y-3">
                <p>Quick fields stay visible so everyday edits feel light and fast.</p>
                <p>Advanced panels let us keep richer consumer-grade detail without overwhelming simple contact maintenance.</p>
                <p>That structure also lines up with our import, merge, and future CardDAV roadmap.</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Mobile parity</p>
              <div className="mt-4 space-y-3">
                <p>Kontax treats Apple and Android contact apps as parity targets for core fields, not as hard constraints on every richer field.</p>
                <p>When a mobile client cannot round-trip labels, related people, custom fields, or avatar metadata cleanly, Kontax should preserve that detail in its own model instead of discarding it.</p>
                <p>That gives us graceful degradation now and a cleaner path into CardDAV compatibility hardening later.</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
