import Link from "next/link";

import { ContactDashboard } from "~/app/_components/contact-dashboard";
import { signOut } from "~/server/auth";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { getOpenMergeSuggestionsForUser } from "~/server/contact-merge";
import { db } from "~/server/db";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getQueryValue = async (searchParams?: HomePageProps["searchParams"]) => {
  const params = searchParams ? await searchParams : undefined;
  const rawQuery = params?.q;
  const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;

  return query?.trim() ?? "";
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
        ],
      }
    : {};

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

  const query = await getQueryValue(searchParams);
  const params = searchParams ? await searchParams : undefined;
  const mergeSuggestionsRefreshedParam = params?.mergeSuggestionsRefreshed;
  const mergeSuggestionsRefreshedValue = Array.isArray(mergeSuggestionsRefreshedParam)
    ? mergeSuggestionsRefreshedParam[0]
    : mergeSuggestionsRefreshedParam;
  const mergeSuggestionsRefreshed = mergeSuggestionsRefreshedValue === "1";
  const searchConditions = getSearchConditions(query);
  const [activeContacts, archivedContacts, mergeSuggestions, planSummary] = await Promise.all([
    db.contact.findMany({
      where: {
        userId: session.user.id,
        archivedAt: null,
        ...searchConditions,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        company: true,
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
      },
      orderBy: {
        archivedAt: "desc",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        company: true,
        notes: true,
        archivedAt: true,
        updatedAt: true,
      },
    }),
    getOpenMergeSuggestionsForUser(session.user.id),
    getUserPlanSummary(session.user.id),
  ]);

  const handleSignOut = async () => {
    "use server";

    await signOut({ redirectTo: "/login" });
  };

  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "friend";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#020817]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Kontax</p>
            <p className="mt-1 text-sm text-slate-400">Personal contact workspace</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{session.user.email}</p>
              <p className="text-xs text-slate-400">Signed in</p>
            </div>
            <form action={handleSignOut}>
              <button
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <ContactDashboard
        activeContacts={activeContacts}
        archivedContacts={archivedContacts}
        planSummary={{
          planLabel: planSummary.planLabel,
          contactsUsed: planSummary.contactsUsed,
          contactsRemaining: planSummary.contactsRemaining,
          contactsLimit: planSummary.entitlements.contactsLimit,
          importedThisMonth: planSummary.importedThisMonth,
          monthlyImportLimit: planSummary.entitlements.monthlyImportLimit,
          premiumExportEnabled: planSummary.entitlements.premiumExportEnabled,
        }}
        query={query}
        mergeSuggestions={mergeSuggestions}
        mergeSuggestionsRefreshed={mergeSuggestionsRefreshed}
        userLabel={userLabel}
      />
    </>
  );
}
