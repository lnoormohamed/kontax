import Link from "next/link";
import { redirect } from "next/navigation";

import { createContact } from "~/app/actions/contacts";
import { auth } from "~/server/auth";

const inputClassName =
  "rounded-[1.2rem] border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#667eea] focus:bg-white";

const textareaClassName = `${inputClassName} min-h-28`;

export default async function NewContactPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(201,214,170,0.45),_transparent_26%),linear-gradient(180deg,#eff3ea_0%,#f8fafc_38%,#f6f5f0_100%)] px-4 py-6 text-slate-900 lg:px-6 lg:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm">
          <Link className="text-sm font-semibold text-[#4158f4] hover:text-[#3248db]" href="/">
            ← Back to contacts
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Create contact
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
            Add a new person or organization
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Start with the fields you know today. Kontax will keep the record light enough for
            quick capture while preserving the richer structure needed for imports, merge quality,
            and future sync.
          </p>
        </section>

        <form action={createContact} className="grid gap-6">
          <input name="redirectTo" type="hidden" value="/contacts/:id?saved=1" />

          <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-lg font-semibold text-slate-900">Core details</p>
              <p className="mt-1 text-sm text-slate-500">
                Use the basics first, then add any structured extras you already have.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                <span>Full name</span>
                <input className={inputClassName} name="fullName" required type="text" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>Primary email</span>
                <input className={inputClassName} name="email" type="email" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>Primary phone</span>
                <input className={inputClassName} name="phone" type="text" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>Company</span>
                <input className={inputClassName} name="company" type="text" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>Job title</span>
                <input className={inputClassName} name="jobTitle" type="text" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>Nickname</span>
                <input className={inputClassName} name="nickname" type="text" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>Labels</span>
                <input
                  className={inputClassName}
                  name="labels"
                  placeholder="Family, VIP, School"
                  type="text"
                />
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-lg font-semibold text-slate-900">Structured contact methods</p>
              <p className="mt-1 text-sm text-slate-500">
                These fields make portability and future sync safer without forcing you to fill in
                everything on day one.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-700">
                <span>Website</span>
                <input className={inputClassName} name="website" type="url" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span>Birthday</span>
                <input className={inputClassName} name="birthday" type="date" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                <span>Address</span>
                <textarea className={textareaClassName} name="address" />
              </label>
              <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                <span>Additional emails</span>
                <textarea
                  className={textareaClassName}
                  name="additionalEmails"
                  placeholder={"One per line\nwork@example.com"}
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                <span>Additional phones</span>
                <textarea
                  className={textareaClassName}
                  name="additionalPhones"
                  placeholder={"One per line\n+44 20 7946 0958"}
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                <span>Significant dates</span>
                <textarea
                  className={textareaClassName}
                  name="significantDates"
                  placeholder={"Label | YYYY-MM-DD\nAnniversary | 2018-06-09"}
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                <span>Related people</span>
                <textarea
                  className={textareaClassName}
                  name="relatedPeople"
                  placeholder={"Relationship | Name\nSpouse | Alex Smith"}
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                <span>Custom fields</span>
                <textarea
                  className={textareaClassName}
                  name="customFields"
                  placeholder={"Label | Value\nAssistant | Jamie"}
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                <span>Notes</span>
                <textarea className="min-h-40 rounded-[1.2rem] border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#667eea] focus:bg-white" name="notes" />
              </label>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-full bg-[#4158f4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3248db]"
              type="submit"
            >
              Create contact
            </button>
            <Link
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#c9d0c9] hover:bg-slate-50"
              href="/"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
