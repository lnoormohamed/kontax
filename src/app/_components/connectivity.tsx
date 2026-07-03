"use client";

// P42-DB01: shared client connectivity store. One source of truth for
// `{ online, degraded, swUpdate }` consumed by the ConnectionBanner slot and by
// write affordances (save buttons, bulk toolbar, Sync now, mobile FAB).
//
// - offline  = !navigator.onLine (the browser's own signal)
// - degraded = online, but same-origin requests keep failing (timeouts / 5xx)
// - swUpdate = the service worker announced a new build (SW_UPDATED)

import { useSyncExternalStore } from "react";

export type ConnectivityState = {
  online: boolean;
  degraded: boolean;
  swUpdate: boolean;
};

/** Consecutive same-origin request failures before we call it degraded. */
const DEGRADED_THRESHOLD = 3;

let state: ConnectivityState = { online: true, degraded: false, swUpdate: false };
const listeners = new Set<() => void>();
let failureCount = 0;
let initialized = false;

function emit(next: Partial<ConnectivityState>) {
  const merged = { ...state, ...next };
  if (
    merged.online === state.online &&
    merged.degraded === state.degraded &&
    merged.swUpdate === state.swUpdate
  ) {
    return;
  }
  state = merged;
  for (const listener of listeners) listener();
}

export function reportRequestFailure() {
  failureCount += 1;
  if (failureCount >= DEGRADED_THRESHOLD) emit({ degraded: true });
}

export function reportRequestSuccess() {
  failureCount = 0;
  if (state.degraded) emit({ degraded: false });
}

export function setSwUpdateAvailable() {
  emit({ swUpdate: true });
}

/**
 * P42-01 §2: the service worker aborted an in-session navigation because the
 * network was unreachable (NAV_OFFLINE). A failed document navigation is a
 * strong signal — surface degraded immediately rather than waiting for the
 * failure counter.
 */
export function reportNavigationFailure() {
  failureCount = DEGRADED_THRESHOLD;
  if (state.online) emit({ degraded: true });
}

export function dismissSwUpdate() {
  emit({ swUpdate: false });
}

/**
 * Force an immediate connectivity probe (the degraded banner's [Try again]).
 * A successful same-origin response resets the failure counter and clears the
 * degraded state via the fetch instrumentation below.
 */
export async function retryNow() {
  try {
    await fetch("/favicon.ico", { cache: "no-store" });
  } catch {
    // The instrumented fetch already counted the failure.
  }
}

// Count same-origin request outcomes so "degraded" reflects real traffic
// without touching every call site. Behaviour is never altered — we only
// observe. Cross-origin requests and aborted requests are ignored.
function instrumentFetch() {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let sameOrigin = false;
    try {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.href;
      sameOrigin = new URL(raw, window.location.href).origin === window.location.origin;
    } catch {
      // Unparseable input — leave it uncounted.
    }
    try {
      const res = await original(input, init);
      if (sameOrigin) {
        if (res.status >= 500) reportRequestFailure();
        else reportRequestSuccess();
      }
      return res;
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (sameOrigin && !aborted) reportRequestFailure();
      throw err;
    }
  };
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("online", () => {
    failureCount = 0;
    emit({ online: true, degraded: false });
  });
  window.addEventListener("offline", () => emit({ online: false }));
  instrumentFetch();
  emit({ online: navigator.onLine });
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  init();
  return () => {
    listeners.delete(callback);
  };
}

const getSnapshot = () => state;
const SERVER_SNAPSHOT: ConnectivityState = { online: true, degraded: false, swUpdate: false };
const getServerSnapshot = () => SERVER_SNAPSHOT;

export function useConnectivity(): ConnectivityState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True while the browser reports no connection. */
export function useOffline(): boolean {
  return !useConnectivity().online;
}
