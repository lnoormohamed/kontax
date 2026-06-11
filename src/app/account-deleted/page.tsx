import Link from "next/link";

export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10" style={{ backgroundColor: "#eef1ec" }}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#17352e] text-[19px] font-bold text-[#dff0e7]">K</span>
        <span className="text-[20px] font-semibold tracking-[-0.018em] text-[#17352e]">Kontax</span>
      </div>

      <div className="w-full max-w-[440px] rounded-[2rem] border border-[#d8ddd6] bg-white p-8 text-center shadow-[0_2px_12px_rgba(20,30,25,0.08)]">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#e7efe9]">
          <svg fill="none" height="22" stroke="#17352e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">Account deletion scheduled</h1>
        <p className="mt-3 text-[14px] leading-[1.55] text-[#5c655e]">
          Your account has been locked and will be permanently deleted in 30 days. You can sign back in during that period if you change your mind.
        </p>
        <Link
          className="mt-5 inline-flex h-10 items-center rounded-full border border-[#d8ddd6] px-5 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
          href="/"
        >
          Return to homepage
        </Link>
      </div>
    </main>
  );
}
