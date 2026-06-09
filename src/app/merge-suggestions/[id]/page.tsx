import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MergeReview, type MergeReviewUnions } from "~/app/_components/merge-review";
import { MergeSuggestionDismissButton } from "~/app/_components/merge-suggestion-dismiss-button";
import { auth } from "~/server/auth";
import {
  buildMergedContactPreview,
  getMergeSuggestionByIdForUser,
  type MergePreview,
} from "~/server/contact-merge";

type MergeSuggestionReviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const toUnions = (preview: MergePreview): MergeReviewUnions => {
  const merged = preview.mergedContact;
  return {
    emails: merged.emailAddresses ?? [],
    phones: merged.phoneNumbers ?? [],
    addresses: (merged.postalAddresses ?? []).map((entry) => entry.formatted),
    websites: (merged.websiteEntries ?? []).map((entry) => entry.value),
    labels: merged.labels ?? [],
    dates: (merged.significantDates ?? []).map((entry) => `${entry.label}: ${entry.date}`),
    related: (merged.relatedPeople ?? []).map((entry) => `${entry.relationship}: ${entry.name}`),
    custom: (merged.customFields ?? []).map((entry) => `${entry.label}: ${entry.value}`),
  };
};

const confidenceBadge: Record<string, string> = {
  high: "bg-[#eef5ef] text-[#17352e]",
  medium: "bg-[#f6edd9] text-[#7a5a1a]",
  low: "bg-[#eef0f3] text-[#5c655e]",
};

export default async function MergeSuggestionReviewPage({
  params,
}: MergeSuggestionReviewPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const suggestion = await getMergeSuggestionByIdForUser(session.user.id, id);

  if (!suggestion) {
    notFound();
  }

  const keepLeftPreview = buildMergedContactPreview(
    suggestion.leftContact,
    suggestion.rightContact,
  );
  const keepRightPreview = buildMergedContactPreview(
    suggestion.rightContact,
    suggestion.leftContact,
  );

  const contactA = {
    id: suggestion.leftContact.id,
    fullName: suggestion.leftContact.fullName,
    email: suggestion.leftContact.email,
    phone: suggestion.leftContact.phone,
    company: suggestion.leftContact.company,
    notes: suggestion.leftContact.notes,
  };
  const contactB = {
    id: suggestion.rightContact.id,
    fullName: suggestion.rightContact.fullName,
    email: suggestion.rightContact.email,
    phone: suggestion.rightContact.phone,
    company: suggestion.rightContact.company,
    notes: suggestion.rightContact.notes,
  };

  // Reasons that aren't scored signal contributions are edge-case warnings.
  const contributionLabels = new Set(suggestion.contributions.map((c) => c.label));
  const warnings = suggestion.reasons.filter((reason) => !contributionLabels.has(reason));

  return (
    <main className="min-h-screen bg-[#f4f6f2] text-[#1d2823]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 lg:py-12">
        <div>
          <Link className="text-[13px] font-semibold text-[#4158f4]" href="/?tab=duplicates">
            ← Back to duplicates
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Review duplicate</h1>
          <p className="mt-2 text-[14px] text-[#5c655e]">
            Pick which record survives, resolve any conflicting fields, then merge. Multi-value
            fields like phones and addresses are kept from both.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold">
            <span
              className={`rounded-full px-2.5 py-1 ${
                confidenceBadge[suggestion.confidence] ?? confidenceBadge.low
              }`}
            >
              {suggestion.confidence} confidence
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[#5c655e]">
              Score {suggestion.score}
            </span>
          </div>
        </div>

        {suggestion.contributions.length > 0 || suggestion.reasons.length > 0 ? (
          <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#8b938c]">
                Why this was suggested
              </p>
              <span className="text-[12px] font-semibold text-[#5c655e]">
                Match score {suggestion.score}
              </span>
            </div>
            <ul className="mt-2.5 grid gap-1.5">
              {suggestion.contributions.map((contribution) => (
                <li
                  className="flex items-center justify-between gap-3 text-[13.5px] text-[#1d2823]"
                  key={`${contribution.signal}-${contribution.label}`}
                >
                  <span>{contribution.label}</span>
                  <span className="shrink-0 rounded-full bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#17352e]">
                    +{contribution.score}
                  </span>
                </li>
              ))}
            </ul>
            {warnings.length > 0 ? (
              <ul className="mt-2.5 grid gap-1.5 border-t border-[#edf0ea] pt-2.5">
                {warnings.map((warning) => (
                  <li className="text-[12.5px] leading-5 text-[#7a5a1a]" key={warning}>
                    ⚠ {warning}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <MergeReview
          contactA={contactA}
          contactB={contactB}
          mergeSource="suggestion-review"
          suggestionId={suggestion.id}
          unionsA={toUnions(keepLeftPreview)}
          unionsB={toUnions(keepRightPreview)}
        />

        <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-white p-5">
          <p className="text-[13px] font-semibold text-[#1d2823]">Not a duplicate?</p>
          <p className="mt-1 text-[13px] text-[#5c655e]">
            Dismiss this suggestion to remove it from the open queue. The review history is kept.
          </p>
          <div className="mt-3">
            <MergeSuggestionDismissButton suggestionId={suggestion.id} />
          </div>
        </div>
      </div>
    </main>
  );
}
