import Link from "next/link";
import { redirect } from "next/navigation";

import { createContact } from "~/app/actions/contacts";
import { auth } from "~/server/auth";

const inputClassName =
  "rounded-[1.2rem] border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#667eea] focus:bg-white";

const textareaClassName = `${inputClassName} min-h-28`;

const helperCardClassName =
  "rounded-[1.5rem] border border-[#dfe7e1] bg-[#f8faf8] p-4 text-sm text-slate-600";

export default async function NewContactPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(201,214,170,0.45),_transparent_26%),linear-gradient(180deg,#eff3ea_0%,#f8fafc_38%,#f6f5f0_100%)] px-4 py-6 text-slate-900 lg:px-6 lg:py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
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
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1.5 text-sm text-slate-600">
              Quick save path
            </span>
            <span className="rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1.5 text-sm text-slate-600">
              Structured emails and phones
            </span>
            <span className="rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1.5 text-sm text-slate-600">
              Richer sync-ready fields
            </span>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form action={createContact} className="grid gap-6">
            <input name="redirectTo" type="hidden" value="/contacts/:id?saved=1" />

            <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm">
              <div className="mb-5">
                <p className="text-lg font-semibold text-slate-900">Core details</p>
                <p className="mt-1 text-sm text-slate-500">
                  Use the basics first, then add the richer identity structure you already know.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                  <span>Full name</span>
                  <input className={inputClassName} name="fullName" required type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Prefix</span>
                  <input className={inputClassName} name="namePrefix" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Nickname</span>
                  <input className={inputClassName} name="nickname" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>First name</span>
                  <input className={inputClassName} name="firstName" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Middle name</span>
                  <input className={inputClassName} name="middleName" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Last name</span>
                  <input className={inputClassName} name="lastName" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Suffix</span>
                  <input className={inputClassName} name="nameSuffix" type="text" />
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
                  <span>Labels</span>
                  <input
                    className={inputClassName}
                    name="labels"
                    placeholder="Family, VIP, School"
                    type="text"
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Avatar URL</span>
                  <input className={inputClassName} name="avatarUrl" type="url" />
                </label>
                <label className="flex items-center gap-3 rounded-[1.2rem] border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-700 lg:col-span-2">
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-[#1f7a67] focus:ring-[#67b59f]"
                    name="isFavorite"
                    type="checkbox"
                    value="true"
                  />
                  <span>Start this contact as a favorite</span>
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
                  <span>Primary email</span>
                  <input className={inputClassName} name="email" type="email" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Email label</span>
                  <input className={inputClassName} name="emailLabel" placeholder="work" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Primary phone</span>
                  <input className={inputClassName} name="phone" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Phone label</span>
                  <input className={inputClassName} name="phoneLabel" placeholder="mobile" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Website</span>
                  <input className={inputClassName} name="website" type="url" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Website label</span>
                  <input className={inputClassName} name="websiteLabel" placeholder="personal" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Birthday</span>
                  <input className={inputClassName} name="birthday" type="date" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Address label</span>
                  <input className={inputClassName} name="addressLabel" placeholder="home" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                  <span>Address</span>
                  <textarea className={textareaClassName} name="address" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Country or region</span>
                  <input className={inputClassName} name="countryOrRegion" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Street line 1</span>
                  <input className={inputClassName} name="streetLine1" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Street line 2</span>
                  <input className={inputClassName} name="streetLine2" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>City or town</span>
                  <input className={inputClassName} name="cityOrTown" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>Postcode</span>
                  <input className={inputClassName} name="postcode" type="text" />
                </label>
                <label className="grid gap-2 text-sm text-slate-700">
                  <span>PO box</span>
                  <input className={inputClassName} name="poBox" type="text" />
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
                  <span>Additional websites</span>
                  <textarea
                    className={textareaClassName}
                    name="additionalWebsites"
                    placeholder={"One per line\nhttps://example.com"}
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-700 lg:col-span-2">
                  <span>Additional addresses</span>
                  <textarea
                    className={textareaClassName}
                    name="additionalAddresses"
                    placeholder={"One per line\n12 High Street, London, SW1A 1AA"}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm">
              <div className="mb-5">
                <p className="text-lg font-semibold text-slate-900">Personal context and notes</p>
                <p className="mt-1 text-sm text-slate-500">
                  Add the richer details that make imports, merge suggestions, and future sync more trustworthy.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
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
                  <textarea
                    className="min-h-40 rounded-[1.2rem] border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#667eea] focus:bg-white"
                    name="notes"
                  />
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

          <aside className="grid content-start gap-4">
            <div className={helperCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1f7a67]">
                Rich-field readiness
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This create flow now surfaces the same richer field families Kontax already uses for
                portability, duplicate review, and future CardDAV planning.
              </p>
            </div>

            <div className={helperCardClassName}>
              <p className="text-sm font-semibold text-slate-900">What gets stronger when you add more</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>Email and phone labels improve import/export mapping confidence.</p>
                <p>Name parts and relationship fields improve merge suggestions.</p>
                <p>Structured addresses and dates reduce sync lossiness later.</p>
              </div>
            </div>

            <div className={helperCardClassName}>
              <p className="text-sm font-semibold text-slate-900">Recommended first-save minimum</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>1. Full name</p>
                <p>2. One email or phone</p>
                <p>3. Company or notes if this contact needs context</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
