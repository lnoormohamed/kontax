import Link from "next/link";

import { ContactsWorkspaceTable } from "~/app/_components/contacts-workspace-table";
import { MergeSuggestionDismissButton } from "~/app/_components/merge-suggestion-dismiss-button";
import { MergeSuggestionRefreshButton } from "~/app/_components/merge-suggestion-refresh-button";
import type { BillingLifecycleState } from "~/server/billing";
import type { PersistedMergeSuggestion } from "~/server/contact-merge";

type DashboardContact = {
  id: string;
  fullName: string;
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
  notes: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
};

type PlanSummary = {
  planLabel: string;
  lifecycleState: BillingLifecycleState;
  lifecycleLabel: string;
  lifecycleDescription: string;
  canWrite: boolean;
  canUseBasicExport: boolean;
  contactsUsed: number;
  contactsRemaining: number;
  contactsLimit: number;
  importedThisMonth: number;
  monthlyImportLimit: number;
  premiumExportEnabled: boolean;
};

type ContactDashboardProps = {
  activeContacts: DashboardContact[];
  archivedContacts: DashboardContact[];
  currentFilter: "all" | "recent" | "incomplete" | "favorites";
  currentSort: "updated" | "name";
  currentTab: "people" | "archived" | "duplicates";
  query: string;
  planSummary: PlanSummary;
  mergeSuggestions: PersistedMergeSuggestion[];
  mergeSuggestionsRefreshed: boolean;
  viewMode: "compact" | "cozy";
};

const getLifecycleTone = (state: BillingLifecycleState) => {
  if (state === "ACTIVE" || state === "TRIALING") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (state === "GRACE") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
};

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
}: ContactDashboardProps) {
  const visibleCount = activeContacts.length + archivedContacts.length;
  const needsDetailsCount = activeContacts.filter((contact) => !contact.email && !contact.phone).length;
  const totalContacts = activeContacts.length;
  const buildWorkspaceHref = (
    tab: "people" | "archived" | "duplicates",
    overrides?: {
      filter?: "all" | "recent" | "incomplete" | "favorites";
      sort?: "updated" | "name";
      view?: "compact" | "cozy";
    },
  ) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("filter", overrides?.filter ?? currentFilter);
    params.set("sort", overrides?.sort ?? currentSort);
    params.set("view", overrides?.view ?? viewMode);
    if (query) {
      params.set("q", query);
    }
    return `/?${params.toString()}`;
  };
  const peopleTabHref = buildWorkspaceHref("people");
  const archivedTabHref = buildWorkspaceHref("archived");
  const duplicatesTabHref = buildWorkspaceHref("duplicates");

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-5 lg:px-6 lg:py-6">
      <section className="overflow-hidden rounded-[2rem] border border-[#d8ddd6] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
        <div className="border-b border-[#e7ebe5] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Contacts
              </p>
              <h1 className="mt-1 text-[1.9rem] font-semibold tracking-tight text-slate-900">
                {query ? `Search results for "${query}"` : "People"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Keep the list fast, the actions obvious, and the details one click away.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <Link
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  currentTab === "people"
                    ? "bg-[#17352e] text-white"
                    : "border border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                }`}
                href={peopleTabHref}
              >
                People
              </Link>
              <Link
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  currentTab === "archived"
                    ? "bg-[#17352e] text-white"
                    : "border border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                }`}
                href={archivedTabHref}
              >
                Archived
              </Link>
              <Link
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  currentTab === "duplicates"
                    ? "bg-[#17352e] text-white"
                    : "border border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                }`}
                href={duplicatesTabHref}
              >
                Duplicates
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <Link
                className="rounded-full border border-[#d8ddd6] bg-[#fbfcf8] px-3 py-2 text-slate-600 transition hover:bg-slate-50"
                href="/merge/manual"
              >
                Manual merge
              </Link>
              <Link
                className="rounded-full border border-[#d8ddd6] bg-[#fbfcf8] px-3 py-2 text-slate-600 transition hover:bg-slate-50"
                href="/sync"
              >
                Sync center
              </Link>
              <Link
                className="rounded-full border border-[#d8ddd6] bg-[#fbfcf8] px-3 py-2 text-slate-600 transition hover:bg-slate-50"
                href="/settings"
              >
                Settings
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1.5 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{visibleCount}</span> visible
            </div>
            <div className="rounded-full border border-[#d8ddd6] bg-[#fbfcf8] px-3 py-1.5 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{needsDetailsCount}</span> need enrichment
            </div>
            <div className="rounded-full border border-[#d8ddd6] bg-[#f7f8ff] px-3 py-1.5 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{planSummary.contactsRemaining}</span> plan space
            </div>
            <div className="rounded-full border border-[#d8ddd6] bg-[#fdf9f1] px-3 py-1.5 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{mergeSuggestions.length}</span> duplicates
            </div>
          </div>
        </div>

        {mergeSuggestionsRefreshed ? (
          <div className="mx-4 mt-4 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm sm:mx-6">
            Duplicate suggestions refreshed successfully.
          </div>
        ) : null}

        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 border-b border-[#eef1eb] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {currentTab === "people"
                  ? "People"
                  : currentTab === "archived"
                    ? "Archived contacts"
                    : "Duplicate review"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {currentTab === "people"
                  ? `${totalContacts} active contacts ready for quick scanning and detail updates.`
                  : currentTab === "archived"
                    ? "Archived contacts stay recoverable instead of disappearing into a hidden bin."
                    : "Review suggested duplicates without leaving the primary workspace."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getLifecycleTone(
                  planSummary.lifecycleState,
                )}`}
              >
                {planSummary.lifecycleLabel}
              </span>
              {currentTab === "duplicates" ? <MergeSuggestionRefreshButton /> : null}
            </div>
          </div>

          <div className="sticky top-[77px] z-10 -mx-4 border-b border-[#eef1eb] bg-[rgba(255,255,255,0.96)] px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <Link
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    currentFilter === "all"
                      ? "border-[#d8ddd6] bg-[#f8faf8] font-semibold text-slate-900"
                      : "border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  href={buildWorkspaceHref(currentTab, { filter: "all" })}
                >
                  All contacts
                </Link>
                <Link
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    currentFilter === "recent"
                      ? "border-[#d8ddd6] bg-[#f8faf8] font-semibold text-slate-900"
                      : "border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  href={buildWorkspaceHref(currentTab, { filter: "recent" })}
                >
                  Recently updated
                </Link>
                <Link
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    currentFilter === "incomplete"
                      ? "border-[#d8ddd6] bg-[#f8faf8] font-semibold text-slate-900"
                      : "border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  href={buildWorkspaceHref(currentTab, { filter: "incomplete" })}
                >
                  Missing details
                </Link>
                <Link
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    currentFilter === "favorites"
                      ? "border-[#d8ddd6] bg-[#f8faf8] font-semibold text-slate-900"
                      : "border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  href={buildWorkspaceHref(currentTab, { filter: "favorites" })}
                >
                  Favorites
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    currentSort === "updated"
                      ? "border-[#d8ddd6] bg-[#f8faf8] font-semibold text-slate-900"
                      : "border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  href={buildWorkspaceHref(currentTab, { sort: "updated" })}
                >
                  Sort: Updated
                </Link>
                <Link
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    currentSort === "name"
                      ? "border-[#d8ddd6] bg-[#f8faf8] font-semibold text-slate-900"
                      : "border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  href={buildWorkspaceHref(currentTab, { sort: "name" })}
                >
                  Sort: Name
                </Link>
                <Link
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    viewMode === "compact"
                      ? "border-[#d8ddd6] bg-[#f8faf8] font-semibold text-slate-900"
                      : "border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  href={buildWorkspaceHref(currentTab, { view: "compact" })}
                >
                  View: Compact
                </Link>
                <Link
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    viewMode === "cozy"
                      ? "border-[#d8ddd6] bg-[#f8faf8] font-semibold text-slate-900"
                      : "border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  href={buildWorkspaceHref(currentTab, { view: "cozy" })}
                >
                  View: Cozy
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {currentTab === "people" ? (
              <ContactsWorkspaceTable
                contacts={activeContacts}
                emptyState="No active contacts match this view yet."
                mode="active"
                viewMode={viewMode}
              />
            ) : null}

            {currentTab === "archived" ? (
              <ContactsWorkspaceTable
                contacts={archivedContacts}
                emptyState="No archived contacts match this view yet."
                mode="archived"
                viewMode={viewMode}
              />
            ) : null}

            {currentTab === "duplicates" ? (
              mergeSuggestions.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-[#d8ddd6] bg-[#fbfcf8] px-6 py-12 text-sm text-slate-500">
                  No duplicate suggestions are open right now.
                </div>
              ) : (
                <div className="grid gap-4">
                  {mergeSuggestions.map((suggestion) => (
                    <article
                      className="rounded-[1.6rem] border border-[#d8ddd6] bg-[#fcfcfa] p-5"
                      key={suggestion.id}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-lg font-semibold text-slate-900">
                              {suggestion.leftContact.fullName} ↔ {suggestion.rightContact.fullName}
                            </p>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                                suggestion.confidence === "high"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {suggestion.confidence}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            Score {suggestion.score} · {suggestion.hardMatch ? "Hard match" : "Needs review"}
                          </p>
                          <div className="mt-3 grid gap-2 text-sm text-slate-600">
                            {suggestion.reasons.map((reason) => (
                              <p key={reason}>{reason}</p>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="rounded-full bg-[#17352e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#20443b]"
                            href={`/merge-suggestions/${suggestion.id}`}
                          >
                            Review
                          </Link>
                          <Link
                            className="rounded-full border border-[#d8ddd6] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            href={`/contacts/${suggestion.leftContact.id}`}
                          >
                            Open contact
                          </Link>
                          <MergeSuggestionDismissButton suggestionId={suggestion.id} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
