import { ContactManager } from "~/app/_components/contact-manager";
import { AuthBar } from "~/app/_components/auth-bar";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#042f66] to-[#0b1020] px-4 py-12 text-white">
      <div className="container mx-auto flex max-w-4xl flex-col gap-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.35em] text-sky-200">Kontax</p>
          <h1 className="text-5xl font-extrabold tracking-tight">
            Contact storage for your team
          </h1>
          <p className="text-lg text-slate-200">
            Save, search, and manage the people you work with in one place.
          </p>
        </header>
        <AuthBar />
        <ContactManager />
      </div>
    </main>
  );
}
