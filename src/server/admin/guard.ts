import "server-only";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export class AdminForbiddenError extends Error {
  constructor() {
    super("FORBIDDEN");
    this.name = "AdminForbiddenError";
  }
}

export type AdminContext = {
  adminId: string;
  name: string;
  email: string;
};

/**
 * Authoritative admin gate (P21-01). Every /admin page and every admin server
 * action must call this — the middleware token check is only a fast first pass.
 * Throws AdminForbiddenError when the current session is missing or not ADMIN.
 *
 * Note: while an admin is impersonating a user (P21-07), auth() resolves to the
 * impersonated (USER) identity, so this correctly denies admin access until the
 * impersonation session is ended.
 */
export async function assertAdmin(): Promise<AdminContext> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new AdminForbiddenError();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, name: true, email: true },
  });
  if (user?.role !== "ADMIN") throw new AdminForbiddenError();

  return {
    adminId: userId,
    name: user.name?.trim() ?? user.email,
    email: user.email,
  };
}
