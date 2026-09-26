import { redirect } from "next/navigation";

import { ForgotPasswordCard } from "~/app/_components/forgot-password-card";
import { AuthShell } from "~/app/_components/auth-ui";
import { auth } from "~/server/auth";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/contacts");
  }

  return (
    <AuthShell>
      <ForgotPasswordCard />
    </AuthShell>
  );
}
