import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "~/app/_components/auth-card";
import { auth } from "~/server/auth";
import { CardRegisterContext } from "./card-register-context";

export const metadata: Metadata = {
  title: "Get started",
  description: "Create a free Kontax account. No credit card required.",
  alternates: { canonical: "/register" },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const rawNext = params?.next;
  const nextParam = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  const next = nextParam?.startsWith("/") ? nextParam : undefined;
  const rawPlan = params?.plan;
  const plan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;

  const rawPrefill = params?.prefill;
  const prefillParam = Array.isArray(rawPrefill) ? rawPrefill[0] : rawPrefill;

  if (session?.user) {
    // Logged-in users visiting /register?prefill go straight to create contact with the data
    if (prefillParam) {
      redirect(`/contacts/new?prefill=${encodeURIComponent(prefillParam)}`);
    }
    redirect(next ?? "/contacts");
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10">
      {/* Background */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundColor: "#eef1ec",
          backgroundImage: [
            "radial-gradient(ellipse 70% 55% at 50% 36%, rgba(23,53,46,0.10) 0%, rgba(23,53,46,0) 70%)",
            "radial-gradient(ellipse 90% 70% at 50% 110%, rgba(23,53,46,0.07) 0%, rgba(23,53,46,0) 60%)",
          ].join(", "),
        }}
      >
        {/* faint grain */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
          }}
        />
      </div>
      {prefillParam && <CardRegisterContext prefillParam={prefillParam} />}
      <AuthCard mode="register" next={next} plan={plan} />
      <p className="text-[12px] text-[#8b938c]">© Kontax · Your contacts, organized and yours.</p>
    </main>
  );
}
