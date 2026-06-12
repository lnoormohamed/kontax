import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const baseAuth = cache(uncachedAuth);

/**
 * Request-scoped session resolver. P21-07: if the real (ADMIN) user has a valid
 * impersonation cookie, resolve the session to the impersonated USER so every
 * read renders as that user. `impersonatedBy` is set so write actions can refuse
 * (assertWritable) and the app can show the banner. Normal users pay only a
 * cheap early return.
 */
const auth = cache(async () => {
  const session = await baseAuth();
  if (session?.user?.role !== "ADMIN") return session;

  // Lazily imported so the common (non-admin) path stays free of cookie/db work.
  const { readImpersonation } = await import("~/server/admin/impersonation");
  const imp = await readImpersonation();
  if (imp?.adminId !== session.user.id) return session;

  const { db } = await import("~/server/db");
  const target = await db.user.findUnique({
    where: { id: imp.targetId },
    select: { id: true, email: true, name: true, avatarUrl: true, emailVerified: true },
  });
  if (!target) return session;

  return {
    ...session,
    user: {
      ...session.user,
      id: target.id,
      email: target.email,
      name: target.name,
      avatarUrl: target.avatarUrl,
      emailVerified: target.emailVerified,
      role: "USER" as const,
    },
    impersonatedBy: imp.adminId,
  };
});

export { auth, handlers, signIn, signOut };
