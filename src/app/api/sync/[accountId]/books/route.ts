import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { CardDavPreflightError, discoverCardDavAddressBooks } from "~/server/carddav";
import { db } from "~/server/db";
import { decryptSyncCredentialPayload } from "~/server/sync-credentials";

const BOOKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// P23-03: list the remote address books for a connection's allowlist picker.
// Returns cached discovery within the TTL unless ?refresh=1 forces a re-run.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { accountId } = await params;
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";

  const account = await db.syncAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
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
