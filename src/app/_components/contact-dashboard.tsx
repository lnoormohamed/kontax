import Link from "next/link";

import { ActivityFeed, ActivityLocked } from "~/app/_components/activity-feed";
import { ContactsWorkspaceTable } from "~/app/_components/contacts-workspace-table";
import { EmptyState } from "~/app/_components/empty-state";
import { LabelFilterBar, MobileLabelFilterBar } from "~/app/_components/label-filter-bar";
import { LabelsSidebar, type SidebarLabel } from "~/app/_components/labels-sidebar";
import { BulkMergeButton, UndoMergeButton } from "~/app/_components/merge-actions";
import { MobileActivityFeed } from "~/app/_components/mobile-activity-feed";
import { MergeSuggestionList } from "~/app/_components/merge-suggestion-card";
import { MergeSuggestionRefreshButton } from "~/app/_components/merge-suggestion-refresh-button";
import { OnboardingChecklist } from "~/app/_components/onboarding-checklist";
import { SmartListsBooks, type PersonalBook, type SmartList } from "~/app/_components/smart-lists-books";
import { SortMenu } from "~/app/_components/sort-menu";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import type { BillingLifecycleState } from "~/server/billing";
import type { PersistedMergeSuggestion, RecentMerge } from "~/server/contact-merge";
import type { OnboardingChecklist as OnboardingChecklistData } from "~/server/onboarding";

type DashboardContact = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  phoneticFirstName: string | null;
  phoneticLastName: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  phoneticCompany: string | null;
  jobTitle: string | null;
  website: string | null;
  birthday: string | null;
  address: string | null;
  isFavorite: boolean;
  isEmergency: boolean;
  sharedKind: "family" | "team" | null;
  notes: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
  labels?: unknown; // P31B-06: JSON string[] from Prisma
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

type WorkspaceTab = "people" | "archived" | "duplicates" | "activity";
type WorkspaceFilter = "all" | "recent" | "incomplete" | "favorites" | "emergency";
type WorkspaceSort = "updated" | "name";
type WorkspaceView = "compact" | "cozy";

type ContactDashboardProps = {
  activeContacts: DashboardContact[];
  archivedContacts: DashboardContact[];
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
    },
  ) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("filter", overrides?.filter ?? currentFilter);
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
    if (query) {
      params.set("q", query);
    }
    return `/contacts?${params.toString()}`;
  };

  const isFavoritesView = currentTab === "people" && currentFilter === "favorites";
  const isEmergencyView = currentTab === "people" && currentFilter === "emergency";
  const peopleActive = currentTab === "people" && !isFavoritesView && !isEmergencyView;
  const groupByLetter = currentSort === "name" && !query;

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
    currentTab === "people"
      ? `${counts.people} contacts`
      : currentTab === "archived"
        ? `${counts.archived} archived`
        : `${counts.duplicates} duplicates`;

  return (
    <div className="flex min-h-0 flex-1">
      {/* sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#d8ddd6] bg-white px-3 py-3.5 md:flex">
        <Link
          className="mb-2 flex items-center gap-3 rounded-xl border border-[#e9ece7] bg-[#f6f7f4] p-2.5 transition hover:bg-[#f2f4f0]"
          href="/settings"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17352e] text-xs font-semibold text-[#dff0e7]">
            {getInitials(account.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-[#1d2823]">{account.name}</span>
            <span className="block truncate text-[11px] text-[#8b938c]">{account.email}</span>
          </span>
          <span className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#17352e]">
            {planSummary.planLabel}
          </span>
        </Link>

        {navItem(peopleActive, buildHref("people", { filter: "all" }), "people", "People", counts.people)}
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
        {navItem(false, "/shares", "download", "Shared with me", incomingShares ?? null, true)}

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
        {currentTab === "activity" ? null : (
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
        {currentLabel ? (
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

        <div className="flex-1 overflow-y-auto pb-24 lg:pb-0">
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
                contacts={activeContacts}
                emptyState={
                  query
                    ? `No contacts match "${query}".`
                    : isFavoritesView
                      ? "No favorites yet. Star a contact to pin it here."
                      : isEmergencyView
                        ? "No emergency contacts yet. Mark a contact as emergency to pull it up fast."
                        : currentFilter === "incomplete"
                          ? "No contacts are missing details."
                          : "Your contacts list is empty. Add your first contact or import from Google, Apple, or Outlook."
                }
                groupByLetter={groupByLetter}
                mode="active"
                nameDisplayOrder={nameDisplayOrder}
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
              contacts={archivedContacts}
              emptyState={query ? `No archived contacts match "${query}".` : "No archived contacts."}
              groupByLetter={groupByLetter}
              mode="archived"
              nameDisplayOrder={nameDisplayOrder}
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
