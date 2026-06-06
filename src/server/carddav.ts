type CardDavCredentials = {
  username: string;
  password: string;
};

type CardDavResponseSummary = {
  href: string | null;
  resolvedHref: string | null;
  currentUserPrincipal: string | null;
  addressBookHomeSet: string | null;
  displayName: string | null;
  ctag: string | null;
  resourceTypeXml: string | null;
};

export type CardDavDiscoveryResult = {
  principalUrl: string;
  addressBookUrl: string;
  remoteAccountId: string;
  remoteCTag: string | null;
  addressBookDisplayName: string | null;
};

export type CardDavAddressBookEntry = {
  href: string;
  etag: string | null;
  uid: string;
};

export class CardDavPreflightError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CardDavPreflightError";
    this.code = code;
  }
}

const USER_AGENT = "Kontax/0.1 CardDAV preflight";

const decodeXmlEntities = (value: string) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");

const normalizeUrl = (value: string) => new URL(value).toString();

const resolveHref = (href: string | null, contextUrl: string) => {
  if (!href) {
    return null;
  }

  try {
    return new URL(decodeXmlEntities(href), contextUrl).toString();
  } catch {
    return null;
  }
};

const getTagContent = (xml: string, localName: string) => {
  const match = new RegExp(
    `<(?:[\\w-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${localName}>`,
    "i",
  ).exec(xml);

  return match?.[1]?.trim() ?? null;
};

const getNestedHref = (xml: string, localName: string, contextUrl: string) => {
  const block = getTagContent(xml, localName);

  if (!block) {
    return null;
  }

  return resolveHref(getTagContent(block, "href"), contextUrl);
};

const getResponseBlocks = (xml: string) =>
  [...xml.matchAll(/<(?:[\w-]+:)?response\b[\s\S]*?<\/(?:[\w-]+:)?response>/gi)].map(
    (match) => match[0],
  );

const summarizeResponse = (responseXml: string, contextUrl: string): CardDavResponseSummary => {
  const href = getTagContent(responseXml, "href");

  return {
    href,
    resolvedHref: resolveHref(href, contextUrl),
    currentUserPrincipal: getNestedHref(responseXml, "current-user-principal", contextUrl),
    addressBookHomeSet: getNestedHref(responseXml, "addressbook-home-set", contextUrl),
    displayName: getTagContent(responseXml, "displayname"),
    ctag: getTagContent(responseXml, "getctag"),
    resourceTypeXml: getTagContent(responseXml, "resourcetype"),
  };
};

const isAddressBookResource = (summary: CardDavResponseSummary) =>
  summary.resourceTypeXml?.toLowerCase().includes("addressbook") ?? false;

const propfind = async ({
  url,
  credentials,
  depth,
  body,
}: {
  url: string;
  credentials: CardDavCredentials;
  depth: 0 | 1;
  body: string;
}) => {
  return davRequest({
    url,
    credentials,
    method: "PROPFIND",
    depth,
    body,
  });
};

const davRequest = async ({
  url,
  credentials,
  method,
  depth,
  body,
}: {
  url: string;
  credentials: CardDavCredentials;
  method: "PROPFIND" | "REPORT";
  depth: 0 | 1;
  body: string;
}) => {
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${credentials.username}:${credentials.password}`,
          "utf8",
        ).toString("base64")}`,
        Depth: String(depth),
        "Content-Type": "application/xml; charset=utf-8",
        "User-Agent": USER_AGENT,
      },
      body,
      cache: "no-store",
    });
  } catch (error) {
    throw new CardDavPreflightError(
      "CARDDAV_NETWORK_ERROR",
      error instanceof Error
        ? `CardDAV preflight could not reach the remote server: ${error.message}`
        : "CardDAV preflight could not reach the remote server.",
    );
  }

  const xml = await response.text();

  if (response.status === 401 || response.status === 403) {
    throw new CardDavPreflightError(
      "CARDDAV_AUTH_FAILED",
      "CardDAV credentials were rejected during preflight. Check the username, password, or app password.",
    );
  }

  if (response.status === 404) {
    throw new CardDavPreflightError(
      "CARDDAV_NOT_FOUND",
      "CardDAV preflight could not find the expected collection or principal URL.",
    );
  }

  if (!response.ok && response.status !== 207) {
    throw new CardDavPreflightError(
      "CARDDAV_HTTP_ERROR",
      `CardDAV preflight failed with HTTP ${response.status}.`,
    );
  }

  return xml;
};

const BASE_DISCOVERY_BODY = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:current-user-principal />
    <card:addressbook-home-set />
    <d:displayname />
    <d:resourcetype />
    <cs:getctag />
  </d:prop>
</d:propfind>`;

const ADDRESS_BOOK_BODY = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
    <cs:getctag />
  </d:prop>
</d:propfind>`;

const ADDRESS_BOOK_INDEX_BODY = `<?xml version="1.0" encoding="utf-8" ?>
<card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag />
    <card:address-data />
  </d:prop>
  <card:filter test="anyof">
    <card:prop-filter name="FN" />
  </card:filter>
</card:addressbook-query>`;

const PRINCIPAL_BODY = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <card:addressbook-home-set />
    <d:displayname />
  </d:prop>
</d:propfind>`;

const getFirstSummary = (xml: string, contextUrl: string) => {
  const firstBlock = getResponseBlocks(xml)[0];

  if (!firstBlock) {
    return null;
  }

  return summarizeResponse(firstBlock, contextUrl);
};

const getAddressBookCandidate = (xml: string, contextUrl: string) => {
  const summaries = getResponseBlocks(xml).map((block) => summarizeResponse(block, contextUrl));

  return summaries.find((summary) => isAddressBookResource(summary) && summary.resolvedHref);
};

const unfoldVCard = (value: string) => value.replace(/\r?\n[ \t]/g, "");

const getVCardUid = (value: string) => {
  const unfolded = unfoldVCard(decodeXmlEntities(value));
  const match = /^UID(?:;[^:]*)?:(.+)$/im.exec(unfolded);

  return match?.[1]?.trim() ?? null;
};

export const fetchCardDavAddressBookIndex = async ({
  addressBookUrl,
  credentials,
}: {
  addressBookUrl: string;
  credentials: CardDavCredentials;
}): Promise<CardDavAddressBookEntry[]> => {
  const normalizedAddressBookUrl = normalizeUrl(addressBookUrl);
  const xml = await davRequest({
    url: normalizedAddressBookUrl,
    credentials,
    method: "REPORT",
    depth: 1,
    body: ADDRESS_BOOK_INDEX_BODY,
  });

  return getResponseBlocks(xml)
    .map((block) => {
      const summary = summarizeResponse(block, normalizedAddressBookUrl);
      const addressData = getTagContent(block, "address-data");
      const uid = addressData ? getVCardUid(addressData) : null;

      if (!summary.resolvedHref || !uid) {
        return null;
      }

      return {
        href: summary.resolvedHref,
        etag: getTagContent(block, "getetag"),
        uid,
      };
    })
    .filter((item): item is CardDavAddressBookEntry => item != null);
};

export const discoverCardDavAccount = async ({
  baseUrl,
  principalUrl,
  addressBookUrl,
  credentials,
}: {
  baseUrl: string;
  principalUrl?: string | null;
  addressBookUrl?: string | null;
  credentials: CardDavCredentials;
}): Promise<CardDavDiscoveryResult> => {
  const normalizedBaseUrl = normalizeUrl(baseUrl);
  const baseXml = await propfind({
    url: normalizedBaseUrl,
    credentials,
    depth: 0,
    body: BASE_DISCOVERY_BODY,
  });
  const baseSummary = getFirstSummary(baseXml, normalizedBaseUrl);

  if (!baseSummary) {
    throw new CardDavPreflightError(
      "CARDDAV_DISCOVERY_EMPTY",
      "CardDAV preflight received an empty discovery response.",
    );
  }

  let resolvedPrincipalUrl =
    principalUrl != null ? normalizeUrl(principalUrl) : (baseSummary.currentUserPrincipal ?? null);
  let resolvedAddressBookUrl =
    addressBookUrl != null ? normalizeUrl(addressBookUrl) : null;
  let resolvedRemoteCTag = baseSummary.ctag;
  let resolvedDisplayName = baseSummary.displayName;

  if (!resolvedAddressBookUrl && isAddressBookResource(baseSummary) && baseSummary.resolvedHref) {
    resolvedAddressBookUrl = baseSummary.resolvedHref;
  }

  if (!resolvedPrincipalUrl && resolvedAddressBookUrl) {
    resolvedPrincipalUrl = resolvedAddressBookUrl;
  }

  if (!resolvedAddressBookUrl) {
    let addressBookHomeSetUrl = baseSummary.addressBookHomeSet;

    if (!addressBookHomeSetUrl && resolvedPrincipalUrl) {
      const principalXml = await propfind({
        url: resolvedPrincipalUrl,
        credentials,
        depth: 0,
        body: PRINCIPAL_BODY,
      });
      const principalSummary = getFirstSummary(principalXml, resolvedPrincipalUrl);

      addressBookHomeSetUrl = principalSummary?.addressBookHomeSet ?? null;
      resolvedPrincipalUrl = resolvedPrincipalUrl ?? principalSummary?.resolvedHref ?? null;
    }

    const discoveryCollectionUrl = addressBookHomeSetUrl ?? resolvedPrincipalUrl ?? normalizedBaseUrl;
    const collectionXml = await propfind({
      url: discoveryCollectionUrl,
      credentials,
      depth: 1,
      body: ADDRESS_BOOK_BODY,
    });
    const addressBookCandidate = getAddressBookCandidate(collectionXml, discoveryCollectionUrl);

    if (!addressBookCandidate?.resolvedHref) {
      throw new CardDavPreflightError(
        "CARDDAV_ADDRESSBOOK_NOT_FOUND",
        "CardDAV preflight could not discover a usable address book collection.",
      );
    }

    resolvedAddressBookUrl = addressBookCandidate.resolvedHref;
    resolvedRemoteCTag = addressBookCandidate.ctag;
    resolvedDisplayName = addressBookCandidate.displayName;
  } else {
    const addressBookXml = await propfind({
      url: resolvedAddressBookUrl,
      credentials,
      depth: 0,
      body: ADDRESS_BOOK_BODY,
    });
    const addressBookSummary = getFirstSummary(addressBookXml, resolvedAddressBookUrl);

    if (!addressBookSummary?.resolvedHref || !isAddressBookResource(addressBookSummary)) {
      throw new CardDavPreflightError(
        "CARDDAV_ADDRESSBOOK_INVALID",
        "The configured CardDAV address book URL does not appear to be a valid address book collection.",
      );
    }

    resolvedAddressBookUrl = addressBookSummary.resolvedHref;
    resolvedRemoteCTag = addressBookSummary.ctag;
    resolvedDisplayName = addressBookSummary.displayName;
  }

  const remoteAccountId = resolvedPrincipalUrl ?? resolvedAddressBookUrl;

  if (!remoteAccountId) {
    throw new CardDavPreflightError(
      "CARDDAV_ACCOUNT_ID_MISSING",
      "CardDAV preflight could not determine a stable remote account identifier.",
    );
  }

  return {
    principalUrl: resolvedPrincipalUrl ?? resolvedAddressBookUrl,
    addressBookUrl: resolvedAddressBookUrl,
    remoteAccountId,
    remoteCTag: resolvedRemoteCTag,
    addressBookDisplayName: resolvedDisplayName,
  };
};
