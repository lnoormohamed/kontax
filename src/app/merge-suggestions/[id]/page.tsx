import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MergeSuggestionDismissButton } from "~/app/_components/merge-suggestion-dismiss-button";
import { MergePreviewForm } from "~/app/_components/merge-preview-form";
import { auth } from "~/server/auth";
import {
  buildMergedContactPreview,
  getMergeSuggestionByIdForUser,
} from "~/server/contact-merge";

type MergeSuggestionReviewPageProps = {
  params: Promise<{
    id: string;
  }>;
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#07111d_45%,#0f172a_100%)] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-12">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(2,8,23,0.45)] backdrop-blur">
          <Link className="text-sm font-semibold text-cyan-200 hover:text-cyan-100" href="/">
            ← Back to dashboard
          </Link>
          <p className="mt-4 text-sm uppercase tracking-[0.35em] text-cyan-200">Suggested merge</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            Review this duplicate suggestion
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300">
            Ticket `P4-03`: suggestion review keeps the user in control by showing both records,
            the heuristic reasons, and two explicit “keep this record” merge paths.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-white/10 px-3 py-1">
              Confidence: {suggestion.confidence}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1">
              Score: {suggestion.score}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1">
              Source: {suggestion.source}
            </span>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Contact A</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{suggestion.leftContact.fullName}</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <p>Email: {suggestion.leftContact.email ?? "Not provided"}</p>
              <p>Phone: {suggestion.leftContact.phone ?? "Not provided"}</p>
              <p>Company: {suggestion.leftContact.company ?? "Not provided"}</p>
              <p className="whitespace-pre-wrap">Notes: {suggestion.leftContact.notes ?? "No notes"}</p>
            </div>
            <Link
              className="mt-5 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
              href={`/contacts/${suggestion.leftContact.id}`}
            >
              Open contact A
            </Link>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Contact B</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{suggestion.rightContact.fullName}</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <p>Email: {suggestion.rightContact.email ?? "Not provided"}</p>
              <p>Phone: {suggestion.rightContact.phone ?? "Not provided"}</p>
              <p>Company: {suggestion.rightContact.company ?? "Not provided"}</p>
              <p className="whitespace-pre-wrap">Notes: {suggestion.rightContact.notes ?? "No notes"}</p>
            </div>
            <Link
              className="mt-5 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
              href={`/contacts/${suggestion.rightContact.id}`}
            >
              Open contact B
            </Link>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Why Kontax suggested this</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              {suggestion.reasons.map((reason) => (
                <p className="rounded-2xl border border-white/10 bg-[#08101c]/70 p-4" key={reason}>
                  {reason}
                </p>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">P4-01 and P4-02</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <p>
                Duplicate heuristics stay user-scoped and review-first. Exact email and phone
                matches can score highly, but Kontax still leaves the final decision to you.
              </p>
              <p>
                Suggestion lifecycle is now persistent: open, dismissed, merged, and stale states
                remain traceable instead of being recreated as one-off scans.
              </p>
            </div>
          </aside>

          <aside className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Not a match?</p>
            <p className="mt-4 text-sm text-slate-300">
              Dismiss this suggestion to remove it from the open queue while preserving the review
              history we started in `P4-02`.
            </p>
            <div className="mt-4">
              <MergeSuggestionDismissButton suggestionId={suggestion.id} />
            </div>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <MergePreviewForm
            description="Field-by-field choices default conservatively. You can override any conflicting value before merging into contact A."
            mergeSource="suggestion-review"
            preview={keepLeftPreview}
            primaryContactId={suggestion.leftContact.id}
            primaryLabel="Contact A"
            redirectTo={`/contacts/${suggestion.leftContact.id}?saved=1`}
            secondaryContactId={suggestion.rightContact.id}
            secondaryLabel="Contact B"
            suggestionId={suggestion.id}
            title="Keep contact A"
          />

          <MergePreviewForm
            description="Use this path when contact B should remain canonical, but still review every field before confirming."
            mergeSource="suggestion-review"
            preview={keepRightPreview}
            primaryContactId={suggestion.rightContact.id}
            primaryLabel="Contact B"
            redirectTo={`/contacts/${suggestion.rightContact.id}?saved=1`}
            secondaryContactId={suggestion.leftContact.id}
            secondaryLabel="Contact A"
            suggestionId={suggestion.id}
            title="Keep contact B"
          />
        </section>
      </div>
    </main>
  );
}
