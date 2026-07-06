import Link from "next/link";

import { ActivityFeed, ActivityLocked } from "~/app/_components/activity-feed";
import { ContactsWorkspaceTable } from "~/app/_components/contacts-workspace-table";
import { EmptyState } from "~/app/_components/empty-state";
import { LabelFilterBar, MobileLabelFilterBar } from "~/app/_components/label-filter-bar";
import { LabelsSidebar, type SidebarLabel } from "~/app/_components/labels-sidebar";
import { BulkMergeButton, UndoMergeButton } from "~/app/_components/merge-actions";
import { MobileActivityFeed } from "~/app/_components/mobile-activity-feed";
import { MobileHealthPrompt } from "~/app/_components/mobile-health-prompt";
import { MergeSuggestionList } from "~/app/_components/merge-suggestion-card";
import { MergeSuggestionRefreshButton } from "~/app/_components/merge-suggestion-refresh-button";
import { OnboardingChecklist } from "~/app/_components/onboarding-checklist";
import { SmartListsBooks, type PersonalBook, type SmartList } from "~/app/_components/smart-lists-books";
import { SortMenu } from "~/app/_components/sort-menu";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import type { ContactHealthKey } from "~/server/contact-health";
import type { BillingLifecycleState } from "~/server/billing";
import type { PersistedMergeSuggestion, RecentMerge } from "~/server/contact-merge";
import type { OnboardingChecklist as OnboardingChecklistData } from "~/server/onboarding";
import type { WorkspaceListRequest } from "~/app/actions/workspace-list";

// P38-01: lean row shape — only what a workspace row renders. Sorting, health
// checks, and note-excerpt extraction run server-side on full rows in
// contacts/page.tsx; every field added here ships to the client for every row.
type DashboardContact = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  avatarUrl?: string | null;
  isFavorite: boolean;
  isEmergency: boolean;
  sharedKind: "family" | "team" | null;
  labels?: unknown; // P31B-06: JSON string[] from Prisma
  // P46-01: primary sort key (lowercased) — feeds the alphabet scrubber's letter.
  sortName: string;
  // P38-01: server-computed excerpt, set when the search query matched notes.
  noteMatchSnippet?: string | null;
};

type PlanSummary = {
  planLabel: string;
  lifecycleState: BillingLifecycleState;
  lifecycleLabel: string;
  lifecycleDescription: string;
  canWrite: boolean;
  canUseBasicExport: boolean;
  contactsUsed: number;
  contactsRemaining: number | null;
  contactsLimit: number | null;
  importedThisMonth: number;
  monthlyImportLimit: number | null;
  premiumExportEnabled: boolean;
  activityEnabled: boolean;
};

type WorkspaceTab = "overview" | "people" | "archived" | "duplicates" | "activity";
type WorkspaceFilter = "all" | "recent" | "incomplete" | "favorites" | "emergency";
type WorkspaceSort = "updated" | "name";
type WorkspaceView = "compact" | "cozy";

type HealthCard = {
  key: ContactHealthKey | "duplicate-risk";
  title: string;
  description: string;
  count: number;
  href: string;
  active: boolean;
};

type ContactDashboardProps = {
  activeContacts: DashboardContact[];
  archivedContacts: DashboardContact[];
  // P38-02: windowed list — the first window renders here; the table streams
  // further windows via the load-more server action using this descriptor.
  listRequest: WorkspaceListRequest;
  listTotalCount: number;
  currentFilter: WorkspaceFilter;
  currentSort: WorkspaceSort;
  currentTab: WorkspaceTab;
  query: string;
  planSummary: PlanSummary;
  mergeSuggestions: PersistedMergeSuggestion[];
  mergeSuggestionsRefreshed: boolean;
  viewMode: WorkspaceView;
  currentScope: "all" | "private" | "shared";
  currentBook: string | null;
  hasShared: boolean;
  sharedBooks: { id: string; name: string; kind: "family" | "team" }[];
  savedFilters: SmartList[];
  personalBooks: PersonalBook[];
  labelSuggestions: string[];
  sidebarLabels: SidebarLabel[];
  currentLabel: string | null;
  counts: {
    people: number;
    favorites: number;
    emergency: number;
    archived: number;
    duplicates: number;
  };
  incomingShares?: number;
  account: { name: string; email: string };
  syncState: "ok" | "warning" | "error";
  highConfidenceCount: number;
  recentMerges: RecentMerge[];
  onboarding: OnboardingChecklistData;
  nameDisplayOrder?: "first-last" | "last-first";
  // P43-01: "Labels on rows" saved value; resolved per-device in the table.
  rowLabels?: "hover" | "always" | "off";
  currentHealth: ContactHealthKey | null;
  healthCards: HealthCard[];
  /** P46-10: mobile "needs attention" prompt (null = don't show). */
  healthPrompt?: { count: number; href: string } | null;
  visiblePeopleCount: number;
};

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function ContactDashboard({
  activeContacts,
  archivedContacts,
  listRequest,
  listTotalCount,
  currentFilter,
  currentSort,
  currentTab,
  query,
  planSummary,
  mergeSuggestions,
  mergeSuggestionsRefreshed,
  viewMode,
  currentScope,
  currentBook,
  hasShared,
  sharedBooks,
  savedFilters,
  personalBooks,
  labelSuggestions,
  sidebarLabels,
  currentLabel,
  counts,
  account,
  syncState,
  highConfidenceCount,
  recentMerges,
  incomingShares,
  onboarding,
  nameDisplayOrder,
  rowLabels,
  currentHealth,
  healthCards,
  healthPrompt,
  visiblePeopleCount,
}: ContactDashboardProps) {
  // P26-04: show the first-run checklist only on the default people list —
  // not inside favorites/emergency views, a shared book, or a search.
  const showOnboarding =
    onboarding.show &&
    currentTab === "people" &&
    currentFilter === "all" &&
    !currentBook &&
    !query;

  // P26-05: the contextual "no contacts at all" empty state — only on the
  // default people list (not a filter view, search, or shared book).
  const contactsTrulyEmpty =
    counts.people === 0 &&
    currentFilter === "all" &&
    !currentBook &&
    currentScope !== "shared" &&
    !query;
  const mergeDateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const buildHref = (
    tab: WorkspaceTab,
    overrides?: {
      filter?: WorkspaceFilter;
      sort?: WorkspaceSort;
      view?: WorkspaceView;
      scope?: "all" | "private" | "shared";
      book?: string | null;
      health?: ContactHealthKey | null;
    },
  ) => {
    const params = new URLSearchParams();
    const nextFilter = overrides?.filter ?? currentFilter;
    params.set("tab", tab);
    params.set("filter", nextFilter);
    params.set("sort", overrides?.sort ?? currentSort);
    params.set("view", overrides?.view ?? viewMode);
    // book and scope are mutually exclusive (a specific book overrides scope).
    const book = overrides && "book" in overrides ? overrides.book : currentBook;
    if (book) {
      params.set("book", book);
    } else {
      const scope = overrides?.scope ?? currentScope;
      if (scope !== "all") {
        params.set("scope", scope);
      }
    }
    if (tab === "people") {
      const health =
        overrides && "health" in overrides
          ? overrides.health
          : nextFilter === "all"
            ? currentHealth
            : null;
      if (health) params.set("health", health);
    }
    if (query) {
      params.set("q", query);
    }
    return `/contacts?${params.toString()}`;
  };

  const isFavoritesView = currentTab === "people" && currentFilter === "favorites";
  const isEmergencyView = currentTab === "people" && currentFilter === "emergency";
  const peopleActive = currentTab === "people" && !isFavoritesView && !isEmergencyView;
  const groupByLetter = currentSort === "name" && !query;
  const sharedBooksLabel =
    sharedBooks.length === 0
      ? "No shared spaces connected yet."
      : `${sharedBooks.length} shared space${sharedBooks.length === 1 ? "" : "s"} linked into this workspace.`;
  const planCapacityNote =
    planSummary.contactsRemaining === null || planSummary.contactsLimit === null
      ? `${planSummary.planLabel} plan with room to grow.`
      : `${planSummary.contactsRemaining.toLocaleString()} of ${planSummary.contactsLimit.toLocaleString()} contacts remaining on ${planSummary.planLabel}.`;
  const overviewStats = [
    {
      label: "Contacts",
      value: counts.people,
      detail: hasShared ? sharedBooksLabel : "Your main address book at a glance.",
    },
    {
      label: "Favorites",
      value: counts.favorites,
      detail: "Starred people you reach for often.",
    },
    {
      label: "Emergency",
      value: counts.emergency,
      detail: "Pinned for urgent access when you need it fast.",
    },
    {
      label: "Duplicates",
      value: counts.duplicates,
      detail:
        counts.duplicates > 0
          ? `${highConfidenceCount.toLocaleString()} high-confidence suggestion${highConfidenceCount === 1 ? "" : "s"} ready to review.`
          : "No open merge suggestions right now.",
    },
  ] as const;
  const overviewActions = [
    {
      title: "All contacts",
      href: buildHref("people", { filter: "all", health: null }),
      body: "Return to the full list and keep sorting, filtering, or searching.",
    },
    {
      title: "Duplicate review",
      href: buildHref("duplicates", { filter: "all" }),
      body:
        counts.duplicates > 0
          ? `${counts.duplicates.toLocaleString()} open suggestion${counts.duplicates === 1 ? "" : "s"} waiting for review.`
          : "No duplicate queue right now, but you can reopen the workbench anytime.",
    },
    {
      title: "Shared with me",
      href: "/settings/sharing/shared",
      body:
        incomingShares && incomingShares > 0
          ? `${incomingShares.toLocaleString()} pending share${incomingShares === 1 ? "" : "s"} waiting for you.`
          : "New incoming shares from family or team members will land here.",
    },
    {
      title: "Sync and imports",
      href: "/sync",
      body: planCapacityNote,
    },
  ] as const;

  // GRACE is handled by the pinned BillingBanner (§2); the dashboard keeps the
  // read-only (locked/canceled) and near-limit notices, which are out of scope
  // for the billing-surfaces design.
  const showLocked = planSummary.lifecycleState === "LOCKED" || planSummary.lifecycleState === "CANCELED";
  const nearLimit =
    planSummary.contactsLimit !== null &&
    planSummary.contactsLimit > 0 &&
    planSummary.contactsRemaining !== null &&
    planSummary.contactsRemaining >= 0 &&
    planSummary.contactsRemaining <= 20;
  const hasBanner = showLocked || nearLimit;

  const navItem = (
    active: boolean,
    href: string,
    icon: string,
    label: string,
    count: number | null,
    badge?: boolean,
  ) => (
    <Link
      className={`flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] transition ${
        active
          ? "bg-[#e7efe9] font-semibold text-[#17352e]"
          : "font-medium text-[#5c655e] hover:bg-[#f2f4f0]"
      }`}
      href={href}
      key={href}
    >
      <WorkspaceIcon name={icon} size={18} />
      <span className="flex-1">{label}</span>
      {count != null ? (
        badge && count > 0 ? (
          <span className="rounded-full bg-[#bf8526] px-1.5 text-[11px] font-semibold text-white">{count}</span>
        ) : (
          <span className="text-[12px] text-[#8b938c]">{count}</span>
        )
      ) : null}
    </Link>
  );

  const subFilter = (filter: WorkspaceFilter, label: string) => {
    const active = peopleActive && currentFilter === filter;
    return (
      <Link
        className={`ml-[17px] flex h-[30px] items-center rounded-md border-l-2 pl-3 pr-2.5 text-[12.5px] transition ${
          active
            ? "border-[#17352e] bg-[#f2f4f0] font-semibold text-[#1d2823]"
            : "border-[#e9ece7] font-medium text-[#5c655e] hover:bg-[#f2f4f0]"
        }`}
        href={buildHref("people", { filter })}
      >
        {label}
      </Link>
    );
  };

  const sideLink = (href: string, icon: string, label: string, dot?: boolean) => (
    <Link
      className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium text-[#8b938c] transition hover:bg-[#f2f4f0] hover:text-[#5c655e]"
      href={href}
    >
      <WorkspaceIcon name={icon} size={15} />
      <span className="flex-1">{label}</span>
      {dot ? (
        <span
          aria-label={`Sync: ${syncState}`}
          className="h-2 w-2 rounded-full"
          style={{
            background: syncState === "error" ? "#b5472f" : syncState === "warning" ? "#bf8526" : "#3a9d6a",
          }}
        />
      ) : null}
    </Link>
  );

  const segment = (label: string, active: boolean, href: string) => (
    <Link
      className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition ${
        active ? "bg-white text-[#1d2823] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#8b938c] hover:text-[#5c655e]"
      }`}
      href={href}
    >
      {label}
    </Link>
  );

  const countLabel =
    currentTab === "overview"
      ? `${counts.people} contacts`
      : currentTab === "people"
      ? currentHealth
        ? `${visiblePeopleCount} contacts`
        : `${counts.people} contacts`
      : currentTab === "archived"
        ? `${counts.archived} archived`
        : `${counts.duplicates} duplicates`;

  const currentHealthTitle = healthCards.find((card) => card.key === currentHealth)?.title ?? null;
  const useCondensedTabletOverviewRail = currentTab === "overview";
  const sidebarSummaryItem = (
    href: string,
    icon: string,
    label: string,
    detail: string,
    count?: string,
  ) => (
    <Link
      className="flex items-start gap-2.5 rounded-xl border border-[#e5e9e3] bg-[#f8faf7] px-3 py-2.5 transition hover:border-[#d8ddd6] hover:bg-white"
      href={href}
      key={label}
    >
      <span className="mt-0.5 rounded-lg bg-white p-1 text-[#5c655e] shadow-[0_1px_2px_rgba(20,30,25,0.06)]">
        <WorkspaceIcon name={icon} size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-[#1d2823]">
          <span>{label}</span>
          {count ? <span className="text-[11px] font-medium text-[#8b938c]">{count}</span> : null}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-5 text-[#6f786f]">{detail}</span>
      </span>
    </Link>
  );
  const condensedSharedCount = sharedBooks.length;
  const condensedSharedDetail =
    condensedSharedCount === 0
      ? "No family or team books connected yet."
      : `${condensedSharedCount} shared space${condensedSharedCount === 1 ? "" : "s"} ready when you need them.`;

  return (
    <div className="flex min-h-0 flex-1">
      {/* sidebar */}
      <aside
        className={`hidden shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#d8ddd6] bg-white px-3 py-3.5 md:flex ${
          useCondensedTabletOverviewRail ? "w-[248px] md:w-[216px] lg:w-[248px]" : "w-[248px]"
        }`}
      >
        <Link
          className={`mb-2 flex items-center gap-3 rounded-xl border border-[#e9ece7] bg-[#f6f7f4] transition hover:bg-[#f2f4f0] ${
            useCondensedTabletOverviewRail ? "p-2 md:gap-2 md:p-2 lg:gap-3 lg:p-2.5" : "p-2.5"
          }`}
          href="/settings"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17352e] text-xs font-semibold text-[#dff0e7]">
            {getInitials(account.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-[#1d2823]">{account.name}</span>
            <span className={`truncate text-[11px] text-[#8b938c] ${useCondensedTabletOverviewRail ? "hidden lg:block" : "block"}`}>
              {account.email}
            </span>
          </span>
          <span className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#17352e]">
            {planSummary.planLabel}
          </span>
        </Link>

        {navItem(currentTab === "overview", buildHref("overview", { filter: "all", health: null }), "home", "Overview", null)}
        {navItem(peopleActive, buildHref("people", { filter: "all", health: null }), "people", "People", counts.people)}
        {peopleActive ? (
          <div className="grid gap-0.5">
            {subFilter("all", "All contacts")}
            {subFilter("recent", "Recently updated")}
            {subFilter("incomplete", "Missing details")}
          </div>
        ) : null}
        {navItem(isFavoritesView, buildHref("people", { filter: "favorites" }), "star", "Favorites", counts.favorites)}
        {navItem(isEmergencyView, buildHref("people", { filter: "emergency" }), "emergency", "Emergency", counts.emergency)}
        {navItem(currentTab === "archived", buildHref("archived", { filter: "all" }), "archive", "Archived", counts.archived)}
        {navItem(
          currentTab === "duplicates",
          buildHref("duplicates", { filter: "all" }),
          "people",
          "Duplicates",
          counts.duplicates,
          true,
        )}
        {navItem(currentTab === "activity", buildHref("activity"), "clock", "Activity", null)}
        {navItem(false, "/settings/sharing/shared", "download", "Shared with me", incomingShares ?? null, true)}

        {useCondensedTabletOverviewRail ? (
          <>
            <div className="mt-3 grid gap-2 lg:hidden">
              {sidebarSummaryItem(
                buildHref("people", { filter: "all", health: null }),
                "layoutList",
                "My Lists",
                savedFilters.length === 0
                  ? "No saved shortcuts yet."
                  : "Saved filters stay one tap away.",
                savedFilters.length === 0 ? undefined : `${savedFilters.length} saved`,
              )}
              {sidebarSummaryItem(
                buildHref("people", { filter: "all", book: null }),
                "book",
                "Books",
                `${personalBooks.length === 1 ? "Your main address book is ready." : "Your address books are ready."}`,
                `${personalBooks.length} total`,
              )}
              {sidebarSummaryItem(
                buildHref("people", { filter: "all", health: null }),
                hasShared ? "users" : "download",
                "Shared",
                condensedSharedDetail,
                condensedSharedCount > 0 ? `${condensedSharedCount} linked` : undefined,
              )}
              {sidebarSummaryItem(
                buildHref("people", { filter: "all", health: null }),
                "tag",
                "Labels",
                sidebarLabels.length === 0
                  ? "Create labels from any contact."
                  : "Review the full label list inside People.",
                sidebarLabels.length === 0 ? undefined : `${sidebarLabels.length} active`,
              )}
            </div>

            <div className="mt-auto border-t border-[#e9ece7] pt-2 lg:hidden">
              <div className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">
                Quick links
              </div>
              {sideLink("/import-export", "upload", "Import")}
              {sideLink("/import-export", "download", "Export")}
              {sideLink("/sync", "sync", "Sync", true)}
            </div>

            <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              {/* P28-01/03: smart lists ("My Lists") + personal address books ("Books") */}
              <SmartListsBooks lists={savedFilters} books={personalBooks} />

              {/* Shared books (P15-04 family + P14-07 teams) — membership views live
                  here, not mixed into the personal Favorites/Emergency filters */}
              {hasShared ? (
                <div className="mt-3">
                  <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">
                    Shared
                  </div>
                  {(["family", "team"] as const).map((kind) => {
                    const group = sharedBooks.filter((b) => b.kind === kind);
                    if (group.length === 0) return null;
                    return (
                      <div key={kind}>
                        <div className="flex items-center gap-2 px-2.5 pb-0.5 pt-1.5 text-[11.5px] font-semibold text-[#5c655e]">
                          <WorkspaceIcon name={kind === "team" ? "team" : "users"} size={13} />
                          <span>{kind === "team" ? "Teams" : "Family"}</span>
                        </div>
                        <div className="pl-2">
                          {group.map((b) =>
                            navItem(
                              false,
                              buildHref("people", { filter: "all", book: b.id }),
                              b.kind === "team" ? "team" : "users",
                              b.name,
                              null,
                            ),
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* P31B-04: real Labels sidebar section */}
              <LabelsSidebar labels={sidebarLabels} activeLabel={currentLabel} />

              <div className="mt-auto border-t border-[#e9ece7] pt-2">
                {sideLink("/import-export", "upload", "Import")}
                {sideLink("/import-export", "download", "Export")}
                {sideLink("/sync", "sync", "Sync", true)}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* P28-01/03: smart lists ("My Lists") + personal address books ("Books") */}
            <SmartListsBooks lists={savedFilters} books={personalBooks} />

            {/* Shared books (P15-04 family + P14-07 teams) — membership views live
                here, not mixed into the personal Favorites/Emergency filters */}
            {hasShared ? (
              <div className="mt-3">
                <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">
                  Shared
                </div>
                {(["family", "team"] as const).map((kind) => {
                  const group = sharedBooks.filter((b) => b.kind === kind);
                  if (group.length === 0) return null;
                  return (
                    <div key={kind}>
                      <div className="flex items-center gap-2 px-2.5 pb-0.5 pt-1.5 text-[11.5px] font-semibold text-[#5c655e]">
                        <WorkspaceIcon name={kind === "team" ? "team" : "users"} size={13} />
                        <span>{kind === "team" ? "Teams" : "Family"}</span>
                      </div>
                      <div className="pl-2">
                        {group.map((b) =>
                          navItem(
                            currentTab === "people" && currentBook === b.id,
                            buildHref("people", { filter: "all", book: b.id }),
                            b.kind === "team" ? "team" : "users",
                            b.name,
                            null,
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* P31B-04: real Labels sidebar section */}
            <LabelsSidebar labels={sidebarLabels} activeLabel={currentLabel} />

            <div className="mt-auto border-t border-[#e9ece7] pt-2">
              {sideLink("/import-export", "upload", "Import")}
              {sideLink("/import-export", "download", "Export")}
              {sideLink("/sync", "sync", "Sync", true)}
            </div>
          </>
        )}
      </aside>

      {/* list area */}
      <section className="flex min-w-0 flex-1 flex-col bg-white">
        {hasBanner ? (
          <div className="grid shrink-0 gap-2 px-4 pt-3">
            {showLocked ? (
              <div className="flex items-center gap-2.5 rounded-[0.9rem] bg-[#f3e1da] px-3.5 py-2.5 text-[13px] text-[#7a2f1d]">
                <span aria-hidden>🔒</span>
                <span className="flex-1">
                  Your account is read-only. {planSummary.lifecycleDescription}
                </span>
                <Link className="shrink-0 font-semibold underline" href="/settings">
                  Manage plan
                </Link>
              </div>
            ) : null}
            {nearLimit ? (
              <div className="flex items-center gap-2.5 rounded-[0.9rem] bg-[#f6edd9] px-3.5 py-2.5 text-[13px] text-[#7a5a1a]">
                <span aria-hidden>📈</span>
                <span className="flex-1">
                  {planSummary.contactsRemaining} of {planSummary.contactsLimit} contacts remaining on the{" "}
                  {planSummary.planLabel} plan. Upgrade for unlimited.
                </span>
                <Link className="shrink-0 font-semibold underline" href="/settings">
                  Upgrade
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* toolbar — desktop only; the mobile design has no sort/view/scope bar
            (search is the mobile filter, sort defaults to Name A–Z). */}
        {currentTab === "activity" || currentTab === "overview" ? null : (
        <div className="hidden shrink-0 items-center gap-3 border-b border-[#e9ece7] px-4 py-2.5 md:flex">
          {currentTab !== "duplicates" ? (
            <>
              <SortMenu
                current={currentSort}
                nameHref={buildHref(currentTab, { sort: "name" })}
                updatedHref={buildHref(currentTab, { sort: "updated" })}
              />
              <div className="flex items-center gap-1 rounded-lg bg-[#f2f4f0] p-0.5">
                {segment("Compact", viewMode === "compact", buildHref(currentTab, { view: "compact" }))}
                {segment("Cozy", viewMode === "cozy", buildHref(currentTab, { view: "cozy" }))}
              </div>
              {hasShared && currentTab === "people" ? (
                <div className="flex items-center gap-1 rounded-lg bg-[#f2f4f0] p-0.5">
                  {segment("All", currentScope === "all" && !currentBook, buildHref("people", { scope: "all", book: null }))}
                  {segment("Private", currentScope === "private" && !currentBook, buildHref("people", { scope: "private", book: null }))}
                  {segment("Family", currentScope === "shared" && !currentBook, buildHref("people", { scope: "shared", book: null }))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <span className="text-[13.5px] font-semibold text-[#1d2823]">{countLabel}</span>
              <div className="ml-auto flex items-center gap-2">
                <MergeSuggestionRefreshButton />
                <BulkMergeButton count={highConfidenceCount} />
              </div>
            </>
          )}
          {currentTab !== "duplicates" ? (
            <span className="ml-auto text-[12.5px] text-[#8b938c]">{countLabel}</span>
          ) : null}
        </div>
        )}

        {/* P31B-05/08: label filter context bar — shown when filtering by a label */}
        {currentLabel && currentTab !== "overview" ? (
          <>
            {(() => {
              const labelMeta = sidebarLabels.find((l) => l.name.toLowerCase() === currentLabel.toLowerCase());
              const labelColor = labelMeta?.color ?? "#8b938c";
              const labelCount = labelMeta?.count ?? 0;
              return (
                <>
                  <div className="hidden md:block">
                    <LabelFilterBar
                      name={currentLabel}
                      color={labelColor}
                      count={labelCount}
                      clearHref={buildHref("people", { filter: "all" })}
                    />
                  </div>
                  <div className="md:hidden">
                    <MobileLabelFilterBar
                      name={currentLabel}
                      color={labelColor}
                      count={labelCount}
                      clearHref={buildHref("people", { filter: "all" })}
                    />
                  </div>
                </>
              );
            })()}
          </>
        ) : null}

        {currentTab === "people" && currentHealthTitle ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9ece7] bg-[#fbfcf9] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">
                Contact health queue
              </p>
              <p className="mt-1 text-[13.5px] text-[#5c655e]">
                Currently showing <span className="font-semibold text-[#1d2823]">{currentHealthTitle}</span>.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8ddd6] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#5c655e] transition hover:bg-[#f6f7f4]"
              href={buildHref("people", { health: null })}
            >
              <WorkspaceIcon name="x" size={14} />
              Clear queue
            </Link>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto pb-24 lg:pb-0">
          {/* P46-DB06 Part B: Overview is a desktop-only surface. The mobile
              wordmark lands on the list; a deep link to ?tab=overview gets a
              small fallback instead of the dashboard. */}
          {currentTab === "overview" ? (
            <div className="px-4 py-6 lg:hidden">
              <div className="rounded-2xl border border-[#d8ddd6] bg-white p-5">
                <p className="text-[15px] font-semibold text-[#1d2823]">Overview lives on desktop</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#5c655e]">
                  On your phone, everything here is a tap away: your contacts, duplicates, and
                  shared items.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/contacts"
                    className="rounded-xl bg-[#17352e] px-4 py-2.5 text-[13.5px] font-semibold text-white"
                  >
                    Open contacts
                  </Link>
                  <Link
                    href="/settings"
                    className="rounded-xl border border-[#d8ddd6] px-4 py-2.5 text-[13.5px] font-semibold text-[#1d2823]"
                  >
                    Settings
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
          {currentTab === "overview" ? (
            <div className="hidden gap-6 px-4 py-4 lg:grid">
              <section className="overflow-hidden rounded-[1.6rem] border border-[#d8ddd6] bg-[linear-gradient(135deg,#f7f8f3_0%,#eef5f0_55%,#f7f4ec_100%)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7d877f]">
                      Overview
                    </p>
                    <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[#1d2823]">
                      Your contact workspace
                    </h1>
                    <p className="mt-2 text-[14px] leading-6 text-[#4f5a53]">
                      Start with the biggest data-quality queues, then jump back into the list when you&apos;re ready to work the details.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="inline-flex h-10 items-center rounded-full bg-[#17352e] px-4 text-[13.5px] font-semibold text-white transition hover:bg-[#21473d]"
                      href={buildHref("people", { filter: "all", health: null })}
                    >
                      Open people
                    </Link>
                    <Link
                      className="inline-flex h-10 items-center rounded-full border border-[#d8ddd6] bg-white px-4 text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
                      href={counts.duplicates > 0 ? buildHref("duplicates", { filter: "all" }) : "/import-export"}
                    >
                      {counts.duplicates > 0 ? "Review duplicates" : "Import contacts"}
                    </Link>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {overviewStats.map((card) => (
                    <div className="rounded-[1.25rem] border border-white/70 bg-white/80 p-4 shadow-[0_12px_32px_rgba(23,53,46,0.04)] backdrop-blur" key={card.label}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7d877f]">
                        {card.label}
                      </p>
                      <p className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[#1d2823]">
                        {card.value.toLocaleString()}
                      </p>
                      <p className="mt-1 text-[13px] leading-5 text-[#5c655e]">{card.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.6rem] border border-[#d8ddd6] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">
                      Contact health
                    </p>
                    <p className="mt-1 text-[14px] text-[#5c655e]">
                      Turn the biggest contact-quality gaps into worklists you can actually clear.
                    </p>
                  </div>
                  <Link
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8ddd6] bg-[#f6f7f4] px-3 py-2 text-[12.5px] font-semibold text-[#5c655e] transition hover:bg-[#edf0ea]"
                    href={buildHref("people", { filter: "all", health: null })}
                  >
                    Open people list
                    <WorkspaceIcon name="chevronRight" size={14} />
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                  {healthCards.map((card) => (
                    <Link
                      className="rounded-[1.3rem] border border-[#e9ece7] bg-[#fbfcf9] px-4 py-4 transition hover:border-[#d8ddd6] hover:bg-white"
                      href={card.href}
                      key={card.key}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13.5px] font-semibold text-[#1d2823]">{card.title}</p>
                          <p className="mt-1 text-[12.5px] leading-5 text-[#5c655e]">{card.description}</p>
                        </div>
                        <span className="text-[20px] font-semibold text-[#1d2823]">
                          {card.count.toLocaleString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                {overviewActions.map((action) => (
                  <Link
                    className="rounded-[1.4rem] border border-[#d8ddd6] bg-white p-5 transition hover:border-[#bcc7bf] hover:bg-[#fbfcf9]"
                    href={action.href}
                    key={action.title}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[16px] font-semibold text-[#1d2823]">{action.title}</p>
                        <p className="mt-2 max-w-xl text-[13.5px] leading-6 text-[#5c655e]">{action.body}</p>
                      </div>
                      <WorkspaceIcon className="mt-0.5 text-[#8b938c]" name="chevronRight" size={18} />
                    </div>
                  </Link>
                ))}
              </section>
            </div>
          ) : null}

          {showOnboarding ? (
            <div className="px-4 pt-3">
              <OnboardingChecklist
                steps={onboarding.steps}
                doneCount={onboarding.doneCount}
                total={onboarding.total}
                allDone={onboarding.allDone}
                needsExploreRecord={onboarding.needsExploreRecord}
              />
            </div>
          ) : null}
          {/* P46-10: health worklist relocated from the removed mobile
              Overview — dismissible amber prompt above the People list. Hidden
              while a health queue is active (the queue banner owns the slot). */}
          {currentTab === "people" && !currentHealthTitle && healthPrompt && !contactsTrulyEmpty ? (
            <MobileHealthPrompt count={healthPrompt.count} href={healthPrompt.href} />
          ) : null}
          {currentTab === "people" ? (
            contactsTrulyEmpty ? (
              <EmptyState
                icon="personPlus"
                title="Your contacts will appear here"
                body="Import from Google or Apple, add one by one, or connect a sync account to get started."
              >
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <Link
                    className="inline-flex h-10 items-center rounded-[10px] bg-[#4158f4] px-4 text-[13.5px] font-semibold text-white transition hover:bg-[#3347d8]"
                    href="/import-export"
                  >
                    Import contacts
                  </Link>
                  <Link
                    className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#d8ddd6] bg-white px-4 text-[13.5px] font-medium text-[#1d2823] transition hover:bg-[#f2f4f0]"
                    href="/contacts/new"
                  >
                    <WorkspaceIcon name="plus" size={16} strokeWidth={2} />
                    Add manually
                  </Link>
                </div>
                <p className="text-[13px] text-[#5c655e]">
                  Or{" "}
                  <Link className="font-medium text-[#4158f4] hover:underline" href="/sync">
                    connect a sync account&nbsp;→
                  </Link>
                </p>
              </EmptyState>
            ) : (
              <ContactsWorkspaceTable
                key={JSON.stringify(listRequest)}
                contacts={activeContacts}
                totalCount={listTotalCount}
                listRequest={listRequest}
                emptyState={
                  query
                    ? `No contacts match "${query}".`
                    : isFavoritesView
                      ? "No favorites yet. Star a contact to pin it here."
                      : isEmergencyView
                        ? "No emergency contacts yet. Mark a contact as emergency to pull it up fast."
                        : currentHealthTitle
                          ? `No contacts currently match ${currentHealthTitle.toLowerCase()}.`
                        : currentFilter === "incomplete"
                          ? "No contacts are missing details."
                          : "Your contacts list is empty. Add your first contact or import from Google, Apple, or Outlook."
                }
                groupByLetter={groupByLetter}
                mode="active"
                nameDisplayOrder={nameDisplayOrder}
                rowLabels={rowLabels}
                query={query}
                viewMode={viewMode}
                books={personalBooks}
                labelSuggestions={labelSuggestions}
                smartLists={savedFilters}
                labelRegistry={sidebarLabels}
              />
            )
          ) : null}

          {currentTab === "archived" ? (
            <ContactsWorkspaceTable
              key={JSON.stringify(listRequest)}
              contacts={archivedContacts}
              totalCount={listTotalCount}
              listRequest={listRequest}
              emptyState={query ? `No archived contacts match "${query}".` : "No archived contacts."}
              groupByLetter={groupByLetter}
              mode="archived"
              nameDisplayOrder={nameDisplayOrder}
              rowLabels={rowLabels}
              query={query}
              viewMode={viewMode}
              books={personalBooks}
              labelSuggestions={labelSuggestions}
              smartLists={savedFilters}
              labelRegistry={sidebarLabels}
            />
          ) : null}

          {currentTab === "duplicates" ? (
            <div className="grid gap-6">
              {mergeSuggestionsRefreshed ? (
                <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f7a67]">
                  Suggestions refreshed
                </p>
              ) : null}
              <MergeSuggestionList
                suggestions={mergeSuggestions}
                totalCount={counts.duplicates}
              />

              {recentMerges.length > 0 ? (
                <div className="p-4 pt-0">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Merged contacts
                  </p>
                  <div className="overflow-hidden rounded-[1.2rem] border border-[#d8ddd6] bg-white">
                    {recentMerges.map((merge) => (
                      <div
                        className="flex items-center gap-3 border-b border-[#edf0ea] px-4 py-3 last:border-b-0"
                        key={merge.decisionId}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            <Link className="hover:underline" href={`/contacts/${merge.survivorContactId}`}>
                              {merge.survivorName}
                            </Link>{" "}
                            <span className="text-[#8b938c]">←</span> {merge.absorbedName}
                          </p>
                          <p className="text-xs text-[#8b938c]">
                            {mergeDateFormatter.format(merge.decidedAt)}
                            {merge.source === "bulk-accept" ? " · bulk" : ""}
                          </p>
                        </div>
                        {merge.canUndo ? (
                          <UndoMergeButton
                            absorbedName={merge.absorbedName}
                            decisionId={merge.decisionId}
                            survivorName={merge.survivorName}
                          />
                        ) : (
                          <span className="text-xs font-medium text-[#aeb4ac]">Expired</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {currentTab === "activity" ? (
            planSummary.activityEnabled ? (
              <>
                {/* desktop feed (unchanged); mobile renders purpose-built rows (P24B-09) */}
                <div className="hidden md:block">
                  <ActivityFeed />
                </div>
                <MobileActivityFeed />
              </>
            ) : (
              <ActivityLocked planLabel={planSummary.planLabel} />
            )
          ) : null}
        </div>
      </section>
      {/* Mobile bottom nav is provided by the shared <BottomNav> in contacts/page.tsx
          (Contacts · Activity · Sync · Settings). The legacy in-dashboard nav was
          removed — it duplicated/conflicted with BottomNav and showed the wrong tabs
          at tablet widths (768–1023px). */}
    </div>
  );
}
