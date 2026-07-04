import Link from "next/link";
import { redirect } from "next/navigation";

import { BillingBannerSlot } from "~/app/_components/billing-banner-slot";
import { ConnectionBanner, OfflineChip } from "~/app/_components/connection-banner";
import { BottomNav } from "~/app/_components/bottom-nav";
import { ContactDashboard } from "~/app/_components/contact-dashboard";
import { EmailVerificationBanner } from "~/app/_components/email-verification-banner";
import { MobileHomeHeader } from "~/app/_components/mobile-header";
import { MobileCreateFab } from "~/app/_components/mobile-create-fab";
import { MobileFilterButton } from "~/app/_components/mobile-filter-sheet";
import { NotificationBellSlot } from "~/app/_components/notification-bell-slot";
import { SecurityAlertBannerSlot } from "~/app/_components/security-alert-banner-slot";
import { SearchInput } from "~/app/_components/search-input";
import { UserMenu } from "~/app/_components/user-menu";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { getUserPlanSummary, isActivityLogEnabled } from "~/server/billing";
import { getOpenMergeSuggestionsForUser, getRecentMergesForUser } from "~/server/contact-merge";
import { type ContactHealthKey } from "~/server/contact-health";
import {
  buildWorkspaceScope,
  getWorkspaceCounts,
  getWorkspaceHealthCounts,
  listWorkspaceContacts,
  resolveWorkspaceFts,
  WORKSPACE_PAGE_SIZE,
} from "~/server/contacts-workspace";
import { getUserFamilyMembership } from "~/server/family-access";
import { getAccessibleTeamBooks } from "~/server/team-access";
import { getOnboardingChecklist } from "~/server/onboarding";
import { db } from "~/server/db";
import { getLabels } from "~/app/actions/labels";
import { DEFAULT_PREFERENCES } from "~/lib/preferences";

type ContactsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ContactsWorkspaceTab = "overview" | "people" | "archived" | "duplicates" | "activity";
type ContactsWorkspaceFilter = "all" | "recent" | "incomplete" | "favorites" | "emergency";
type ContactsWorkspaceSort = "updated" | "name";
type ContactsWorkspaceView = "compact" | "cozy";

const DUPLICATE_SUGGESTION_BATCH_SIZE = 120;

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
  if (tab === "overview" || tab === "archived" || tab === "duplicates" || tab === "activity") {
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
  // URL param → user preference → hardcoded default (P34B-08)
  prefDefault: ContactsWorkspaceSort = "name",
): Promise<ContactsWorkspaceSort> => {
  const sort = await getSingleParam(searchParams, "sort");
  if (sort === "updated") return "updated";
  if (sort === "name") return "name";
  return prefDefault;
};

const getSelectedView = async (
  searchParams?: ContactsPageProps["searchParams"],
  // URL param → user preference → hardcoded default (P34B-08)
  prefDefault: ContactsWorkspaceView = "compact",
): Promise<ContactsWorkspaceView> => {
  const view = await getSingleParam(searchParams, "view");
  if (view === "cozy") return "cozy";
  if (view === "compact") return "compact";
  return prefDefault;
};

const getSelectedHealth = async (
  searchParams?: ContactsPageProps["searchParams"],
): Promise<ContactHealthKey | null> => {
  const health = await getSingleParam(searchParams, "health");
  if (
    health === "missing-methods" ||
    health === "missing-context" ||
    health === "unlabeled" ||
    health === "missing-dates" ||
    health === "sync-attention"
  ) {
    return health;
  }
  return null;
};

const getInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/contacts");

  const prefs = session.user.preferences ?? DEFAULT_PREFERENCES;

  const [query, selectedTab, selectedFilter, selectedSort, selectedView, selectedHealth] = await Promise.all([
    getQueryValue(searchParams),
    getSelectedTab(searchParams),
    getSelectedFilter(searchParams),
    getSelectedSort(searchParams, prefs.defaultSort),
    getSelectedView(searchParams, prefs.defaultViewMode),
    getSelectedHealth(searchParams),
  ]);

  const params = searchParams ? await searchParams : undefined;
  const mergeSuggestionsRefreshedParam = params?.mergeSuggestionsRefreshed;
  const mergeSuggestionsRefreshedValue = Array.isArray(mergeSuggestionsRefreshedParam)
    ? mergeSuggestionsRefreshedParam[0]
    : mergeSuggestionsRefreshedParam;
  const mergeSuggestionsRefreshed = mergeSuggestionsRefreshedValue === "1";

  const showsOverview = selectedTab === "overview";
  const showsPeopleList = selectedTab === "people";
  const showsArchivedList = selectedTab === "archived";
  const shouldLoadDuplicateDetails = selectedTab === "duplicates";
  const supportsContactSearch = showsPeopleList || showsArchivedList;
  const shouldLoadLabelSuggestions = showsPeopleList || showsArchivedList;

  // P38-02: the list itself (search, filters, ordering, windowing) is built by
  // src/server/contacts-workspace.ts in a single SQL query; only the effective
  // search text is computed here. Overview never applies search.
  const effectiveQuery = supportsContactSearch ? query : "";

  // P31B-05: label filter — ?label=<name> shows only contacts carrying that label.
  const labelParam = (await getSingleParam(searchParams, "label"))?.trim() ?? "";

  const [familyMembership, accessibleTeamBooks, savedFilters, personalBooksRaw, personalBookCounts, sidebarLabels, planSummary, mergeSuggestions, recentMerges] =
    await Promise.all([
      getUserFamilyMembership(session.user.id),
      getAccessibleTeamBooks(session.user.id),
      // P28-01: smart lists (saved filters), in user order.
      db.savedFilter.findMany({
        where: { userId: session.user.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, filterState: true },
      }),
      // P28-03: personal address books — default first, then alphabetical.
      db.addressBook.findMany({
        where: { userId: session.user.id, archivedAt: null },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true, isDefault: true },
      }),
      // Non-archived contact counts per book (null bookId rolls into the default book).
      db.contact.groupBy({
        by: ["bookId"],
        where: { userId: session.user.id, archivedAt: null, groupContacts: { none: {} } },
        _count: { _all: true },
      }),
      // P31B-04: label registry for the sidebar Labels section (also feeds the
      // bulk "Add label" suggestions — getLabels() backfills the registry from
      // contact labels, so the old 2000-contact scan is gone; P38-03).
      getLabels(),
      getUserPlanSummary(session.user.id),
      shouldLoadDuplicateDetails
        ? getOpenMergeSuggestionsForUser(session.user.id, { take: DUPLICATE_SUGGESTION_BATCH_SIZE })
        : Promise.resolve([]),
      shouldLoadDuplicateDetails ? getRecentMergesForUser(session.user.id) : Promise.resolve([]),
    ]);

  // P28-04: suggestions in the bulk "Add label" popover, from the registry.
  const labelSuggestions = shouldLoadLabelSuggestions
    ? sidebarLabels.map((l) => l.name).sort((a, b) => a.localeCompare(b)).slice(0, 24)
    : [];
  const familyBookId = familyMembership?.bookId ?? null;
  const teamBookIds = accessibleTeamBooks.map((b) => b.id);
  const sharedBooks = [
    ...(familyMembership?.bookId
      ? [{ id: familyMembership.bookId, name: familyMembership.groupName, kind: "family" as const }]
      : []),
    ...accessibleTeamBooks.map((b) => ({ id: b.id, name: b.name, kind: "team" as const })),
  ];
  const hasShared = sharedBooks.length > 0;

  // P28-03: personal books with non-archived counts (null bookId → default book).
  const nullBookCount = personalBookCounts.find((c) => c.bookId === null)?._count._all ?? 0;
  const personalBooks = personalBooksRaw.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    isDefault: b.isDefault,
    count:
      (personalBookCounts.find((c) => c.bookId === b.id)?._count._all ?? 0) +
      (b.isDefault ? nullBookCount : 0),
  }));

  const bookParam = await getSingleParam(searchParams, "book");
  const activeBook = bookParam && sharedBooks.some((b) => b.id === bookParam) ? bookParam : null;
  // A personal book filter (mutually exclusive with shared-book selection).
  const activePersonalBookId =
    bookParam && personalBooksRaw.some((b) => b.id === bookParam) ? bookParam : null;
  const scopeParam = await getSingleParam(searchParams, "scope");
  const scope: "all" | "private" | "shared" =
    scopeParam === "private" || scopeParam === "shared" ? scopeParam : "all";

  // P38-02: effective query scope + FTS resolution, shared with the load-more
  // server action (src/app/actions/workspace-list.ts).
  const workspaceScope = buildWorkspaceScope(
    session.user.id,
    {
      familyBookId,
      teamBookIds,
      personalBooks: personalBooksRaw.map((b) => ({ id: b.id, isDefault: b.isDefault })),
    },
    bookParam ?? null,
    scope,
  );
  const listTab = showsArchivedList ? ("archived" as const) : ("people" as const);
  const fts = effectiveQuery
    ? await resolveWorkspaceFts(workspaceScope, listTab, effectiveQuery)
    : { ftsPrivateIds: null, ftsSharedIds: null, ftsRanked: null };

  const baseListParams = {
    scope: workspaceScope,
    query: effectiveQuery,
    ...fts,
    filter: selectedFilter,
    sort: selectedSort,
    includeNotes: effectiveQuery.length > 0,
    limit: WORKSPACE_PAGE_SIZE,
    offset: 0,
  };

  const [
    activeList,
    archivedList,
    healthCounts,
    workspaceCounts,
  ] = await Promise.all([
      showsPeopleList
        ? listWorkspaceContacts({
            ...baseListParams,
            archived: false,
            label: labelParam || null,
            health: selectedHealth,
          })
        : Promise.resolve({ rows: [], totalCount: 0 }),
      showsArchivedList
        ? listWorkspaceContacts({
            ...baseListParams,
            archived: true,
            // parity with the legacy archived query: no label/health filters
            label: null,
            health: null,
          })
        : Promise.resolve({ rows: [], totalCount: 0 }),
      // Health cards (overview + people): exact counts in SQL over the same
      // scope/search/filter/label conditions, minus any active health filter.
      showsPeopleList || showsOverview
        ? getWorkspaceHealthCounts({
            scope: workspaceScope,
            archived: false,
            query: effectiveQuery,
            ftsPrivateIds: fts.ftsPrivateIds,
            ftsSharedIds: fts.ftsSharedIds,
            filter: selectedFilter,
            label: labelParam || null,
          })
        : Promise.resolve({
            "missing-methods": 0,
            "missing-context": 0,
            unlabeled: 0,
            "missing-dates": 0,
            "sync-attention": 0,
          } satisfies Record<ContactHealthKey, number>),
      // P38-03: all nav/badge counts in one round trip (replaces the former
      // wave of 9 count queries + 2 merge-suggestion counts).
      getWorkspaceCounts(session.user.id, sharedBooks.map((b) => b.id)),
    ]);

  const peopleCount = workspaceCounts.privatePeople + workspaceCounts.sharedPeople;

  // P26-04: first-run onboarding checklist (shown above the people list).
  const onboarding = await getOnboardingChecklist({
    userId: session.user.id,
    hasContact: workspaceCounts.privatePeople > 0,
    hasSync: workspaceCounts.connectedSync > 0,
  });

  const duplicatesCount = workspaceCounts.openMergeSuggestions;
  const highConfidenceCount = workspaceCounts.highConfidenceMergeSuggestions;

  // P38-02: rows arrive lean (P38-01 shape), ordered, and windowed from SQL.
  // The client streams further windows via the load-more server action using
  // this request descriptor.
  const listRequest = {
    tab: listTab,
    query: effectiveQuery,
    filter: selectedFilter,
    sort: selectedSort,
    label: labelParam || null,
    health: selectedHealth,
    book: activeBook ?? activePersonalBookId,
    scope,
    offset: 0,
  };
  const healthHrefBase = new URLSearchParams();
  healthHrefBase.set("tab", "people");
  healthHrefBase.set("filter", "all");
  healthHrefBase.set("sort", selectedSort);
  healthHrefBase.set("view", selectedView);
  const healthCards = [
    {
      key: "duplicate-risk" as const,
      title: "Duplicate risk",
      description: "Suggested pairs ready for merge review.",
      count: duplicatesCount,
      href: `/contacts?${new URLSearchParams([
        ["tab", "duplicates"],
        ["filter", "all"],
        ["sort", selectedSort],
        ["view", selectedView],
      ]).toString()}`,
      active: false,
    },
    {
      key: "missing-methods" as const,
      title: "Missing methods",
      description: "No phone number or email on file.",
      count: healthCounts["missing-methods"],
      href: `/contacts?${new URLSearchParams([...healthHrefBase.entries(), ["health", "missing-methods"]]).toString()}`,
      active: selectedTab === "people" && selectedHealth === "missing-methods",
    },
    {
      key: "missing-context" as const,
      title: "Weak metadata",
      description: "Missing company, role, and department context.",
      count: healthCounts["missing-context"],
      href: `/contacts?${new URLSearchParams([...healthHrefBase.entries(), ["health", "missing-context"]]).toString()}`,
      active: selectedTab === "people" && selectedHealth === "missing-context",
    },
    {
      key: "unlabeled" as const,
      title: "Missing labels",
      description: "Still needs categories or tags for quick grouping.",
      count: healthCounts.unlabeled,
      href: `/contacts?${new URLSearchParams([...healthHrefBase.entries(), ["health", "unlabeled"]]).toString()}`,
      active: selectedTab === "people" && selectedHealth === "unlabeled",
    },
    {
      key: "missing-dates" as const,
      title: "Incomplete dates",
      description: "No birthday or other saved date entries.",
      count: healthCounts["missing-dates"],
      href: `/contacts?${new URLSearchParams([...healthHrefBase.entries(), ["health", "missing-dates"]]).toString()}`,
      active: selectedTab === "people" && selectedHealth === "missing-dates",
    },
    {
      key: "sync-attention" as const,
      title: "Sync attention",
      description: "Linked records with stale or failed sync state.",
      count: healthCounts["sync-attention"],
      href: `/contacts?${new URLSearchParams([...healthHrefBase.entries(), ["health", "sync-attention"]]).toString()}`,
      active: selectedTab === "people" && selectedHealth === "sync-attention",
    },
  ];

  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";
  const userInitials = getInitials(userLabel);
  const headerSearchTab = selectedTab === "overview" ? "people" : selectedTab;
  const headerSearchFilter = selectedTab === "overview" ? "all" : selectedFilter;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-white text-[#1d2823]">
      {/* mobile home header — wordmark + bell (activity tab shows plain title) */}
      <MobileHomeHeader
        userId={session.user.id}
        tab={selectedTab}
        labelRegistry={sidebarLabels.map((l) => ({ name: l.name, color: l.color }))}
        statusChip={<OfflineChip readOnly={!planSummary.lifecyclePolicy.canWrite} />}
        filterSlot={
          selectedTab === "overview" ? null : (
            <MobileFilterButton
              labels={sidebarLabels}
              savedFilters={savedFilters}
              personalBooks={personalBooks}
              activeLabel={labelParam || null}
              activeBook={activeBook ?? activePersonalBookId}
              currentFilter={selectedFilter}
            />
          )
        }
      />

      {/* desktop header */}
      <header className="hidden shrink-0 border-b border-[#d8ddd6] bg-white md:block">
        <div className="flex h-[60px] w-full items-center gap-4 px-4 lg:px-[18px]">
          <Link className="flex shrink-0 items-center gap-2.5 lg:w-[230px]" href="/contacts?tab=overview">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#17352e] text-[17px] font-bold text-[#dff0e7]">
              K
            </span>
            <span className="text-[19px] font-bold tracking-[-0.01em] text-[#1d2823]">Kontax</span>
          </Link>

          <SearchInput
            extraParams={
              selectedTab === "overview"
                ? {}
                : {
                    book: activeBook ?? activePersonalBookId,
                    health: selectedHealth,
                    label: labelParam || null,
                    scope: !activeBook && !activePersonalBookId && scope !== "all" ? scope : null,
                  }
            }
            filter={headerSearchFilter}
            initialQuery={query}
            sort={selectedSort}
            tab={headerSearchTab}
            view={selectedView}
          />

          <div className="flex shrink-0 items-center gap-2.5">
            {/* P42-DB01 §3b: offline persists as a chip while account-state owns the slot */}
            <OfflineChip readOnly={!planSummary.lifecyclePolicy.canWrite} />
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

      {/* P42-DB01: single banner slot — account-state ▸ connectivity ▸ flash ▸ update */}
      <ConnectionBanner readOnly={!planSummary.lifecyclePolicy.canWrite} />

      <ContactDashboard
        activeContacts={activeList.rows}
        archivedContacts={archivedList.rows}
        listRequest={listRequest}
        listTotalCount={showsArchivedList ? archivedList.totalCount : activeList.totalCount}
        currentFilter={selectedFilter}
        currentSort={selectedSort}
        currentTab={selectedTab}
        nameDisplayOrder={prefs.nameDisplayOrder}
        rowLabels={prefs.rowLabels}
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
        currentBook={activeBook ?? activePersonalBookId}
        hasShared={hasShared}
        sharedBooks={sharedBooks}
        savedFilters={savedFilters}
        personalBooks={personalBooks}
        labelSuggestions={labelSuggestions}
        sidebarLabels={sidebarLabels}
        currentLabel={labelParam || null}
        counts={{
          people: peopleCount,
          favorites: workspaceCounts.favorites,
          emergency: workspaceCounts.emergency,
          archived: workspaceCounts.archived,
          duplicates: duplicatesCount,
        }}
        account={{ name: userLabel, email: session.user.email ?? "" }}
        syncState="ok"
        highConfidenceCount={highConfidenceCount}
        recentMerges={recentMerges}
        incomingShares={workspaceCounts.incomingShares || undefined}
        onboarding={onboarding}
        currentHealth={selectedHealth}
        healthCards={healthCards}
        visiblePeopleCount={activeList.totalCount}
      />

      <MobileCreateFab
        canWrite={planSummary.lifecyclePolicy.canWrite}
        show={selectedTab === "people"}
        atLimit={planSummary.contactsRemaining !== null && planSummary.contactsRemaining <= 0}
      />
      <BottomNav unreadCount={workspaceCounts.unreadNotifications} syncErrorCount={workspaceCounts.syncErrors} />
    </main>
  );
}
