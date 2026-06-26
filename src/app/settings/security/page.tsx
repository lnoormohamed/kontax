import { redirectToLogin } from "~/server/auth/require-page-auth";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { SecurityPageClient } from "./security-page-client";

export default async function SettingsSecurityPage() {
  const session = await auth();
  if (!session?.user?.id) return redirectToLogin("/settings/security");

  const [user, activeSessionCount, activeAppPasswordCount, syncProviderCounts] =
    await Promise.all([
      db.user.findUnique({
        where: { id: session.user.id },
        select: {
          email: true,
          emailVerified: true,
          password: true,
          totpEnabled: true,
          totpVerifiedAt: true,
        },
      }),
      db.userSession.count({
        where: { userId: session.user.id, revokedAt: null },
      }),
      db.appPassword.count({
        where: { userId: session.user.id, revokedAt: null },
      }),
      db.syncAccount.groupBy({
        by: ["provider"],
        where: {
          userId: session.user.id,
          status: { in: ["ACTIVE", "PAUSED", "NEEDS_REAUTH", "ERROR"] },
          provider: { in: ["GOOGLE", "MICROSOFT"] },
        },
        _count: { _all: true },
      }),
    ]);

  return (
    <SecurityPageClient
      connectedAccounts={{
        primaryEmail: user?.email ?? session.user.email ?? "",
        emailVerifiedAt: user?.emailVerified?.toISOString() ?? null,
        hasPassword: Boolean(user?.password),
        totpEnabled: Boolean(user?.totpEnabled),
        totpVerifiedAt: user?.totpVerifiedAt?.toISOString() ?? null,
        activeSessionCount,
        activeAppPasswordCount,
        syncProviderConnections: syncProviderCounts.flatMap((entry) =>
          entry.provider === "GOOGLE" || entry.provider === "MICROSOFT"
            ? [
                {
                  provider: entry.provider,
                  count: entry._count._all,
                },
              ]
            : [],
        ),
      }}
    />
  );
}
