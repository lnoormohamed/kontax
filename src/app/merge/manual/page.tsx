import Link from "next/link";
import { redirect } from "next/navigation";

import { MergePreviewForm } from "~/app/_components/merge-preview-form";
import { auth } from "~/server/auth";
import { buildMergedContactPreview } from "~/server/contact-merge";
import { db } from "~/server/db";

type ManualMergePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function ManualMergePage({ searchParams }: ManualMergePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const leftContactId = getSingleValue(params?.left)?.trim() ?? "";
  const rightContactId = getSingleValue(params?.right)?.trim() ?? "";

  const contacts = await db.contact.findMany({
    where: {
      userId: session.user.id,
      archivedAt: null,
    },
    orderBy: {
      fullName: "asc",
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      company: true,
      notes: true,
      archivedAt: true,
      importJobId: true,
      updatedAt: true,
    },
  });

  const leftContact = contacts.find((contact) => contact.id === leftContactId) ?? null;
  const rightContact = contacts.find((contact) => contact.id === rightContactId) ?? null;
  const validPair =
    leftContact != null && rightContact != null && leftContact.id !== rightContact.id;

  const keepLeftPreview =
    validPair && leftContact && rightContact
      ? buildMergedContactPreview(leftContact, rightContact)
      : null;
  const keepRightPreview =
    validPair && leftContact && rightContact
      ? buildMergedContactPreview(rightContact, leftContact)
      : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#07111d_45%,#0f172a_100%)] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-12">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(2,8,23,0.45)] backdrop-blur">
          <Link className="text-sm font-semibold text-cyan-200 hover:text-cyan-100" href="/">
            ← Back to dashboard
          </Link>
          <p className="mt-4 text-sm uppercase tracking-[0.35em] text-cyan-200">Manual merge</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            Review any pair of contacts
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300">
            Ticket `P4-03`: manual merge lets you choose two active records, inspect a deterministic
            preview, and explicitly decide which contact survives.
          </p>
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6">
          <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" method="get">
            <label className="grid gap-2 text-sm text-slate-200">
              <span>Contact A</span>
              <select
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                defaultValue={leftContactId}
                name="left"
              >
                <option className="bg-slate-950 text-white" value="">
                  Choose a contact
                </option>
                {contacts.map((contact) => (
                  <option className="bg-slate-950 text-white" key={contact.id} value={contact.id}>
                    {contact.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              <span>Contact B</span>
              <select
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                defaultValue={rightContactId}
                name="right"
              >
                <option className="bg-slate-950 text-white" value="">
                  Choose a second contact
                </option>
                {contacts.map((contact) => (
                  <option className="bg-slate-950 text-white" key={contact.id} value={contact.id}>
                    {contact.fullName}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                className="w-full rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                type="submit"
              >
                Load merge preview
              </button>
            </div>
          </form>

          {leftContactId && rightContactId && !validPair ? (
            <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
              Choose two different active contacts to review a merge.
            </div>
          ) : null}
        </section>

        {validPair && keepLeftPreview && keepRightPreview ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <MergePreviewForm
              description="Pick the surviving record, then fine-tune each field before confirming the manual merge."
              mergeSource="manual-pair"
              preview={keepLeftPreview}
              primaryContactId={leftContact.id}
              primaryLabel="Contact A"
              redirectTo={`/contacts/${leftContact.id}?saved=1`}
              secondaryContactId={rightContact.id}
              secondaryLabel="Contact B"
              title="Keep contact A"
            />

            <MergePreviewForm
              description="Use this path when contact B should stay canonical, with per-field overrides available before merge."
              mergeSource="manual-pair"
              preview={keepRightPreview}
              primaryContactId={rightContact.id}
              primaryLabel="Contact B"
              redirectTo={`/contacts/${rightContact.id}?saved=1`}
              secondaryContactId={leftContact.id}
              secondaryLabel="Contact A"
              title="Keep contact B"
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
