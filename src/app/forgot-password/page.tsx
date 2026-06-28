import { redirect } from "next/navigation";

import { ForgotPasswordCard } from "~/app/_components/forgot-password-card";
import { auth } from "~/server/auth";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/contacts");
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10">
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
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
          }}
        />
      </div>
      <ForgotPasswordCard />
      <p className="text-[12px] text-[#8b938c]">© Kontax · Your contacts, organized and yours.</p>
    </main>
  );
}
