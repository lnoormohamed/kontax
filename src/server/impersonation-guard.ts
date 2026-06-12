import "server-only";

import { auth } from "~/server/auth";

// P21-07: impersonation is strictly read-only. Any mutation attempted while an
// admin is impersonating a user must be refused. Thrown as a plain Error so the
// existing action error handling surfaces it.
export class WriteBlockedError extends Error {
  constructor() {
    super("WRITE_BLOCKED");
    this.name = "WriteBlockedError";
  }
}

/** Throws WriteBlockedError when the current session is an impersonation. */
export async function assertWritable(): Promise<void> {
  const session = await auth();
  if (session?.impersonatedBy) throw new WriteBlockedError();
}
