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
    select: { emailPendingChange: true, emailPendingChangeRequestedAt: true },
  });

  return (
    <>
      <SettingsPageHead
        title="Profile & account"
        sub="Your identity, sign-in email, and password. These stay off the main contacts page."
      />

      <StSecLabel>Profile</StSecLabel>
      <ProfileSection initialName={session.user.name ?? ""} />

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
