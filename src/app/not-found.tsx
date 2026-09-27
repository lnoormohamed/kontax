import Link from "next/link";

// P49A-17 — branded 404. This is the Next.js root `not-found.tsx`: it renders
// for any route that calls `notFound()` or simply doesn't match a page, for
// signed-in and signed-out visitors alike. It must not call `auth()` or read
// the session — a page under a public prefix (e.g. /guides/typo, /u/unknown,
// /compare/typo) can 404 while completely logged out, and this page has to
// render correctly for that visitor too. (A path with no matching prefix at
// all still gets redirected to /login by middleware before ever reaching
// here — that's the existing, intentional "unknown path requires a session"
// default in src/server/public-paths.ts, and out of scope to change here.)
export default function NotFound() {
  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10"
      style={{ backgroundColor: "#eef1ec" }}
    >
      <Link className="flex items-center gap-2.5" href="/">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#17352e] text-[19px] font-bold text-[#dff0e7]">
          K
        </span>
        <span className="text-[20px] font-semibold tracking-[-0.018em] text-[#17352e]">Kontax</span>
      </Link>

      <div className="w-full max-w-[440px] rounded-[2rem] border border-[#d8ddd6] bg-white p-8 text-center shadow-[0_2px_12px_rgba(20,30,25,0.08)]">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#f2f4f0]">
          <svg fill="none" height="22" stroke="#5c655e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="22">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" x2="16.65" y1="21" y2="16.65" />
          </svg>
        </div>
        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">Page not found</h1>
        <p className="mt-3 text-[14px] leading-[1.55] text-[#5c655e]">
          The page you&rsquo;re looking for doesn&rsquo;t exist, or may have moved.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            className="inline-flex h-10 items-center rounded-full bg-[#17352e] px-5 text-[14px] font-semibold text-white transition hover:bg-[#0f2620]"
            href="/"
          >
            Go to homepage
          </Link>
          <Link
            className="inline-flex h-10 items-center rounded-full border border-[#d8ddd6] px-5 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
            href="/contacts"
          >
            View your contacts
          </Link>
        </div>
      </div>
    </main>
  );
}
