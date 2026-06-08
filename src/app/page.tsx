import Link from "next/link";

import { ContactDashboard } from "~/app/_components/contact-dashboard";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { getOpenMergeSuggestionsForUser } from "~/server/contact-merge";
import { db } from "~/server/db";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ContactsWorkspaceTab = "people" | "archived" | "duplicates";
type ContactsWorkspaceFilter = "all" | "recent" | "incomplete" | "favorites";
type ContactsWorkspaceSort = "updated" | "name";
type ContactsWorkspaceView = "compact" | "cozy";

const getSingleParam = async (
  searchParams: HomePageProps["searchParams"],
  key: string,
) => {
  const params = searchParams ? await searchParams : undefined;
  const rawValue = params?.[key];
  return Array.isArray(rawValue) ? rawValue[0] : rawValue;
};

const getQueryValue = async (searchParams?: HomePageProps["searchParams"]) => {
  const query = await getSingleParam(searchParams, "q");

  return query?.trim() ?? "";
};

const getSelectedTab = async (
  searchParams?: HomePageProps["searchParams"],
): Promise<ContactsWorkspaceTab> => {
  const tab = await getSingleParam(searchParams, "tab");

  if (tab === "archived" || tab === "duplicates") {
    return tab;
  }

  return "people";
};

const getSelectedFilter = async (
  searchParams?: HomePageProps["searchParams"],
): Promise<ContactsWorkspaceFilter> => {
  const filter = await getSingleParam(searchParams, "filter");

  if (filter === "recent" || filter === "incomplete" || filter === "favorites") {
    return filter;
  }

  return "all";
};

const getSelectedSort = async (
  searchParams?: HomePageProps["searchParams"],
): Promise<ContactsWorkspaceSort> => {
  const sort = await getSingleParam(searchParams, "sort");

  if (sort === "name") {
    return "name";
  }

  return "name";
};

const getSelectedView = async (
  searchParams?: HomePageProps["searchParams"],
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
          {
            fullName: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            phoneticFirstName: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            phoneticLastName: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            nickname: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            email: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            phone: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            company: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            phoneticCompany: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            jobTitle: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            website: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            address: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
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
  firstName,
  lastName,
  company,
  fullName,
}: {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  fullName: string | null;
}) => {
  const first = normalizeSortText(firstName);
  const last = normalizeSortText(lastName);
  const companyValue = normalizeSortText(company);
  const full = normalizeSortText(fullName);

  if (!first || !last) {
    const fallback = companyValue || full;
    return {
      primary: fallback,
      secondary: fallback,
      company: companyValue,
      full: full || companyValue,
    };
  }

  return {
    primary: last,
    secondary: first,
    company: companyValue,
    full: full,
  };
};

const compareWorkspaceContacts = (
  left: {
    isFavorite: boolean;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    fullName: string | null;
  },
  right: {
    isFavorite: boolean;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
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
  if (primaryCompare !== 0) {
    return primaryCompare;
  }

  const secondaryCompare = collation.compare(leftKeys.secondary, rightKeys.secondary);
  if (secondaryCompare !== 0) {
    return secondaryCompare;
  }

  const companyCompare = collation.compare(leftKeys.company, rightKeys.company);
  if (companyCompare !== 0) {
    return companyCompare;
  }

  const fullCompare = collation.compare(leftKeys.full, rightKeys.full);
  if (fullCompare !== 0) {
    return fullCompare;
  }

  return 0;
};

const PublicLanding = () => (
  <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#07111d_45%,#0f172a_100%)] text-white">
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-12 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-10">
      <section className="max-w-2xl space-y-6">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Kontax</p>
        <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          Your personal contact home, built to stay clean as life gets messier.
        </h1>
        <p className="max-w-xl text-base text-slate-300 sm:text-lg">
          Save the people who matter, keep details current, and grow into imports, merge tools,
          and sync without rebuilding your contact foundation later.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            className="rounded-full bg-white px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-100"
            href="/register"
          >
            Create account
          </Link>
          <Link
            className="rounded-full border border-white/15 px-6 py-3 text-center font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
            href="/login"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="grid max-w-xl gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(2,8,23,0.45)] backdrop-blur sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-white/10 bg-[#08101c] p-5">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Today</p>
          <p className="mt-3 text-3xl font-semibold text-white">Contact dashboard</p>
          <p className="mt-2 text-sm text-slate-400">
            Sign up, save people, archive safely, and manage details from one workspace.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-[#08101c] p-5">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Next</p>
          <p className="mt-3 text-3xl font-semibold text-white">Billing and portability</p>
          <p className="mt-2 text-sm text-slate-400">
            Plans, import jobs, and portable export formats are now part of the foundation.
          </p>
        </div>
      </section>
    </div>
  </main>
);

export default async function Home({ searchParams }: HomePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return <PublicLanding />;
  }

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
      ? {
          updatedAt: {
            gte: recentCutoff,
          },
        }
      : selectedFilter === "incomplete"
        ? {
            OR: [{ email: null }, { email: "" }, { phone: null }, { phone: "" }],
          }
        : selectedFilter === "favorites"
          ? {
              isFavorite: true,
            }
        : {};
  const [activeContacts, archivedContacts, mergeSuggestions, planSummary] = await Promise.all([
    db.contact.findMany({
      where: {
        userId: session.user.id,
        archivedAt: null,
        ...searchConditions,
        ...filterConditions,
      },
      orderBy:
        selectedSort === "name"
          ? {
              isFavorite: "desc" as const,
            }
          : {
              updatedAt: "desc" as const,
            },
      select: {
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
        notes: true,
        archivedAt: true,
        updatedAt: true,
      },
    }),
    db.contact.findMany({
      where: {
        userId: session.user.id,
        NOT: {
          archivedAt: null,
        },
        ...searchConditions,
        ...filterConditions,
      },
      orderBy:
        selectedSort === "name"
          ? [
              {
                isFavorite: "desc" as const,
              },
              {
                archivedAt: "desc" as const,
              },
            ]
          : {
              archivedAt: "desc",
            },
      select: {
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
        notes: true,
        archivedAt: true,
        updatedAt: true,
      },
    }),
    getOpenMergeSuggestionsForUser(session.user.id),
    getUserPlanSummary(session.user.id),
  ]);

  const sortedActiveContacts =
    selectedSort === "name"
      ? [...activeContacts].sort(compareWorkspaceContacts)
      : activeContacts;
  const sortedArchivedContacts =
    selectedSort === "name"
      ? [...archivedContacts].sort(compareWorkspaceContacts)
      : archivedContacts;

  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";
  const userInitials = getInitials(userLabel);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4f6f1_0%,#f8faf7_24%,#fbfcfa_100%)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-[#d9ddd8] bg-[rgba(249,250,246,0.96)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1800px] items-center gap-3 px-4 py-3 lg:px-6">
          <Link className="flex shrink-0 items-center gap-3" href="/">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] bg-[#17352e] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(23,53,46,0.18)]">
              K
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="text-sm font-semibold tracking-tight text-slate-900">Kontax</p>
              <p className="text-xs text-slate-500">Contacts</p>
            </div>
          </Link>

          <form className="flex min-w-0 flex-1 items-center gap-3" method="get">
            <input name="tab" type="hidden" value={selectedTab} />
            <input name="filter" type="hidden" value={selectedFilter} />
            <input name="sort" type="hidden" value={selectedSort} />
            <input name="view" type="hidden" value={selectedView} />
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-2.5 shadow-sm">
              <span className="text-sm text-slate-400">Search</span>
              <input
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                defaultValue={query}
                name="q"
                placeholder="Search contacts by name, Pinyin, email, phone, company, website, or address"
                type="search"
              />
            </div>
            <button
              className="hidden rounded-[1.1rem] border border-[#d8ddd6] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#c9d0c9] hover:bg-slate-50 md:inline-flex"
              type="submit"
            >
              Search
            </button>
          </form>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              className="hidden rounded-[1.1rem] border border-[#d8ddd6] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#c9d0c9] hover:bg-slate-50 lg:inline-flex"
              href="/import-export"
            >
              Import / export
            </Link>
            <Link
              className={`rounded-[1.1rem] px-4 py-2.5 text-sm font-semibold transition ${
                planSummary.lifecyclePolicy.canWrite
                  ? "bg-[#4158f4] text-white hover:bg-[#3248db]"
                  : "cursor-not-allowed bg-slate-200 text-slate-500"
              }`}
              href={planSummary.lifecyclePolicy.canWrite ? "/contacts/new" : "/settings"}
            >
              Create contact
            </Link>
            <Link
              className="flex items-center gap-3 rounded-[1.1rem] border border-[#d8ddd6] bg-white px-3 py-2 transition hover:border-[#c9d0c9] hover:bg-slate-50"
              href="/settings"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dfe3ff] text-xs font-semibold text-[#4158f4]">
                {userInitials}
              </div>
              <div className="hidden text-left xl:block">
                <p className="text-sm font-semibold text-slate-900">{userLabel}</p>
                <p className="text-xs text-slate-500">{session.user.email}</p>
              </div>
            </Link>
          </div>
        </div>
      </header>

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
        }}
        query={query}
        viewMode={selectedView}
      />
    </main>
  );
}
