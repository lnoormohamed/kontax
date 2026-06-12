import Link from "next/link";
import { redirect } from "next/navigation";

import { BillingBannerSlot } from "~/app/_components/billing-banner-slot";
import { BottomNav } from "~/app/_components/bottom-nav";
import { ContactDashboard } from "~/app/_components/contact-dashboard";
import { EmailVerificationBanner } from "~/app/_components/email-verification-banner";
import { MobileHomeHeader } from "~/app/_components/mobile-header";
import { MobileCreateFab } from "~/app/_components/mobile-create-fab";
import { NotificationBellSlot } from "~/app/_components/notification-bell-slot";
import { SecurityAlertBannerSlot } from "~/app/_components/security-alert-banner-slot";
import { SearchInput } from "~/app/_components/search-input";
import { UserMenu } from "~/app/_components/user-menu";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { getUserPlanSummary, isActivityLogEnabled } from "~/server/billing";
import { getOpenMergeSuggestionsForUser, getRecentMergesForUser } from "~/server/contact-merge";
import { getUserFamilyMembership } from "~/server/family-access";
import { getAccessibleTeamBooks } from "~/server/team-access";
import { db } from "~/server/db";

type ContactsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ContactsWorkspaceTab = "people" | "archived" | "duplicates" | "activity";
type ContactsWorkspaceFilter = "all" | "recent" | "incomplete" | "favorites" | "emergency";
type ContactsWorkspaceSort = "updated" | "name";
type ContactsWorkspaceView = "compact" | "cozy";

const getSingleParam = async (
  searchParams: ContactsPageProps["searchParams"],
  key: string,
) => {
  const params = searchParams ? await searchParams : undefined;
  const rawValue = params?.[key];
  return Array.isArray(rawValue) ? rawValue[0] : rawValue;
};

const getQueryValue = async (searchParams?: ContactsPageProps["searchParams"]) => {
  const query = await getSingleParam(searchParams, "q");
  return query?.trim() ?? "";
};

const getSelectedTab = async (
  searchParams?: ContactsPageProps["searchParams"],
): Promise<ContactsWorkspaceTab> => {
  const tab = await getSingleParam(searchParams, "tab");
  if (tab === "archived" || tab === "duplicates" || tab === "activity") {
    return tab;
  }
  return "people";
};

const getSelectedFilter = async (
  searchParams?: ContactsPageProps["searchParams"],
): Promise<ContactsWorkspaceFilter> => {
  const filter = await getSingleParam(searchParams, "filter");
  if (
    filter === "recent" ||
    filter === "incomplete" ||
    filter === "favorites" ||
    filter === "emergency"
  ) {
    return filter;
  }
  return "all";
};

const getSelectedSort = async (
  searchParams?: ContactsPageProps["searchParams"],
): Promise<ContactsWorkspaceSort> => {
  const sort = await getSingleParam(searchParams, "sort");
  if (sort === "updated") {
    return "updated";
  }
  return "name";
};

const getSelectedView = async (
  searchParams?: ContactsPageProps["searchParams"],
): Promise<ContactsWorkspaceView> => {
  const view = await getSingleParam(searchParams, "view");
  if (view === "cozy") {
    return "cozy";
  }
  return "compact";
};

const getSearchConditions = (query: string) =>
  query
    ? {
        OR: [
          { fullName: { contains: query, mode: "insensitive" as const } },
          { phoneticFirstName: { contains: query, mode: "insensitive" as const } },
          { phoneticLastName: { contains: query, mode: "insensitive" as const } },
          { nickname: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { phone: { contains: query, mode: "insensitive" as const } },
          { company: { contains: query, mode: "insensitive" as const } },
          { phoneticCompany: { contains: query, mode: "insensitive" as const } },
          { jobTitle: { contains: query, mode: "insensitive" as const } },
          { website: { contains: query, mode: "insensitive" as const } },
          { address: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

const getInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const normalizeSortText = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const getNameAwareSortKeys = ({
  firstName, lastName, phoneticFirstName, phoneticLastName, company, phoneticCompany, fullName,
}: {
  firstName: string | null;
  lastName: string | null;
  phoneticFirstName: string | null;
  phoneticLastName: string | null;
  company: string | null;
  phoneticCompany: string | null;
  fullName: string | null;
}) => {
  const first = normalizeSortText(firstName);
  const last = normalizeSortText(lastName);
  const phoneticFirst = normalizeSortText(phoneticFirstName);
  const phoneticLast = normalizeSortText(phoneticLastName);
  const companyValue = normalizeSortText(company);
  const phoneticCompanyValue = normalizeSortText(phoneticCompany);
  const full = normalizeSortText(fullName);

  const firstOrReading = phoneticFirst || first;
  const lastOrReading = phoneticLast || last;
  const companyOrReading = phoneticCompanyValue || companyValue;

  if (!firstOrReading || !lastOrReading) {
    const fallback = companyOrReading || companyValue || full;
    return {
      primary: fallback,
      secondary: fallback,
      company: companyOrReading || companyValue,
      full: full || companyValue || companyOrReading,
    };
  }

  return {
    primary: lastOrReading,
    secondary: firstOrReading,
    company: companyOrReading || companyValue,
    full: full,
  };
};

const compareWorkspaceContacts = (
  left: {
    isFavorite: boolean;
    firstName: string | null;
    lastName: string | null;
    phoneticFirstName: string | null;
    phoneticLastName: string | null;
    company: string | null;
    phoneticCompany: string | null;
    fullName: string | null;
  },
  right: {
    isFavorite: boolean;
    firstName: string | null;
    lastName: string | null;
    phoneticFirstName: string | null;
    phoneticLastName: string | null;
    company: string | null;
    phoneticCompany: string | null;
    fullName: string | null;
  },
) => {
  if (left.isFavorite !== right.isFavorite) {
    return left.isFavorite ? -1 : 1;
  }

  const leftKeys = getNameAwareSortKeys(left);
  const rightKeys = getNameAwareSortKeys(right);
  const collation = new Intl.Collator("en", { sensitivity: "base", numeric: true });

  const primaryCompare = collation.compare(leftKeys.primary, rightKeys.primary);
  if (primaryCompare !== 0) return primaryCompare;

  const secondaryCompare = collation.compare(leftKeys.secondary, rightKeys.secondary);
  if (secondaryCompare !== 0) return secondaryCompare;

  const companyCompare = collation.compare(leftKeys.company, rightKeys.company);
  if (companyCompare !== 0) return companyCompare;

  return collation.compare(leftKeys.full, rightKeys.full);
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/contacts");

  const [query, selectedTab, selectedFilter, selectedSort, selectedView] = await Promise.all([
    getQueryValue(searchParams),
    getSelectedTab(searchParams),
    getSelectedFilter(searchParams),
    getSelectedSort(searchParams),
    getSelectedView(searchParams),
  ]);

  const params = searchParams ? await searchParams : undefined;
  const mergeSuggestionsRefreshedParam = params?.mergeSuggestionsRefreshed;
  const mergeSuggestionsRefreshedValue = Array.isArray(mergeSuggestionsRefreshedParam)
    ? mergeSuggestionsRefreshedParam[0]
    : mergeSuggestionsRefreshedParam;
  const mergeSuggestionsRefreshed = mergeSuggestionsRefreshedValue === "1";

  const searchConditions = getSearchConditions(query);
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  const filterConditions =
    selectedFilter === "recent"
      ? { updatedAt: { gte: recentCutoff } }
      : selectedFilter === "incomplete"
        ? { OR: [{ email: null }, { email: "" }, { phone: null }, { phone: "" }] }
        : selectedFilter === "favorites"
          ? { isFavorite: true }
          : selectedFilter === "emergency"
            ? { isEmergency: true }
            : {};

  const contactListSelect = {
    id: true,
    fullName: true,
    firstName: true,
    lastName: true,
    phoneticFirstName: true,
    phoneticLastName: true,
    nickname: true,
    email: true,
    phone: true,
    company: true,
    phoneticCompany: true,
    jobTitle: true,
    website: true,
    birthday: true,
    address: true,
    isFavorite: true,
    isEmergency: true,
    notes: true,
    archivedAt: true,
    updatedAt: true,
  } as const;

  const [familyMembership, accessibleTeamBooks] = await Promise.all([
    getUserFamilyMembership(session.user.id),
    getAccessibleTeamBooks(session.user.id),
  ]);
  const familyBookId = familyMembership?.bookId ?? null;
  const teamBookIds = accessibleTeamBooks.map((b) => b.id);
  const sharedBooks = [
    ...(familyMembership?.bookId
      ? [{ id: familyMembership.bookId, name: familyMembership.groupName, kind: "family" as const }]
      : []),
    ...accessibleTeamBooks.map((b) => ({ id: b.id, name: b.name, kind: "team" as const })),
  ];
  const hasShared = sharedBooks.length > 0;

  const bookParam = await getSingleParam(searchParams, "book");
  const activeBook = bookParam && sharedBooks.some((b) => b.id === bookParam) ? bookParam : null;
  const scopeParam = await getSingleParam(searchParams, "scope");
  const scope = scopeParam === "private" || scopeParam === "shared" ? scopeParam : "all";

  const includePrivate = !activeBook && scope !== "shared";
  const includeShared = scope !== "private";
  const familyTargetId = activeBook ? (activeBook === familyBookId ? familyBookId : null) : familyBookId;
  const teamTargetIds = activeBook ? (teamBookIds.includes(activeBook) ? [activeBook] : []) : teamBookIds;

  const sortOrder =
    selectedSort === "name" ? { isFavorite: "desc" as const } : { updatedAt: "desc" as const };

  const [privateActive, familyActive, teamActive, archivedContacts, mergeSuggestions, planSummary] =
    await Promise.all([
      includePrivate
        ? db.contact.findMany({
            where: { userId: session.user.id, archivedAt: null, groupContacts: { none: {} }, ...searchConditions, ...filterConditions },
            orderBy: sortOrder,
            select: contactListSelect,
          })
        : Promise.resolve([]),
      includeShared && familyTargetId
        ? db.contact.findMany({
            where: { archivedAt: null, groupContacts: { some: { groupAddressBookId: familyTargetId } }, ...searchConditions, ...filterConditions },
            orderBy: { updatedAt: "desc" as const },
            select: contactListSelect,
          })
        : Promise.resolve([]),
      includeShared && teamTargetIds.length > 0
        ? db.contact.findMany({
            where: { archivedAt: null, groupContacts: { some: { groupAddressBookId: { in: teamTargetIds } } }, ...searchConditions, ...filterConditions },
            orderBy: { updatedAt: "desc" as const },
            select: contactListSelect,
          })
        : Promise.resolve([]),
      db.contact.findMany({
        where: {
          userId: session.user.id,
          NOT: { archivedAt: null },
          ...searchConditions,
          ...filterConditions,
        },
        orderBy:
          selectedSort === "name"
            ? [{ isFavorite: "desc" as const }, { archivedAt: "desc" as const }]
            : { archivedAt: "desc" },
        select: contactListSelect,
      }),
      getOpenMergeSuggestionsForUser(session.user.id),
      getUserPlanSummary(session.user.id),
    ]);

  const activeContacts = [
    ...privateActive.map((c) => ({ ...c, sharedKind: null as "family" | "team" | null })),
    ...familyActive.map((c) => ({ ...c, sharedKind: "family" as const })),
    ...teamActive.map((c) => ({ ...c, sharedKind: "team" as const })),
  ];

  const [privatePeopleCount, sharedPeopleCount, favoritesCount, emergencyCount, archivedCount, incomingSharesCount, unreadCount, syncErrorCount] =
    await Promise.all([
      db.contact.count({ where: { userId: session.user.id, archivedAt: null, groupContacts: { none: {} } } }),
      sharedBooks.length > 0
        ? db.contact.count({
            where: { archivedAt: null, groupContacts: { some: { groupAddressBookId: { in: sharedBooks.map((b) => b.id) } } } },
          })
        : Promise.resolve(0),
      db.contact.count({ where: { userId: session.user.id, archivedAt: null, isFavorite: true } }),
      db.contact.count({ where: { userId: session.user.id, archivedAt: null, isEmergency: true } }),
      db.contact.count({ where: { userId: session.user.id, NOT: { archivedAt: null } } }),
      db.contactShare.count({
        where: {
          recipientUserId: session.user.id,
          shareType: { in: ["STATIC_COPY", "LIVE_SYNC"] },
          status: "ACTIVE",
          recipientContactId: null,
        },
      }),
      db.notification.count({ where: { userId: session.user.id, readAt: null, dismissedAt: null } }),
      db.syncAccount.count({ where: { userId: session.user.id, status: { in: ["ERROR", "NEEDS_REAUTH"] } } }),
    ]);
  const peopleCount = privatePeopleCount + sharedPeopleCount;

  const highConfidenceCount = mergeSuggestions.filter((s) => s.confidence === "high").length;
  const recentMerges =
    selectedTab === "duplicates" ? await getRecentMergesForUser(session.user.id) : [];

  const archivedWithFlag = archivedContacts.map((c) => ({
    ...c,
    sharedKind: null as "family" | "team" | null,
  }));
  const sortedActiveContacts =
    selectedSort === "name"
      ? [...activeContacts].sort(compareWorkspaceContacts)
      : [...activeContacts].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const sortedArchivedContacts =
    selectedSort === "name"
      ? [...archivedWithFlag].sort(compareWorkspaceContacts)
      : archivedWithFlag;

  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";
  const userInitials = getInitials(userLabel);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-white text-[#1d2823]">
      {/* mobile home header — wordmark + bell (activity tab shows plain title) */}
      <MobileHomeHeader userId={session.user.id} tab={selectedTab} />

      {/* desktop header */}
      <header className="hidden shrink-0 border-b border-[#d8ddd6] bg-white md:block">
        <div className="flex h-[60px] w-full items-center gap-4 px-4 lg:px-[18px]">
          <Link className="flex shrink-0 items-center gap-2.5 lg:w-[230px]" href="/contacts">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#17352e] text-[17px] font-bold text-[#dff0e7]">
              K
            </span>
            <span className="text-[19px] font-bold tracking-[-0.01em] text-[#1d2823]">Kontax</span>
          </Link>

          <SearchInput
            filter={selectedFilter}
            initialQuery={query}
            sort={selectedSort}
            tab={selectedTab}
            view={selectedView}
          />

          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
                planSummary.lifecyclePolicy.canWrite
                  ? "bg-[#4158f4] text-white hover:bg-[#3248db]"
                  : "cursor-not-allowed bg-slate-200 text-slate-500"
              }`}
              href={planSummary.lifecyclePolicy.canWrite ? "/contacts/new" : "/settings"}
            >
              <WorkspaceIcon name="plus" size={18} strokeWidth={2} />
              <span className="hidden sm:inline">Create contact</span>
            </Link>
            {/* P22-DB05: unified notification bell (replaces the legacy /shares bell). */}
            <NotificationBellSlot userId={session.user.id} />
            <UserMenu email={session.user.email ?? ""} initials={userInitials} name={userLabel} />
          </div>
        </div>
      </header>

      {!session.user.emailVerified && (
        <EmailVerificationBanner email={session.user.email ?? ""} />
      )}

      <BillingBannerSlot userId={session.user.id} />

      {/* P22-DB05 surface 4: security alert banner (below billing banner) */}
      <SecurityAlertBannerSlot userId={session.user.id} />

      <ContactDashboard
        activeContacts={sortedActiveContacts}
        archivedContacts={sortedArchivedContacts}
        currentFilter={selectedFilter}
        currentSort={selectedSort}
        currentTab={selectedTab}
        mergeSuggestions={mergeSuggestions}
        mergeSuggestionsRefreshed={mergeSuggestionsRefreshed}
        planSummary={{
          planLabel: planSummary.planLabel,
          lifecycleState: planSummary.lifecycleState,
          lifecycleLabel: planSummary.lifecyclePolicy.label,
          lifecycleDescription: planSummary.lifecyclePolicy.description,
          canWrite: planSummary.lifecyclePolicy.canWrite,
          canUseBasicExport: planSummary.lifecyclePolicy.canUseBasicExport,
          contactsUsed: planSummary.contactsUsed,
          contactsRemaining: planSummary.contactsRemaining,
          contactsLimit: planSummary.entitlements.contactsLimit,
          importedThisMonth: planSummary.importedThisMonth,
          monthlyImportLimit: planSummary.entitlements.monthlyImportLimit,
          premiumExportEnabled: planSummary.entitlements.premiumExportEnabled,
          activityEnabled: isActivityLogEnabled(planSummary.entitlements),
        }}
        query={query}
        viewMode={selectedView}
        currentScope={scope}
        currentBook={activeBook}
        hasShared={hasShared}
        sharedBooks={sharedBooks}
        counts={{
          people: peopleCount,
          favorites: favoritesCount,
          emergency: emergencyCount,
          archived: archivedCount,
          duplicates: mergeSuggestions.length,
        }}
        account={{ name: userLabel, email: session.user.email ?? "" }}
        syncState="ok"
        highConfidenceCount={highConfidenceCount}
        recentMerges={recentMerges}
        incomingShares={incomingSharesCount || undefined}
      />

      <MobileCreateFab canWrite={planSummary.lifecyclePolicy.canWrite} />
      <BottomNav unreadCount={unreadCount} syncErrorCount={syncErrorCount} />
    </main>
  );
}
