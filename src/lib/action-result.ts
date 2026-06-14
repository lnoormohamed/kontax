// Discriminated result type for server actions that can fail due to auth or
// application errors — use instead of throwing or redirecting so client
// components can branch on the failure reason without losing their state.
//
// Usage in a server action:
//   export async function myAction(): Promise<ActionResult<{ id: string }>> {
//     const session = await auth();
//     if (!session?.user?.id) return { ok: false, reason: "SESSION_EXPIRED" };
//     ...
//     return { ok: true, data: { id: "..." } };
//   }
//
// Usage in a client component:
//   const result = await myAction();
//   if (!result.ok) {
//     if (result.reason === "SESSION_EXPIRED") { /* show inline recovery */ }
//     else { /* show error message */ }
//   }

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "SESSION_EXPIRED" | "STEP_UP_REQUIRED" | "ERROR"; message?: string };

// Convenience — when a server action has nothing to return on success.
export type VoidActionResult = ActionResult<void>;
