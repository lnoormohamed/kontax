import { redirect } from "next/navigation";

import { SettingsPageHead, StSecLabel } from "~/app/_components/settings-ui";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { EmailSection } from "./email-section";
import { PasswordChangeForm } from "./password-change-form";
import { ProfileSection } from "./profile-section";

export default async function SettingsAccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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
    <>
      <SettingsPageHead
        title="Profile & account"
        sub="Your identity, sign-in email, and password. These stay off the main contacts page."
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

      <StSecLabel>Account</StSecLabel>
      <EmailSection
        email={session.user.email ?? ""}
        emailVerified={session.user.emailVerified ?? null}
        pendingEmail={user?.emailPendingChange ?? null}
        pendingRequestedAt={user?.emailPendingChangeRequestedAt ?? null}
      />
      <PasswordChangeForm />
    </>
  );
}
