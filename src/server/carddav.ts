import type { PortableContactInput } from "~/server/contact-portability";
import { contactsToVCard } from "~/server/contact-portability";

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

// P23-03: one discovered remote address book in a connection's allowlist picker.
export type CardDavDiscoveredBook = {
  url: string;
  displayName: string | null;
  ctag: string | null;
  readOnly: boolean;
};

export type CardDavContactCard = CardDavAddressBookEntry & {
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  namePrefix: string | null;
  nameSuffix: string | null;
  nickname: string | null;
  emailAddresses: string[];
  emailEntries: Array<{ label: string; value: string; isPrimary: boolean }>;
  phoneNumbers: string[];
  phoneEntries: Array<{ label: string; value: string; isPrimary: boolean }>;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  websiteEntries: Array<{ label: string; value: string; isPrimary: boolean }>;
  birthday: string | null;
  address: string | null;
  postalAddresses: Array<{ label: string; formatted: string }>;
  addressEntries: Array<{
    label: string;
    formatted: string;
    isPrimary: boolean;
    countryOrRegion?: string;
    streetLine1?: string;
    streetLine2?: string;
    cityOrTown?: string;
    postcode?: string;
    poBox?: string;
  }>;
  notes: string | null;
};

export type CardDavPushResult = {
  href: string;
  etag: string | null;
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

const unescapeVCardValue = (value: string) =>
  value
    .replaceAll("\\n", "\n")
    .replaceAll("\\N", "\n")
    .replaceAll("\\,", ",")
    .replaceAll("\\;", ";")
    .replaceAll("\\\\", "\\")
    .trim();

const parseVCardParams = (parts: string[]) =>
  parts.reduce<Record<string, string[]>>((acc, rawPart) => {
    const [rawKey, rawValue] = rawPart.split("=", 2);
    const key = rawKey?.trim().toUpperCase();

    if (!key) {
      return acc;
    }

    const values =
      rawValue
        ?.split(",")
        .map((value) => unescapeVCardValue(value))
        .filter(Boolean) ?? [""];

    acc[key] = values;
    return acc;
  }, {});

const getPreferredLabel = (params: Record<string, string[]>, fallback: string) => {
  const typeValues = params.TYPE ?? [];
  const firstUsableType = typeValues.find((value) => value.toLowerCase() !== "pref");

  return firstUsableType?.toLowerCase() ?? fallback;
};

const parseVCardLines = (value: string) =>
  unfoldVCard(decodeXmlEntities(value))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toUpperCase().startsWith("BEGIN:") && !line.toUpperCase().startsWith("END:"))
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex < 0) {
        return null;
      }

      const left = line.slice(0, separatorIndex);
      const rawValue = line.slice(separatorIndex + 1);
      const [rawName, ...paramParts] = left.split(";");
      const name = rawName?.trim().toUpperCase();

      if (!name) {
        return null;
      }

      return {
        name,
        params: parseVCardParams(paramParts),
        value: unescapeVCardValue(rawValue),
      };
    })
    .filter((line): line is { name: string; params: Record<string, string[]>; value: string } => line != null);

const getVCardUid = (value: string) => {
  const unfolded = unfoldVCard(decodeXmlEntities(value));
  const match = /^UID(?:;[^:]*)?:(.+)$/im.exec(unfolded);

  return match?.[1]?.trim() ?? null;
};

const dedupeValues = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
};

const buildStructuredValues = (
  entries: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string; isPrimary: boolean }> =>
  entries
    .filter((entry) => entry.value.trim().length > 0)
    .map((entry, index) => ({
      label: entry.label,
      value: entry.value.trim(),
      isPrimary: index === 0,
    }));

const parseNameParts = (value: string) => {
  const [lastName, firstName, middleName, namePrefix, nameSuffix] = value
    .split(";")
    .map((part) => unescapeVCardValue(part));

  return {
    firstName: firstName ?? null,
    middleName: middleName ?? null,
    lastName: lastName ?? null,
    namePrefix: namePrefix ?? null,
    nameSuffix: nameSuffix ?? null,
  };
};

const parseAdrValue = (value: string, label: string) => {
  const [poBox, , streetLine1, cityOrTown, region, postcode, countryOrRegion] = value
    .split(";")
    .map((part) => unescapeVCardValue(part));
  const formatted = [streetLine1, cityOrTown, region, postcode, countryOrRegion]
    .filter(Boolean)
    .join(", ");

  if (!formatted) {
    return null;
  }

  return {
    label,
    formatted,
    isPrimary: false,
    countryOrRegion: countryOrRegion ?? region ?? undefined,
    streetLine1: streetLine1 ?? undefined,
    cityOrTown: cityOrTown ?? undefined,
    postcode: postcode ?? undefined,
    poBox: poBox ?? undefined,
  };
};

const parseCardDavContactCard = (
  entry: CardDavAddressBookEntry,
  addressData: string,
): CardDavContactCard => {
  const lines = parseVCardLines(addressData);
  const fnLine = lines.find((line) => line.name === "FN");
  const nLine = lines.find((line) => line.name === "N");
  const nicknameLine = lines.find((line) => line.name === "NICKNAME");
  const orgLine = lines.find((line) => line.name === "ORG");
  const titleLine = lines.find((line) => line.name === "TITLE");
  const bdayLine = lines.find((line) => line.name === "BDAY");
  const noteLines = lines.filter((line) => line.name === "NOTE");
  const emailEntries = buildStructuredValues(
    dedupeValues(
      lines.filter((line) => line.name === "EMAIL").map((line) => line.value),
    ).map((value) => {
      const original = lines.find((line) => line.name === "EMAIL" && line.value === value);
      return {
        label: getPreferredLabel(original?.params ?? {}, "email"),
        value,
      };
    }),
  );
  const phoneEntries = buildStructuredValues(
    dedupeValues(
      lines.filter((line) => line.name === "TEL").map((line) => line.value),
    ).map((value) => {
      const original = lines.find((line) => line.name === "TEL" && line.value === value);
      return {
        label: getPreferredLabel(original?.params ?? {}, "phone"),
        value,
      };
    }),
  );
  const websiteEntries = buildStructuredValues(
    dedupeValues(
      lines.filter((line) => line.name === "URL").map((line) => line.value),
    ).map((value) => {
      const original = lines.find((line) => line.name === "URL" && line.value === value);
      return {
        label: getPreferredLabel(original?.params ?? {}, "website"),
        value,
      };
    }),
  );
  const addressEntries = lines
    .filter((line) => line.name === "ADR")
    .map((line) => parseAdrValue(line.value, getPreferredLabel(line.params, "address")))
    .filter((entry): entry is NonNullable<ReturnType<typeof parseAdrValue>> => entry != null)
    .map((entry, index) => ({
      ...entry,
      isPrimary: index === 0,
    }));
  const postalAddresses = addressEntries.map((entry) => ({
    label: entry.label,
    formatted: entry.formatted,
  }));
  const nameParts = nLine ? parseNameParts(nLine.value) : null;
  const derivedFullName = [
    nameParts?.namePrefix,
    nameParts?.firstName,
    nameParts?.middleName,
    nameParts?.lastName,
    nameParts?.nameSuffix,
  ]
    .filter(Boolean)
    .join(" ");
  const resolvedDerivedFullName = derivedFullName.length > 0 ? derivedFullName : null;

  return {
    ...entry,
    fullName:
      fnLine?.value ?? resolvedDerivedFullName ?? `Imported contact ${entry.uid}`,
    firstName: nameParts?.firstName ?? null,
    middleName: nameParts?.middleName ?? null,
    lastName: nameParts?.lastName ?? null,
    namePrefix: nameParts?.namePrefix ?? null,
    nameSuffix: nameParts?.nameSuffix ?? null,
    nickname: nicknameLine?.value ?? null,
    emailAddresses: emailEntries.map((item) => item.value),
    emailEntries,
    phoneNumbers: phoneEntries.map((item) => item.value),
    phoneEntries,
    company: orgLine?.value.split(";")[0]?.trim() ?? null,
    jobTitle: titleLine?.value ?? null,
    website: websiteEntries[0]?.value ?? null,
    websiteEntries,
    birthday: bdayLine?.value ?? null,
    address: addressEntries[0]?.formatted ?? null,
    postalAddresses,
    addressEntries,
    notes: noteLines.map((line) => line.value).filter(Boolean).join("\n\n") || null,
  };
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

export const fetchCardDavAddressBookCards = async ({
  addressBookUrl,
  credentials,
}: {
  addressBookUrl: string;
  credentials: CardDavCredentials;
}): Promise<CardDavContactCard[]> => {
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

      if (!summary.resolvedHref || !addressData || !uid) {
        return null;
      }

      return parseCardDavContactCard(
        {
          href: summary.resolvedHref,
          etag: getTagContent(block, "getetag"),
          uid,
        },
        addressData,
      );
    })
    .filter((item): item is CardDavContactCard => item != null);
};

const ensureTrailingSlash = (value: string) => (value.endsWith("/") ? value : `${value}/`);

const buildCardDavContactBody = (contact: PortableContactInput, uid: string) =>
  contactsToVCard([contact]).replace(/\r\nEND:VCARD$/, `\r\nUID:${uid}\r\nEND:VCARD`);

export const pushCardDavContact = async ({
  addressBookUrl,
  credentials,
  remoteUid,
  contact,
}: {
  addressBookUrl: string;
  credentials: CardDavCredentials;
  remoteUid: string;
  contact: PortableContactInput;
}): Promise<CardDavPushResult> => {
  const collectionUrl = ensureTrailingSlash(normalizeUrl(addressBookUrl));
  const href = new URL(`${encodeURIComponent(remoteUid)}.vcf`, collectionUrl).toString();
  const body = buildCardDavContactBody(contact, remoteUid);

  let response: Response;

  try {
    response = await fetch(href, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${credentials.username}:${credentials.password}`,
          "utf8",
        ).toString("base64")}`,
        "Content-Type": "text/vcard; charset=utf-8",
        "User-Agent": USER_AGENT,
      },
      body,
      cache: "no-store",
    });
  } catch (error) {
    throw new CardDavPreflightError(
      "CARDDAV_PUSH_NETWORK_ERROR",
      error instanceof Error
        ? `CardDAV push could not reach the remote server: ${error.message}`
        : "CardDAV push could not reach the remote server.",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new CardDavPreflightError(
      "CARDDAV_PUSH_AUTH_FAILED",
      "CardDAV push credentials were rejected by the remote address book.",
    );
  }

  if (!response.ok) {
    throw new CardDavPreflightError(
      "CARDDAV_PUSH_HTTP_ERROR",
      `CardDAV push failed with HTTP ${response.status}.`,
    );
  }

  return {
    href,
    etag: response.headers.get("etag"),
  };
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

// P23-03: enumerate every address book the remote exposes (not just the first),
// for the connection settings allowlist picker. Resolves the address-book home
// set the same way as discoverCardDavAccount, then PROPFIND depth:1 to list books.
export const discoverCardDavAddressBooks = async ({
  baseUrl,
  principalUrl,
  credentials,
}: {
  baseUrl: string;
  principalUrl?: string | null;
  credentials: CardDavCredentials;
}): Promise<CardDavDiscoveredBook[]> => {
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
      "CardDAV discovery received an empty response.",
    );
  }

  let homeSetUrl = baseSummary.addressBookHomeSet;
  const resolvedPrincipalUrl =
    principalUrl != null ? normalizeUrl(principalUrl) : (baseSummary.currentUserPrincipal ?? null);

  if (!homeSetUrl && resolvedPrincipalUrl) {
    const principalXml = await propfind({
      url: resolvedPrincipalUrl,
      credentials,
      depth: 0,
      body: PRINCIPAL_BODY,
    });
    const principalSummary = getFirstSummary(principalXml, resolvedPrincipalUrl);
    homeSetUrl = principalSummary?.addressBookHomeSet ?? null;
  }

  const collectionUrl = homeSetUrl ?? resolvedPrincipalUrl ?? normalizedBaseUrl;
  const collectionXml = await propfind({
    url: collectionUrl,
    credentials,
    depth: 1,
    body: ADDRESS_BOOK_BODY,
  });

  const books: CardDavDiscoveredBook[] = [];
  const seen = new Set<string>();
  for (const block of getResponseBlocks(collectionXml)) {
    const summary = summarizeResponse(block, collectionUrl);
    if (!summary.resolvedHref || !isAddressBookResource(summary)) continue;
    if (seen.has(summary.resolvedHref)) continue;
    seen.add(summary.resolvedHref);
    books.push({
      url: summary.resolvedHref,
      displayName: summary.displayName,
      ctag: summary.ctag,
      // Read-only detection needs a current-user-privilege-set PROPFIND, which the
      // discovery body does not request yet; default to writable. (P23-03 risk note.)
      readOnly: false,
    });
  }

  return books;
};
