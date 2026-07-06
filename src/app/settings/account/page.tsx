import { SessionProvider } from "next-auth/react";

import { redirectToLogin } from "~/server/auth/require-page-auth";

import Link from "next/link";

import { SettingsPageHead, StSecLabel } from "~/app/_components/settings-ui";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { EmailSection } from "./email-section";
import { ProfileSection } from "./profile-section";

export default async function SettingsAccountPage() {
  const session = await auth();
  if (!session?.user?.id) return redirectToLogin("/settings/account");

  // Fetch pending email change state — not stored in JWT to avoid stale data
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      emailPendingChange: true,
      emailPendingChangeRequestedAt: true,
      emailStatus: true,
    },
  });

  return (
    // ProfileSection / PasswordChangeForm call useSession(); they need a provider
    // in the tree (none exists app-wide). Seed it with the server session.
    <SessionProvider session={session}>
      <SettingsPageHead
        title="Profile & account"
        sub="Your identity and sign-in email. Password and sessions live in Security; your public handle lives on the Public card page."
      />

      {user?.emailStatus === "BOUNCED" && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900"
        >
          <span aria-hidden className="mt-px text-amber-600">
            ⚠
          </span>
          <span>
            Your email address bounced, so some Kontax notifications may not be
            reaching you. Update your email address below to start receiving
            them again.
          </span>
        </div>
      )}

      <StSecLabel>Profile</StSecLabel>
      <ProfileSection
        initialAvatarUrl={session.user.avatarUrl}
        initialName={session.user.name ?? ""}
      />

      <StSecLabel>Sign-in email</StSecLabel>
      <EmailSection
        email={session.user.email ?? ""}
        emailVerified={session.user.emailVerified ?? null}
        pendingEmail={user?.emailPendingChange ?? null}
        pendingRequestedAt={user?.emailPendingChangeRequestedAt ?? null}
      />

      {/* P46-14 / DB07: relocated features keep link rows here so nothing
          feels lost — username → Public card, password/sessions → Security,
          data export → Data & sync. */}
      <StSecLabel>Related</StSecLabel>
      <div className="overflow-hidden rounded-2xl border border-[#d8ddd6] bg-white">
        {[
          { label: "Public card", sub: "Your public handle & visible fields", href: "/settings/account/card", icon: "qr" },
          { label: "Password & security", sub: "Password, 2FA, sessions", href: "/settings/security", icon: "emergency" },
          { label: "Download your data", sub: "Full account export", href: "/settings/data/export", icon: "download" },
        ].map((row, i, arr) => (
          <Link
            key={row.label}
            href={row.href}
            className="flex items-center gap-3 px-4 py-3.5 no-underline"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid #f2f4f0" : "none" }}
          >
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[#f2f4f0]">
              <WorkspaceIcon name={row.icon} size={17} className="text-[#5c655e]" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-[#1d2823]">{row.label}</span>
              <span className="block truncate text-[12.5px] text-[#8b938c]">{row.sub}</span>
            </span>
            <WorkspaceIcon name="chevronRight" size={17} className="shrink-0 text-[#d8ddd6]" strokeWidth={1.7} />
          </Link>
        ))}
      </div>
    </SessionProvider>
  );
}
