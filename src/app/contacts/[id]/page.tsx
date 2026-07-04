import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { ContactHeroAvatar } from "~/app/_components/contact-hero-avatar";
import { ContactHistory } from "~/app/_components/contact-history";
import { ContactFamilyPanel } from "~/app/_components/contact-family-panel";
import { ContactReminderOverride } from "~/app/_components/contact-reminder-override";
import {
  ContactDetailHeaderBar,
  ContactEditProvider,
  ContactInlineEditor,
} from "~/app/_components/contact-inline-editor";
import { MobileContactDetail } from "~/app/_components/mobile-contact-detail";
import { ContactSharing } from "~/app/_components/contact-sharing";
import { ContactBooksBlock } from "~/app/_components/contact-books-block";
import { CopyMonoRow } from "~/app/_components/copy-field";
import { LastUpdatedBy } from "~/app/_components/last-updated-by";
import { ContactExportButton } from "~/app/_components/contact-export-button";
import { MoreMenu } from "~/app/_components/more-menu";
import { MergeWithButton } from "~/app/_components/merge-picker-button";
import { LabelChip } from "~/app/_components/label-chip";
import { RecentlyViewedTracker } from "~/app/_components/search-results";
import { SourceBadge } from "~/app/_components/source-badge";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import {
  archiveContact,
  permanentlyDeleteContact,
  restoreContact,
  toggleEmergencyContact,
  toggleFavoriteContact,
} from "~/app/actions/contacts";
import { addContactToFamilyBook } from "~/app/actions/family";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";
import { listMemberships } from "~/server/contact-book-membership";
import { getContactFamilyContext, getUserFamilyMembership } from "~/server/family-access";
import { resolveContactEditAccess } from "~/server/shared-access";
import { getAccessibleTeamBooks, getContactTeamContext } from "~/server/team-access";
import { getPublicOrigin } from "~/lib/public-origin";
import { DEFAULT_PREFERENCES, type UserPreferences } from "~/lib/preferences";
import { buildUpcomingContactDates } from "~/lib/contact-date-events";
import { formatDate, formatStoredDate } from "~/lib/dates";
import { getDisplayName } from "~/lib/display-name";
import {
  providerSupportsSignificantDates,
  resolveSyncProviderCapabilityProfile,
} from "~/server/sync-provider-capabilities";

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

const getInitials = (primary: string | null | undefined, fallback?: string | null) => {
  const src = primary?.trim() ?? fallback?.trim() ?? "";
  return src
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

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
const tintForName = (primary: string | null | undefined, fallback?: string | null): [string, string] => {
  const src = primary?.trim() ?? fallback?.trim() ?? "?";
  let hash = 0;
  for (let i = 0; i < src.length; i++) hash = ((hash * 31 + src.charCodeAt(i)) >>> 0);
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]!;
};

const formatUpcomingDateLead = (daysUntil: number) => {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
};

function UpcomingDatesPanel({
  events,
  dateFormat,
  compact = false,
  providerHasDateLimit = false,
}: {
  events: Array<{ key: string; label: string; value: string; daysUntil: number }>;
  dateFormat: NonNullable<UserPreferences["dateFormat"]>;
  compact?: boolean;
  providerHasDateLimit?: boolean;
}) {
  if (events.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white">
      <div className={compact ? "px-4 py-3" : "px-5 pt-3.5"}>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
          Upcoming dates
        </h3>
      </div>
      {!compact ? <div className="mt-3 h-px bg-[#e9ece7]" /> : null}
      <div className={compact ? "grid gap-2 px-4 pb-3" : "grid gap-3 px-5 py-4"}>
        {events.map((event) => (
          <div className="flex items-start justify-between gap-3" key={event.key}>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-[#1d2823]">{event.label}</div>
              <div className="mt-0.5 text-[12.5px] text-[#5c655e]">
                {formatStoredDate(event.value, dateFormat) ?? event.value}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-[#f2f4f0] px-2.5 py-1 text-[11px] font-semibold text-[#5c655e]">
              {formatUpcomingDateLead(event.daysUntil)}
            </span>
          </div>
        ))}
        {providerHasDateLimit ? (
          <p className="rounded-[10px] bg-[#f8faf8] px-3 py-2 text-[12px] leading-[1.5] text-[#5c655e]">
            Some linked providers only store birthdays. Extra dates stay in Kontax and still
            power reminders and calendar feeds here.
          </p>
        ) : null}
      </div>
    </section>
  );
}


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
    const h = await headers();
    const next = h.get("x-pathname") ?? "/contacts";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const dateFormat = (session.user.preferences ?? DEFAULT_PREFERENCES).dateFormat;

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

  // Access mirrors the contacts list exactly (contacts/page.tsx): a contact is
  // viewable if the user owns it OR it lives in a shared family/team book the
  // user can read. Without this, members saw shared contacts in the list but
  // hit a 404 when opening them. Do not widen beyond the list's access.
  const [familyForAccess, teamBooksForAccess] = await Promise.all([
    getUserFamilyMembership(session.user.id),
    getAccessibleTeamBooks(session.user.id),
  ]);
  const accessibleBookIds = [
    familyForAccess?.bookId,
    ...teamBooksForAccess.map((b) => b.id),
  ].filter((bookId): bookId is string => Boolean(bookId));

  const contact = await db.contact.findFirst({
    where: {
      id,
      OR: [
        { userId: session.user.id },
        ...(accessibleBookIds.length > 0
          ? [{ groupContacts: { some: { groupAddressBookId: { in: accessibleBookIds } } } }]
          : []),
      ],
    },
    select: {
      id: true,
      bookId: true,
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
      isEmergency: true,
      labels: true,
      significantDates: true,
      relatedPeople: true,
      customFields: true,
      reminderLeadDaysOverride: true,
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

  const [shellPlan, shellPeople, shellFavorites, shellArchived, shellDuplicates, viewerForReminders, labelRegistry] =
    await Promise.all([
      getUserPlanSummary(session.user.id),
      db.contact.count({ where: { userId: session.user.id, archivedAt: null } }),
      db.contact.count({ where: { userId: session.user.id, archivedAt: null, isFavorite: true } }),
      db.contact.count({ where: { userId: session.user.id, NOT: { archivedAt: null } } }),
      db.mergeSuggestion.count({ where: { userId: session.user.id, status: "OPEN" } }),
      db.user.findUnique({ where: { id: session.user.id }, select: { reminderLeadDays: true } }),
      db.label.findMany({ where: { userId: session.user.id }, select: { name: true, color: true } }),
    ]);
  const labelColors = Object.fromEntries(labelRegistry.map((l) => [l.name.toLowerCase(), l.color]));
  const contactLabels = Array.isArray(contact.labels) ? (contact.labels as string[]).filter((v) => typeof v === "string") : [];
  // P22-10: show the per-contact reminder lead-time control when the contact has
  // a date that can fire a reminder.
  const reminderUserDefault = viewerForReminders?.reminderLeadDays ?? 7;
  const reminderHasDate =
    Boolean(contact.birthday) ||
    (Array.isArray(contact.significantDates) && contact.significantDates.length > 0);
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

  // Sharing (Phase 12): owner-side shares — only needed on the sharing tab.
  const [shareOrigin, contactShares] = await Promise.all([
    detailTab === "sharing" ? getPublicOrigin() : Promise.resolve(""),
    detailTab === "sharing"
      ? db.contactShare.findMany({
          where: { contactId: contact.id, ownerUserId: session.user.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            shareType: true,
            token: true,
            status: true,
            expiresAt: true,
            downloadCount: true,
            maxDownloads: true,
            recipientEmail: true,
            recipientContactId: true,
            lastPushedAt: true,
            lastErrorCode: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const vcardLinks = contactShares.filter(
    (share) => share.shareType === "VCARD_LINK" && share.status === "ACTIVE",
  );
  const staticShares = contactShares.filter((share) => share.shareType === "STATIC_COPY");
  const liveShares = contactShares.filter((share) => share.shareType === "LIVE_SYNC");
  const staticShareEnabled = shellPlan.entitlements.staticShareEnabled;
  const liveShareEnabled = shellPlan.entitlements.liveShareEnabled;
  // This contact is a live copy the current user received (recipient side).
  const isLiveReceived = contact.sourceType === "SHARED_LIVE";

  // Family (P13-03): can this private contact be added to the shared family book?
  const [familyMembership, familyContext, teamContext] = await Promise.all([
    getUserFamilyMembership(session.user.id),
    getContactFamilyContext(contact.id),
    getContactTeamContext(contact.id),
  ]);
  const isSharedContact = Boolean(familyContext);
  // Can the viewer actually edit this contact? Mirrors the server gate used by
  // updateContact / the inline editor, so the mobile edit entry point (Edit /
  // FAB) is shown only when a save would succeed — view-only shared contacts get
  // a Read-only chip instead (P24B-DB19 variance gating).
  const editAccess = await resolveContactEditAccess(session.user.id, contact.id);
  const canEditContact = !isLiveReceived && editAccess.allowed;
  const teamBookLabel = teamContext ? `${teamContext.teamName} · ${teamContext.bookName}` : null;
  const canAddToFamily =
    Boolean(familyMembership?.canEdit) && !isSharedContact && !teamContext;

  // P15-03: "Shared with your family" panel data (members + last editor).
  const [familyMembers, lastFamilyEvent] = isSharedContact && familyContext
    ? await Promise.all([
        db.groupMember.findMany({
          where: { groupId: familyContext.groupId, inviteStatus: "ACCEPTED" },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          select: { userId: true, role: true, canEdit: true, user: { select: { name: true, email: true } } },
        }),
        db.activityEvent.findFirst({
          where: { contactId: contact.id, eventType: { in: ["CONTACT_UPDATED", "CONTACT_CREATED"] } },
          orderBy: { createdAt: "desc" },
          select: { actor: true, actorDetail: true, createdAt: true },
        }),
      ])
    : [[], null];
  const familyPanelMembers = familyMembers.map((m) => ({
    name: m.user?.name?.trim() ?? m.user?.email ?? "Member",
    access: m.role === "OWNER" ? ("owner" as const) : m.canEdit ? ("edit" as const) : ("view" as const),
    you: m.userId === session.user.id,
  }));
  const lastEditedBy = lastFamilyEvent
    ? (lastFamilyEvent.actorDetail?.replace(/ \(CardDAV\)$/, "") ??
       (lastFamilyEvent.actor === "FAMILY_MEMBER" ? "a family member" : "you"))
    : null;
  const lastEditedAt = lastFamilyEvent ? formatDate(lastFamilyEvent.createdAt, dateFormat) : null;

  // P40-08: the contact-detail "Books" block — which personal books this contact
  // lives in, plus the user's books for "Add to book". Personal contacts only
  // (shared/team contacts live in GroupContact, not personal books) and only on
  // the details tab.
  const isPersonalContact = !isSharedContact && !teamContext;
  const [contactMemberships, userBooksForBlock] =
    detailTab === "details" && isPersonalContact
      ? await Promise.all([
          listMemberships(db, contact.id),
          db.addressBook.findMany({
            where: { userId: session.user.id, archivedAt: null },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
            select: { id: true, name: true },
          }),
        ])
      : [[] as Awaited<ReturnType<typeof listMemberships>>, [] as { id: string; name: string }[]];
  const bookNameById = new Map(userBooksForBlock.map((b) => [b.id, b.name]));
  const booksBlockMemberships = contactMemberships
    .filter((m) => bookNameById.has(m.addressBookId))
    .map((m) => ({
      bookId: m.addressBookId,
      name: bookNameById.get(m.addressBookId)!,
      isPrimary: m.isPrimary,
    }));

  // Shared books — only needed on the sharing tab.
  const sharedBooks = await (detailTab === "sharing"
    ? db.group.findMany({
        where: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, inviteStatus: "ACCEPTED" } } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          _count: { select: { members: { where: { inviteStatus: "ACCEPTED" } } } },
          members: {
            where: { inviteStatus: "ACCEPTED" },
            orderBy: { joinedAt: "asc" },
            select: {
              id: true,
              role: true,
              canEdit: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      })
    : Promise.resolve([]));
  const privateBook = await (detailTab === "sharing" && !familyContext && !teamContext
    ? db.addressBook.findFirst({
        where: contact.bookId
          ? { id: contact.bookId, userId: session.user.id }
          : { userId: session.user.id, isDefault: true },
        select: { name: true, isDefault: true },
      })
    : Promise.resolve(null));
  const sharingPlacement = familyContext
    ? {
        title: `Shared book: ${familyContext.groupName}`,
        detail: "This contact lives in your family book, so everyone with access sees the same shared record.",
      }
    : teamContext
      ? {
          title: `Shared team book: ${teamBookLabel ?? teamContext.bookName}`,
          detail: "This contact belongs to a team book. Share links come from this shared record, while team permissions still control who can edit it inside Kontax.",
        }
      : {
          title: `Private book: ${privateBook?.name ?? "Default book"}`,
          detail:
            "This contact stays in your private library. Remote sync settings and shared-book access are managed separately, so you can organise books without changing how this share works.",
        };

  const syncLinks = await (detailTab === "details"
    ? db.syncContactLink.findMany({
        where: {
          contactId: contact.id,
          syncAccount: { userId: session.user.id },
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
              provider: true,
              baseUrl: true,
              addressBookUrl: true,
              settings: {
                select: { capabilityProfileOverride: true },
              },
            },
          },
          _count: { select: { syncConflicts: true } },
        },
      })
    : Promise.resolve([]));


  const editorContact = {
    id: contact.id,
    fullName: contact.fullName,
    avatarUrl: contact.avatarUrl,
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
  };
  const editorEntries = {
    emails: normaliseSimple(contact.emailEntries, contact.email, "Work"),
    phones: normaliseSimple(contact.phoneEntries, contact.phone, "Mobile"),
    websites: normaliseSimple(contact.websiteEntries, contact.website, "Portfolio"),
    addresses: normaliseAddresses(contact.addressEntries, contact.address),
    dates: normaliseDates(contact.significantDates),
    related: normaliseRelated(contact.relatedPeople),
  };
  const upcomingDateEvents = buildUpcomingContactDates(
    {
      birthday: contact.birthday,
      significantDates: (contact.significantDates ?? []) as Array<{
        label?: string | null;
        date?: string | null;
      }>,
    },
    { limit: 3 },
  );
  const linkedProviderHasDateLimit =
    editorEntries.dates.length > 0 &&
    syncLinks.some((link) => {
      const profile = resolveSyncProviderCapabilityProfile({
        provider: link.syncAccount.provider,
        baseUrl: link.syncAccount.baseUrl,
        addressBookUrl: link.syncAccount.addressBookUrl,
        label:
          link.syncAccount.label ?? link.syncAccount.addressBookDisplayName ?? null,
        capabilityProfileOverride:
          link.syncAccount.settings?.capabilityProfileOverride ?? null,
      });
      return !providerSupportsSignificantDates(profile);
    });

  // P24B-DB19: prefill payload for the mobile edit sheet (full field coverage).
  const sheetInitial = {
    id: contact.id,
    avatarUrl: contact.avatarUrl,
    firstName: contact.firstName,
    lastName: contact.lastName,
    company: contact.company,
    phones: editorEntries.phones,
    emails: editorEntries.emails,
    websites: editorEntries.websites,
    addresses: editorEntries.addresses.map((a) => ({
      label: a.label,
      street: a.street,
      city: a.city,
      postcode: a.postcode,
      country: a.country,
    })),
    birthday: contact.birthday,
    significantDates: editorEntries.dates.filter(
      (d) => d.label.toLowerCase() !== "birthday" && d.value !== contact.birthday,
    ),
    relatedPeople: editorEntries.related,
    notes: contact.notes,
    middleName: contact.middleName,
    namePrefix: contact.namePrefix,
    nameSuffix: contact.nameSuffix,
    nickname: contact.nickname,
    phoneticFirstName: contact.phoneticFirstName,
    phoneticLastName: contact.phoneticLastName,
    phoneticCompany: contact.phoneticCompany,
    jobTitle: contact.jobTitle,
    department: contact.department,
    customFields: asArray(contact.customFields)
      .map((e) => ({ label: str(e.label), value: str(e.value) }))
      .filter((e) => e.label.length > 0 || e.value.length > 0),
  };

  const [avatarBg, avatarFg] = tintForName(contact.fullName, contact.company);

  return (
    <AppShell
      account={shellAccount}
      counts={shellCounts}
    >
      <RecentlyViewedTracker id={contact.id} name={contact.fullName} company={contact.company} />
      <ContactEditProvider
        contact={editorContact}
        editableShared={!isLiveReceived}
        entries={editorEntries}
        dateFormat={dateFormat}
      >

      {/* ── MOBILE layout (< md) ─────────────────────────────────────── */}
      <div className="md:hidden">
        <MobileContactDetail
          archiveOrRestoreAction={contact.archivedAt ? restoreContact : archiveContact}
          avatarBg={avatarBg}
          avatarFg={avatarFg}
          avatarUrl={contact.avatarUrl}
          backHref="/contacts"
          contactId={contact.id}
          contactName={contact.fullName}
          detailTab={detailTab}
          editInitial={sheetInitial}
          email={contact.email}
          initials={getInitials(contact.fullName, contact.company)}
          isArchived={Boolean(contact.archivedAt)}
          isEditable={canEditContact}
          isFavorite={contact.isFavorite}
          labelColors={labelColors}
          labels={contactLabels}
          phone={contact.phone}
          subtitle={[contact.jobTitle, contact.company].filter(Boolean).join(" · ") || null}
          toggleFavoriteAction={toggleFavoriteContact}
        >
          {detailTab === "details" ? (
            <div className="grid gap-4 px-4 py-4">
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
              {contact.archivedAt ? (
                <div className="flex items-center gap-2.5 rounded-[12px] bg-[#f6edd9] px-4 py-2.5 text-[13px] text-[#7a5a1a]">
                  <WorkspaceIcon name="archive" size={15} strokeWidth={2} />
                  This contact is archived — it won&apos;t appear in your main list.
                </div>
              ) : null}
              {isSharedContact && familyContext ? (
                <ContactFamilyPanel
                  groupName={familyContext.groupName}
                  lastEditedAt={lastEditedAt}
                  lastEditedBy={lastEditedBy}
                  members={familyPanelMembers}
                  viewerCanEdit={Boolean(familyMembership?.canEdit)}
                />
              ) : null}
              <ContactInlineEditor />
              <UpcomingDatesPanel
                compact
                dateFormat={dateFormat}
                events={upcomingDateEvents}
                providerHasDateLimit={linkedProviderHasDateLimit}
              />
              {reminderHasDate ? (
                <ContactReminderOverride
                  contactId={contact.id}
                  override={contact.reminderLeadDaysOverride}
                  userDefault={reminderUserDefault}
                />
              ) : null}
            </div>
          ) : null}
          {detailTab === "sharing" ? (
            <div className="px-4 py-4">
              <ContactSharing
                books={sharedBooks.map((b) => ({
                  id: b.id,
                  name: b.name,
                  type: b.type,
                  memberCount: b._count.members,
                  members: b.members
                    .filter((m) => m.user !== null)
                    .map((m) => ({
                      id: m.id,
                      name: m.user!.name?.trim() ?? m.user!.email,
                      role: m.role === "OWNER" ? ("OWNER" as const) : m.canEdit ? ("CAN_EDIT" as const) : ("CAN_VIEW" as const),
                    })),
                }))}
                contactId={contact.id}
                contactName={contact.fullName}
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
                placement={sharingPlacement}
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
                  maxDownloads: l.maxDownloads,
                }))}
              />
            </div>
          ) : null}
          {detailTab === "history" ? (
            <div className="px-4 py-4" id="contact-history">
              <ContactHistory contactId={contact.id} />
            </div>
          ) : null}
        </MobileContactDetail>
      </div>

      {/* ── DESKTOP layout (≥ md) ────────────────────────────────────── */}
      <div className="hidden md:block">
      {/*
        Sub-header is a DIRECT child of the AppShell scroll container so that
        `sticky top-0` sticks for the entire scroll range. When it lives inside
        a wrapper div the CSS sticky is released as that wrapper's bottom edge
        passes the threshold — moving it here removes that constraint entirely.
      */}
      <ContactDetailHeaderBar
        contactName={contact.fullName}
        readActions={
          <>
            <Link
              className="flex h-[34px] items-center gap-1.5 rounded-[8px] border border-transparent px-3 text-[13px] font-semibold text-[#5c655e] transition hover:border-[#d8ddd6] hover:bg-[#f2f4f0]"
              href={`/contacts/${contact.id}?tab=sharing`}
              replace
            >
              <WorkspaceIcon name="share" size={16} />
              Share
            </Link>
            <ContactExportButton contactId={contact.id} contactName={contact.fullName} />
            <form action={contact.archivedAt ? restoreContact : archiveContact}>
              <input name="contactId" type="hidden" value={contact.id} />
              <button
                className="flex h-[34px] items-center gap-1.5 rounded-[8px] border border-[#d8ddd6] bg-white px-3 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                type="submit"
              >
                <WorkspaceIcon name={contact.archivedAt ? "restore" : "archive"} size={16} />
                {contact.archivedAt ? "Restore" : "Archive"}
              </button>
            </form>
            <MoreMenu>
              {!isLiveReceived ? (
                <MergeWithButton
                  contact={{
                    id: contact.id,
                    fullName: contact.fullName,
                    email: contact.email,
                    phone: contact.phone,
                    company: contact.company,
                    jobTitle: contact.jobTitle ?? null,
                    notes: contact.notes ?? null,
                    address: contact.address ?? null,
                    birthday: contact.birthday ?? null,
                  }}
                />
              ) : null}
              {canAddToFamily ? (
                <form action={addContactToFamilyBook}>
                  <input name="contactId" type="hidden" value={contact.id} />
                  <button
                    className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left text-sm font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                    type="submit"
                  >
                    <WorkspaceIcon name="users" size={15} />
                    Add to {familyMembership?.groupName ?? "family book"}
                  </button>
                </form>
              ) : null}
              {isSharedContact ? (
                <p className="flex items-center gap-2 px-3 py-2 text-[12px] text-[#8b938c]">
                  <WorkspaceIcon name="users" size={14} />
                  In {familyContext?.groupName ?? "a family book"}
                </p>
              ) : null}
              <form action={permanentlyDeleteContact}>
                <input name="contactId" type="hidden" value={contact.id} />
                <input name="redirectTo" type="hidden" value="/contacts" />
                <button
                  className="w-full rounded-[0.7rem] px-3 py-2 text-left text-sm font-semibold text-[#b5472f] transition hover:bg-[#fbeae6]"
                  type="submit"
                >
                  Delete permanently
                </button>
              </form>
            </MoreMenu>
          </>
        }
      />

      {/* Page body — min-h-screen gives white background on short pages */}
      <div className="min-h-screen bg-white text-[#1d2823]">
        <div className="flex bg-white">
          {/* left rail — sticky sidebar, desktop only */}
          <aside
            className="hidden w-[320px] shrink-0 self-start bg-white p-6 lg:block"
            style={{ position: "sticky", top: 56 }}
          >
            {(() => {
              const [avatarBg, avatarFg] = tintForName(contact.fullName, contact.company);
              const avatarInitials = getInitials(contact.fullName, contact.company);
              return (
                <div
                  className="relative inline-flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full text-3xl font-bold"
                  style={contact.avatarUrl ? undefined : { background: avatarBg, color: avatarFg }}
                >
                  {contact.avatarUrl ? (
                    <ContactHeroAvatar
                      alt={contact.fullName || contact.company || "Contact photo"}
                      avatarUrl={contact.avatarUrl}
                      bg={avatarBg}
                      className="h-full w-full"
                      fg={avatarFg}
                      initials={avatarInitials}
                    />
                  ) : avatarInitials ? (
                    avatarInitials
                  ) : (
                    <WorkspaceIcon name="person" size={36} strokeWidth={1.6} className="text-[#aeb4ac]" />
                  )}
                  {contact.isFavorite ? (
                    <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full bg-white text-[#e0a31c] shadow">
                      <WorkspaceIcon fill="#e0a31c" name="star" size={14} />
                    </span>
                  ) : null}
                </div>
              );
            })()}
            <h1 className="mt-4 text-[21px] font-bold leading-tight tracking-[-0.01em] text-[#1d2823]">
              {getDisplayName(contact, { nameDisplayOrder: (session.user.preferences ?? DEFAULT_PREFERENCES).nameDisplayOrder }) || contact.fullName}
            </h1>
            {contact.company || contact.jobTitle ? (
              <p className="mt-1 text-[13.5px] text-[#5c655e]">
                {[contact.jobTitle, contact.company].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {contact.birthday ? (
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#8b938c]">
                <WorkspaceIcon name="gift" size={14} />
                {formatStoredDate(contact.birthday, dateFormat) || "Not added yet"}
              </p>
            ) : null}
            {upcomingDateEvents.length > 0 ? (
              <div className="mt-3 rounded-[14px] border border-[#e9ece7] bg-[#fbfcf9] px-3 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
                  Upcoming dates
                </div>
                <div className="mt-2 grid gap-2">
                  {upcomingDateEvents.map((event) => (
                    <div className="flex items-start justify-between gap-3" key={event.key}>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-[#1d2823]">
                          {event.label}
                        </div>
                        <div className="text-[12px] text-[#5c655e]">
                          {formatStoredDate(event.value, dateFormat) ?? event.value}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-[#5c655e]">
                        {formatUpcomingDateLead(event.daysUntil)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-3.5 flex flex-wrap gap-2">
              <SourceBadge sourceType={contact.sourceType} sourceDetail={contact.sourceDetail} />
              {isSharedContact ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf0fb] px-2.5 py-1 text-[11px] font-semibold text-[#3a4ab0]">
                  <WorkspaceIcon name="users" size={12} strokeWidth={1.8} />
                  {familyContext?.groupName ?? "Family book"}
                </span>
              ) : null}
              {teamBookLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf0fb] px-2.5 py-1 text-[11px] font-semibold text-[#3a4ab0]">
                  <WorkspaceIcon name="team" size={12} strokeWidth={1.8} />
                  {teamBookLabel}
                </span>
              ) : null}
              {contact.isEmergency ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f3e1da] px-2.5 py-1 text-[11px] font-semibold text-[#b5472f]">
                  <WorkspaceIcon name="emergency" size={12} strokeWidth={1.8} />
                  Emergency
                </span>
              ) : null}
              {contact.archivedAt ? (
                <span className="rounded-full bg-[#f6edd9] px-2.5 py-1 text-[11px] font-semibold text-[#7a5a1a]">
                  Archived
                </span>
              ) : null}
              {contactLabels.map((name) => (
                <LabelChip key={name} name={name} col={labelColors[name.toLowerCase()] ?? "#8b938c"} sz="sm" />
              ))}
            </div>

            {isPersonalContact && booksBlockMemberships.length > 0 ? (
              <>
                <div className="my-5 h-px bg-[#edf0ea]" />
                <ContactBooksBlock
                  contactId={contact.id}
                  memberships={booksBlockMemberships}
                  books={userBooksForBlock}
                />
              </>
            ) : null}

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
                <button
                  aria-label={contact.isFavorite ? "Unfavorite" : "Favorite"}
                  className="grid h-9 w-9 place-items-center rounded-[9px] text-[#e0a31c] transition hover:bg-[#f2f4f0]"
                  title="Favourite"
                  type="submit"
                >
                  <WorkspaceIcon fill={contact.isFavorite ? "#e0a31c" : "none"} name="star" size={17} />
                </button>
              </form>
              <form action={toggleEmergencyContact}>
                <input name="contactId" type="hidden" value={contact.id} />
                <button
                  aria-label={contact.isEmergency ? "Remove emergency contact" : "Mark as emergency contact"}
                  aria-pressed={contact.isEmergency}
                  className={`grid h-9 w-9 place-items-center rounded-[9px] transition hover:bg-[#f2f4f0] ${
                    contact.isEmergency ? "text-[#b5472f]" : "text-[#5c655e]"
                  }`}
                  title={contact.isEmergency ? "Emergency contact" : "Mark as emergency"}
                  type="submit"
                >
                  <WorkspaceIcon
                    fill={contact.isEmergency ? "#b5472f" : "none"}
                    name="emergency"
                    size={17}
                  />
                </button>
              </form>
              <Link
                aria-label="Share"
                className="grid h-9 w-9 place-items-center rounded-[9px] text-[#5c655e] transition hover:bg-[#f2f4f0]"
                href={`/contacts/${contact.id}?tab=sharing`}
                replace
                title="Share"
              >
                <WorkspaceIcon name="share" size={17} />
              </Link>
              <form action={contact.archivedAt ? restoreContact : archiveContact}>
                <input name="contactId" type="hidden" value={contact.id} />
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
                <dd className="text-right text-[#5c655e]">{formatDate(contact.createdAt, dateFormat)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b938c]">Modified</dt>
                <dd className="text-right text-[#5c655e]">{formatDate(contact.updatedAt, dateFormat)}</dd>
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
          {/* full-height divider — standalone so it stretches regardless of aside content length */}
          <div className="hidden w-px shrink-0 bg-[#d8ddd6] lg:block" />

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
              replace
            >
              <WorkspaceIcon name={icon} size={16} />
              {label}
            </Link>
          ))}
        </div>

        {detailTab === "details" ? (
          <div className="grid gap-4">
            {isSharedContact && familyContext ? (
              <ContactFamilyPanel
                groupName={familyContext.groupName}
                lastEditedAt={lastEditedAt}
                lastEditedBy={lastEditedBy}
                members={familyPanelMembers}
                viewerCanEdit={Boolean(familyMembership?.canEdit)}
              />
            ) : null}
            <ContactInlineEditor />
            <UpcomingDatesPanel
              dateFormat={dateFormat}
              events={upcomingDateEvents}
              providerHasDateLimit={linkedProviderHasDateLimit}
            />

            {reminderHasDate ? (
              <ContactReminderOverride
                contactId={contact.id}
                override={contact.reminderLeadDaysOverride}
                userDefault={reminderUserDefault}
              />
            ) : null}

            <section className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white" style={{ contentVisibility: "auto", containIntrinsicSize: "0 auto" }}>
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
              members: b.members
                .filter((m) => m.user !== null)
                .map((m) => ({
                  id: m.id,
                  name: m.user!.name?.trim() ?? m.user!.email,
                  role: m.role === "OWNER" ? ("OWNER" as const) : m.canEdit ? ("CAN_EDIT" as const) : ("CAN_VIEW" as const),
                })),
            }))}
            contactId={contact.id}
            contactName={contact.fullName}
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
            placement={sharingPlacement}
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
              maxDownloads: l.maxDownloads,
              expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
            }))}
            mobile
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
      </div>{/* end desktop md:block */}

      </ContactEditProvider>
    </AppShell>
  );
}
