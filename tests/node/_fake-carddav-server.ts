// P49A-03: an in-memory remote CardDAV address book (iCloud / Fastmail /
// Nextcloud stand-in) behind a `safeFetch`-compatible function. Tests install
// it with `mock.module("~/server/safe-fetch", …)` before importing carddav.ts,
// so no request ever leaves the process.
//
// It implements just what the Kontax CardDAV client sends: the address-book
// REPORT (multistatus, ETags entity-escaped the way SabreDAV writes them), GET
// of one card, conditional PUT (If-Match / If-None-Match: *, 412 otherwise) and
// DELETE. Every request is recorded for assertions.

import type { SafeFetchOptions, SafeFetchResponse } from "~/server/safe-fetch";

export type FakeCardDavRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
};

type StoredCard = { vcard: string; etag: string };

const escapeXml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const response = (
  url: string,
  status: number,
  body: string,
  headers: Record<string, string> = {},
): SafeFetchResponse => ({
  status,
  headers,
  body: Buffer.from(body, "utf8"),
  url,
  ok: status >= 200 && status < 300,
});

export const createFakeCardDavServer = (addressBookUrl: string) => {
  const bookUrl = addressBookUrl.endsWith("/") ? addressBookUrl : `${addressBookUrl}/`;
  const cards = new Map<string, StoredCard>();
  const requests: FakeCardDavRequest[] = [];
  let etagSeq = 0;
  const nextEtag = () => `"etag-${++etagSeq}"`;
  // Runs before a PUT is evaluated — lets a test make a "concurrent" remote
  // edit land between Kontax's REPORT and its PUT.
  let beforePut: ((href: string) => void) | null = null;

  const hrefFor = (name: string) => new URL(name, bookUrl).toString();

  const headerMap = (headers: SafeFetchOptions["headers"]): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers ?? {})) {
      if (value != null) out[key.toLowerCase()] = String(value);
    }
    return out;
  };

  const fetch = async (rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> => {
    const method = (options.method ?? "GET").toUpperCase();
    const url = new URL(rawUrl).toString();
    const headers = headerMap(options.headers);
    const body =
      options.body == null
        ? null
        : Buffer.isBuffer(options.body)
          ? options.body.toString("utf8")
          : String(options.body);
    requests.push({ method, url, headers, body });

    if (method === "REPORT" && url === bookUrl) {
      const blocks = [...cards.entries()].map(
        ([href, card]) =>
          `<d:response><d:href>${escapeXml(new URL(href).pathname)}</d:href><d:propstat><d:prop>` +
          `<d:getetag>${escapeXml(card.etag)}</d:getetag>` +
          `<card:address-data>${escapeXml(card.vcard)}</card:address-data>` +
          `</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`,
      );
      return response(
        url,
        207,
        `<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">${blocks.join("")}</d:multistatus>`,
      );
    }

    if (method === "GET") {
      const card = cards.get(url);
      return card
        ? response(url, 200, card.vcard, { etag: card.etag, "content-type": "text/vcard; charset=utf-8" })
        : response(url, 404, "");
    }

    if (method === "PUT") {
      beforePut?.(url);
      const existing = cards.get(url);
      const ifMatch = headers["if-match"];
      const ifNoneMatch = headers["if-none-match"];
      if (ifMatch != null && existing?.etag !== ifMatch) {
        return response(url, 412, "");
      }
      if (ifNoneMatch === "*" && existing) {
        return response(url, 412, "");
      }
      const etag = nextEtag();
      cards.set(url, { vcard: body ?? "", etag });
      return response(url, existing ? 204 : 201, "", { etag });
    }

    if (method === "DELETE") {
      const existed = cards.delete(url);
      return response(url, existed ? 204 : 404, "");
    }

    return response(url, 405, "");
  };

  return {
    bookUrl,
    fetch,
    requests,
    hrefFor,
    /** Put a card on the server directly (as another client would). */
    seed(name: string, vcard: string): string {
      const href = hrefFor(name);
      cards.set(href, { vcard, etag: nextEtag() });
      return href;
    },
    /** Another client edits a card: new body, new ETag. */
    remoteEdit(href: string, vcard: string) {
      cards.set(href, { vcard, etag: nextEtag() });
    },
    card(href: string): StoredCard | undefined {
      return cards.get(href);
    },
    cardCount: () => cards.size,
    onBeforePut(hook: ((href: string) => void) | null) {
      beforePut = hook;
    },
    puts: () => requests.filter((request) => request.method === "PUT"),
    reset() {
      cards.clear();
      requests.length = 0;
      beforePut = null;
      etagSeq = 0;
    },
  };
};

export type FakeCardDavServer = ReturnType<typeof createFakeCardDavServer>;

/** CRLF-join vCard lines. */
export const vcard = (...lines: string[]) => lines.join("\r\n");

/** The unfolded content lines of a vCard, for property assertions. */
export const vcardLines = (text: string) =>
  text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n").filter(Boolean);
