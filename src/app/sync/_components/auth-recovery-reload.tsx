"use client";

import { useEffect } from "react";

/**
 * Recovery for a Next.js 15 + Auth.js v5 quirk: when this page is re-rendered as
 * part of a Server Action's redirect/revalidation, `auth()` can return null even
 * though a valid session cookie is present (the session can't be resolved in that
 * render phase). A fresh top-level navigation renders normally and auth()
 * succeeds, so we hard-reload to the intended URL instead of bouncing to /login.
 *
 * The `to` URL carries a one-shot guard param so that, if the reloaded request
 * somehow still cannot resolve the session, the page falls through to the normal
 * /login redirect rather than reloading forever.
 */
export function AuthRecoveryReload({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return null;
}
