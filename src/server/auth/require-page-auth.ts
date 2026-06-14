import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// Use at the top of any server page that requires authentication.
// Reads x-pathname (set by middleware's Safari edge-JWT pass-through) so the
// ?next= param reflects the real URL, not a hardcoded fallback.
//
// When a session cookie is present but auth() returns null, the token has
// expired (or been invalidated). In that case we add expired=1 to the login
// URL so the login page can show "Your session ended" instead of the generic
// "sign in" prompt.
//
// Returns never — TypeScript sees this as unreachable after the call.
export async function redirectToLogin(fallbackPath: string): Promise<never> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const next = h.get("x-pathname") ?? fallbackPath;
  const hasSessionCookie = c
    .getAll()
    .some(({ name }) => name.includes("authjs.session-token"));
  const loginUrl = hasSessionCookie
    ? `/login?next=${encodeURIComponent(next)}&expired=1`
    : `/login?next=${encodeURIComponent(next)}`;
  return redirect(loginUrl);
}
