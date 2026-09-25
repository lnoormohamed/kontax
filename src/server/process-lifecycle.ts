// P49A-04: process-wide shutdown state shared between the custom server
// (server.mjs, plain ESM) and the Next.js bundle (route handlers, server
// actions). Both run in the same Node process but load separate module
// instances, so the state lives on globalThis under a registered symbol —
// server.mjs reads the same key via Symbol.for(PROCESS_LIFECYCLE_KEY).
//
// server.mjs flips `shuttingDown` on SIGTERM/SIGINT; job drains check
// isShuttingDown() before claiming new work, and long-running background work
// registers itself so shutdown can wait (bounded) for it to finish.

export const PROCESS_LIFECYCLE_KEY = "kontax.processLifecycle";

export type ProcessLifecycleState = {
  shuttingDown: boolean;
  /** In-flight background work, keyed by a unique token → human label. */
  inFlight: Map<symbol, string>;
};

const lifecycleSymbol = Symbol.for(PROCESS_LIFECYCLE_KEY);

export const getProcessLifecycle = (): ProcessLifecycleState => {
  const holder = globalThis as unknown as Record<symbol, ProcessLifecycleState | undefined>;
  let state = holder[lifecycleSymbol];
  if (!state) {
    state = { shuttingDown: false, inFlight: new Map() };
    holder[lifecycleSymbol] = state;
  }
  return state;
};

export const isShuttingDown = (): boolean => getProcessLifecycle().shuttingDown;

/**
 * Register a unit of in-flight work (a claimed sync job, an archive export).
 * Returns an idempotent release function; call it from a finally block.
 */
export const beginInFlightWork = (label: string): (() => void) => {
  const state = getProcessLifecycle();
  const token = Symbol(label);
  state.inFlight.set(token, label);
  return () => {
    state.inFlight.delete(token);
  };
};
