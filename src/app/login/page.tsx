import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "~/app/_components/auth-card";
import { safeInternalPath } from "~/lib/safe-internal-path";
import { authIncludingPendingTotp } from "~/server/auth";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Kontax account.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // P48-01: the login page is the one place that needs to see a pending-TOTP
  // session, so it can send the user to the challenge instead of the form.
  const session = await authIncludingPendingTotp();
  const params = searchParams ? await searchParams : undefined;
  const rawNext = params?.next;
  const nextParam = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  // P48-03: `?next=` is attacker-supplied — only a real internal path survives.
  // `undefined` (not the fallback) so the "continue to…" hint below still only
  // shows when a destination was actually requested.
  const next = nextParam ? safeInternalPath(nextParam, "/contacts") : undefined;
  const rawMessage = params?.message;
  const message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;
  const expired = params?.expired === "1";

  if (session?.user?.id) {
    if (session.pendingTotp) {
      redirect(next ? `/login/verify-2fa?next=${encodeURIComponent(next)}` : "/login/verify-2fa");
    }
    // P48-02: a signed-in user whose account is in its deletion grace period
    // gets the cancel screen, not the app.
    if (session.pendingDeletion) {
      redirect("/account-pending-deletion");
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
      <AuthCard expired={expired} message={message} mode="login" next={next} />
      <p className="text-[12px] text-[#8b938c]">© Kontax · Your contacts, organized and yours.</p>
    </main>
  );
}
