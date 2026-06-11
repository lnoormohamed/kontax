import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import {
  MergeReview,
  type MergeReviewContact,
  type MergeReviewUnions,
} from "~/app/_components/merge-review";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";
import {
  buildMergedContactPreview,
  getMergeSuggestionByIdForUser,
  type MergePreview,
} from "~/server/contact-merge";

type PageProps = {
  params: Promise<{ id: string }>;
};

const toUnions = (preview: MergePreview): MergeReviewUnions => {
  const m = preview.mergedContact;
  return {
    emails: m.emailAddresses ?? [],
    phones: m.phoneNumbers ?? [],
    addresses: (m.postalAddresses ?? []).map((e) => e.formatted),
    websites: (m.websiteEntries ?? []).map((e) => e.value),
    labels: m.labels ?? [],
    dates: (m.significantDates ?? []).map((e) => `${e.label}: ${e.date}`),
    related: (m.relatedPeople ?? []).map((e) => `${e.relationship}: ${e.name}`),
    custom: (m.customFields ?? []).map((e) => `${e.label}: ${e.value}`),
  };
};

const toReviewContact = (c: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  nickname: string | null;
  website: string | null;
  birthday: string | null;
  notes: string | null;
}): MergeReviewContact => ({
  id: c.id,
  fullName: c.fullName,
  email: c.email,
  phone: c.phone,
  company: c.company,
  jobTitle: c.jobTitle,
  nickname: c.nickname,
  website: c.website,
  birthday: c.birthday,
  notes: c.notes,
});

export default async function MergeSuggestionReviewPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;
  const [suggestion, planSummary, contactCounts] = await Promise.all([
    getMergeSuggestionByIdForUser(userId, id),
    getUserPlanSummary(userId),
    db.contact.groupBy({
      by: ["archivedAt"],
      where: { userId },
      _count: { id: true },
    }),
  ]);

  if (!suggestion) {
    notFound();
  }

  const people = contactCounts.find((r) => r.archivedAt === null)?._count.id ?? 0;
  const archived = contactCounts.find((r) => r.archivedAt !== null)?._count.id ?? 0;
  const openDuplicates = await db.mergeSuggestion.count({
    where: { userId, status: "OPEN" },
  });

  const keepLeftPreview = buildMergedContactPreview(
    suggestion.leftContact,
    suggestion.rightContact,
  );
  const keepRightPreview = buildMergedContactPreview(
    suggestion.rightContact,
    suggestion.leftContact,
  );

  const contributionLabels = new Set(suggestion.contributions.map((c) => c.label));
  const warnings = suggestion.reasons.filter(
    (reason) => !contributionLabels.has(reason),
  );

  const userLabel =
    session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  return (
    <AppShell
      account={{
        name: userLabel,
        email: session.user.email ?? "",
        plan: planSummary.planLabel,
      }}
      counts={{
        people,
        favorites: 0,
        archived,
        duplicates: openDuplicates,
      }}
    >
      <div
        className="mx-auto grid w-full content-start gap-[18px] px-7 pb-28 pt-8"
        style={{ maxWidth: 860 }}
      >
          {/* Back link */}
          <Link
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#4158f4] hover:underline"
            href="/?tab=duplicates"
          >
            <svg
              fill="none"
              height="15"
              stroke="#4158f4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="15"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Back to duplicates
          </Link>

          <MergeReview
            confidence={suggestion.confidence}
            contactA={toReviewContact(suggestion.leftContact)}
            contactB={toReviewContact(suggestion.rightContact)}
            contributions={suggestion.contributions}
            mergeSource="suggestion-review"
            score={suggestion.score}
            suggestionId={suggestion.id}
            unionsA={toUnions(keepLeftPreview)}
            unionsB={toUnions(keepRightPreview)}
            warnings={warnings}
          />
      </div>
    </AppShell>
  );
}
