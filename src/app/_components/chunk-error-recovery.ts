"use client";

const CHUNK_RECOVERY_KEY = "kontax:chunk-recovery";
const CHUNK_RECOVERY_TTL_MS = 5 * 60 * 1000;

export function isRecoverableChunkError(error: Pick<Error, "message"> | null | undefined) {
  const message = error?.message ?? "";
  return (
    message.includes("module factory") ||
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch dynamically imported module")
  );
}

function markRecoveryAttempt(scope: string) {
  if (typeof window === "undefined") return false;

  try {
    const raw = window.sessionStorage.getItem(CHUNK_RECOVERY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { at?: number; scope?: string };
      if (
        parsed.scope === scope &&
        typeof parsed.at === "number" &&
        Date.now() - parsed.at < CHUNK_RECOVERY_TTL_MS
      ) {
        return false;
      }
    }

    window.sessionStorage.setItem(
      CHUNK_RECOVERY_KEY,
      JSON.stringify({ at: Date.now(), scope })
    );
    return true;
  } catch {
    return true;
  }
}

async function clearKontaxCaches() {
  if (typeof window === "undefined" || typeof window.caches === "undefined") return;

  try {
    const keys = await window.caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("kontax-"))
        .map((key) => window.caches.delete(key))
    );
  } catch {
    // Best effort only; a full navigation still fixes most chunk mismatches.
  }
}

async function unregisterServiceWorkers() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // Best effort only.
  }
}

export async function attemptChunkErrorRecovery() {
  if (typeof window === "undefined") return false;

  const scope = `${window.location.pathname}${window.location.search}`;
  if (!markRecoveryAttempt(scope)) return false;

  await Promise.allSettled([clearKontaxCaches(), unregisterServiceWorkers()]);

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("__kontax_reload", String(Date.now()));
  window.location.replace(nextUrl.toString());
  return true;
}
