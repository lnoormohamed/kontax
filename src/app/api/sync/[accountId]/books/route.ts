import { NextResponse } from "next/server";

import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { SYNC_ACCOUNT_ACTIVE_STATUSES } from "~/lib/sync-account-status";
import { CardDavPreflightError, discoverCardDavAddressBooks } from "~/server/carddav";
import { db } from "~/server/db";
import { rejectCrossSite } from "~/server/same-origin";
import { decryptSyncCredentialPayload } from "~/server/sync-credentials";

const BOOKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type RouteContext = { params: Promise<{ accountId: string }> };

// P23-03: list the remote address books for a connection's allowlist picker.
// GET returns cached discovery within the TTL; POST forces a re-run.
//
// P49A-13: the forced refresh used to be `GET ?refresh=1` — a cookie-authed
// GET that makes outbound requests with the stored credentials and rewrites
// the cache, triggerable cross-site by any link or <img>. It is a POST now,
// and both methods refuse requests the browser marks as cross-site.
export async function GET(request: Request, context: RouteContext) {
  return listBooks(request, context, false);
}

export async function POST(request: Request, context: RouteContext) {
  return listBooks(request, context, true);
}

async function listBooks(
  request: Request,
  { params }: RouteContext,
  forceRefresh: boolean,
) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;

  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) {
      const status = err.code === "UNAUTHENTICATED" ? 401 : 403;
      return NextResponse.json({ error: err.code }, { status });
    }
    throw err;
  }

  const { accountId } = await params;

  const account = await db.syncAccount.findFirst({
    where: {
      id: accountId,
      userId,
      status: { in: [...SYNC_ACCOUNT_ACTIVE_STATUSES] },
    },
    select: {
      baseUrl: true,
      principalUrl: true,
      credentialReference: true,
      credentialRevokedAt: true,
      discoveredBooks: true,
      booksDiscoveredAt: true,
      settings: { select: { bookAllowlist: true } },
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Sync account not found." }, { status: 404 });
  }

  const allowlist = account.settings?.bookAllowlist ?? [];

  // Serve fresh cache unless a refresh was explicitly requested.
  const cacheFresh =
    !forceRefresh &&
    account.discoveredBooks != null &&
    account.booksDiscoveredAt != null &&
    Date.now() - account.booksDiscoveredAt.getTime() < BOOKS_CACHE_TTL_MS;

  if (cacheFresh) {
    return NextResponse.json({
      books: account.discoveredBooks,
      allowlist,
      discoveredAt: account.booksDiscoveredAt?.toISOString() ?? null,
      cached: true,
    });
  }

  if (!account.credentialReference || account.credentialRevokedAt) {
    return NextResponse.json(
      { error: "This connection has no active credentials. Update credentials, then refresh." },
      { status: 409 },
    );
  }

  let credentials: ReturnType<typeof decryptSyncCredentialPayload>;
  try {
    credentials = decryptSyncCredentialPayload(account.credentialReference);
  } catch {
    return NextResponse.json(
      { error: "Stored credentials could not be read. Update credentials, then refresh." },
      { status: 409 },
    );
  }

  try {
    const books = await discoverCardDavAddressBooks({
      baseUrl: account.baseUrl,
      principalUrl: account.principalUrl,
      credentials: { username: credentials.username, password: credentials.password },
    });

    const discoveredAt = new Date();
    await db.syncAccount.update({
      where: { id: accountId },
      data: {
        discoveredBooks: books,
        booksDiscoveredAt: discoveredAt,
      },
    });

    return NextResponse.json({
      books,
      allowlist,
      discoveredAt: discoveredAt.toISOString(),
      cached: false,
    });
  } catch (error) {
    const message =
      error instanceof CardDavPreflightError
        ? error.message
        : "Could not reach the remote server to list address books.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
