import { headers } from "next/headers";
import { redirect } from "next/navigation";

// Use at the top of any server page that requires authentication.
// Reads x-pathname (set by middleware's Safari edge-JWT pass-through) so the
// ?next= param reflects the real URL, not a hardcoded fallback.
// Returns never — TypeScript sees this as unreachable after the call.
export async function redirectToLogin(fallbackPath: string): Promise<never> {
  const h = await headers();
  const next = h.get("x-pathname") ?? fallbackPath;
  return redirect(`/login?next=${encodeURIComponent(next)}`);
}
