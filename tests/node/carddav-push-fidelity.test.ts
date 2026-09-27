// P49A-03 (A-03, A-21): the CardDAV client push keeps what Kontax doesn't
// model, never overwrites a concurrent remote edit, and copes with duplicate
// UIDs. Part 1 pins the pure vCard merge; part 2 drives the real carddav.ts
// client against an in-memory CardDAV server (tests/node/_fake-carddav-server.ts)
// installed in place of safeFetch — no network.
import test, { beforeEach, describe, mock } from "node:test";
import assert from "node:assert/strict";

import type { CardDavContactCard } from "~/server/carddav";

import {
  createFakeCardDavServer,
  vcard,
  vcardLines,
} from "./_fake-carddav-server";

const server = createFakeCardDavServer("https://contacts.icloud.com/1234/carddavhome/card/");
const realSafeFetch = await import("~/server/safe-fetch");
mock.module("~/server/safe-fetch", {
  namedExports: { ...realSafeFetch, safeFetch: server.fetch },
});

const merge = await import("~/server/carddav-vcard-merge");
const carddav = await import("~/server/carddav");
const { resolveSyncProviderCapabilityProfile } = await import("~/server/sync-provider-capabilities");

const credentials = { username: "user@example.com", password: "app-specific-password" };
const icloudProfile = resolveSyncProviderCapabilityProfile({
  provider: "CARDDAV",
  baseUrl: "https://contacts.icloud.com",
  addressBookUrl: server.bookUrl,
});
const genericProfile = resolveSyncProviderCapabilityProfile({
  provider: "CARDDAV",
  addressBookUrl: "https://dav.example.org/addressbooks/u/contacts/",
});

// An iCloud card as iOS writes it: grouped labels, Apple X- properties, and
// properties Kontax does not model (IMPP, X-ABRELATEDNAMES, CATEGORIES, …).
const ICLOUD_CARD = vcard(
  "BEGIN:VCARD",
  "VERSION:3.0",
  "PRODID:-//Apple Inc.//iPhone OS 18.0//EN",
  "N:Appleseed;Johnny;;;",
  "FN:Johnny Appleseed",
  "ORG:Apple;",
  "item1.EMAIL;type=INTERNET;type=pref:johnny@example.com",
  "item1.X-ABLabel:_$!<Other>!$_",
  "TEL;type=CELL;type=VOICE;type=pref:+1 555 0100",
  "item2.X-ABDATE;type=pref:2010-06-12",
  "item2.X-ABLabel:_$!<Anniversary>!$_",
  "IMPP;X-SERVICE-TYPE=Skype;type=pref:skype:johnny.appleseed",
  "item3.X-ABRELATEDNAMES;type=pref:Jane Appleseed",
  "item3.X-ABLabel:_$!<Spouse>!$_",
  "CATEGORIES:Friends,Family",
  "X-SOCIALPROFILE;type=twitter:https://twitter.com/johnny",
  "X-ABShowAs:PERSON",
  "NOTE:Met at WWDC",
  "REV:2026-09-01T10:00:00Z",
  "UID:icloud-uid-1",
  "END:VCARD",
);

const PRESERVED_ICLOUD_LINES = [
  "IMPP;X-SERVICE-TYPE=Skype;type=pref:skype:johnny.appleseed",
  "item3.X-ABRELATEDNAMES;type=pref:Jane Appleseed",
  "item3.X-ABLabel:_$!<Spouse>!$_",
  "CATEGORIES:Friends,Family",
  "X-SOCIALPROFILE;type=twitter:https://twitter.com/johnny",
  "X-ABShowAs:PERSON",
];

// Kontax's copy of that contact after the user renamed it in Kontax.
const renamedContact = {
  fullName: "Johnny B. Appleseed",
  firstName: "Johnny",
  middleName: "B.",
  lastName: "Appleseed",
  namePrefix: null,
  nameSuffix: null,
  nickname: null,
  email: "johnny@example.com",
  emailAddresses: ["johnny@example.com"],
  emailEntries: [{ label: "Other", value: "johnny@example.com", isPrimary: true }],
  phone: "+1 555 0100",
  phoneNumbers: ["+1 555 0100"],
  phoneEntries: [{ label: "mobile", value: "+1 555 0100", isPrimary: true }],
  company: "Apple",
  department: null,
  jobTitle: null,
  website: null,
  websiteEntries: [],
  birthday: null,
  significantDates: [{ label: "Anniversary", date: "2010-06-12", isPrimary: true }],
  address: null,
  postalAddresses: [],
  addressEntries: [],
  notes: "Met at WWDC",
};

const countProperty = (text: string, name: string) =>
  vcardLines(text).filter((line) => {
    const qualified = line.slice(0, line.search(/[;:]/)).toUpperCase();
    return qualified === name || qualified.endsWith(`.${name}`);
  }).length;

beforeEach(() => {
  server.reset();
});

describe("vCard merge (pure)", () => {
  const kontaxBody = vcard(
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Johnny B. Appleseed",
    "N:Appleseed;Johnny;B.;;",
    "item1.EMAIL;TYPE=INTERNET;TYPE=OTHER;TYPE=PREF:johnny@example.com",
    "TEL;TYPE=CELL;TYPE=PREF:+1 555 0100",
    "ORG:Apple;",
    "item2.X-ABDATE:2010-06-12",
    "item2.X-ABLABEL:Anniversary",
    "NOTE:Met at WWDC",
    "UID:icloud-uid-1",
    "END:VCARD",
  );

  test("keeps every unmodelled remote property verbatim and replaces the Kontax-owned ones", () => {
    const merged = merge.mergeRemoteVCardForPush({
      kontaxVCard: kontaxBody,
      remoteVCard: ICLOUD_CARD,
      owned: merge.cardDavOwnedProperties({ significantDates: true, photo: false }),
    });
    const lines = vcardLines(merged);

    for (const preserved of PRESERVED_ICLOUD_LINES) {
      assert.ok(lines.includes(preserved), `preserved verbatim: ${preserved}`);
    }
    assert.ok(lines.includes("FN:Johnny B. Appleseed"));
    assert.ok(!lines.includes("FN:Johnny Appleseed"), "the remote FN is replaced");
    for (const owned of ["FN", "N", "EMAIL", "TEL", "ORG", "NOTE", "UID", "VERSION", "X-ABDATE"]) {
      assert.equal(countProperty(merged, owned), 1, `${owned} appears exactly once`);
    }
    // The remote's grouped label for the (owned) email goes with it.
    assert.ok(!lines.includes("item1.X-ABLabel:_$!<Other>!$_"));
    assert.ok(!lines.includes("item2.X-ABLabel:_$!<Anniversary>!$_"));
    assert.equal(countProperty(merged, "REV"), 0, "a stale REV is dropped");
    assert.equal(countProperty(merged, "PRODID"), 0, "the remote PRODID is dropped");
    assert.equal(lines[0], "BEGIN:VCARD");
    assert.equal(lines.at(-1), "END:VCARD");
    assert.equal(countProperty(merged, "END"), 1);
  });

  test("for a provider that does not round-trip anniversaries, the remote X-ABDATE is preserved and its group renamed off a Kontax group", () => {
    const merged = merge.mergeRemoteVCardForPush({
      kontaxVCard: kontaxBody.replace("item2.X-ABDATE:2010-06-12\r\nitem2.X-ABLABEL:Anniversary\r\n", "item2.URL;TYPE=OTHER:https://example.com\r\nitem2.X-ABLABEL:blog\r\n"),
      remoteVCard: ICLOUD_CARD,
      owned: merge.cardDavOwnedProperties({ significantDates: false, photo: false }),
    });
    const lines = vcardLines(merged);
    // Kontax used item1 and item2; remote item3 is free, so the remote item2
    // (X-ABDATE) moves to the next unused group, item4, label and all.
    assert.ok(lines.includes("item4.X-ABDATE;type=pref:2010-06-12"));
    assert.ok(lines.includes("item4.X-ABLabel:_$!<Anniversary>!$_"));
    assert.ok(lines.includes("item3.X-ABRELATEDNAMES;type=pref:Jane Appleseed"));
    assert.ok(lines.includes("item2.URL;TYPE=OTHER:https://example.com"));
    assert.ok(lines.includes("item2.X-ABLABEL:blog"));
  });

  test("the photo is preserved unless the push owns it", () => {
    const withPhoto = ICLOUD_CARD.replace("UID:", "PHOTO;ENCODING=b;TYPE=JPEG:AAAA\r\nUID:");
    const kept = merge.mergeRemoteVCardForPush({
      kontaxVCard: kontaxBody,
      remoteVCard: withPhoto,
      owned: merge.cardDavOwnedProperties({ significantDates: true, photo: false }),
    });
    assert.ok(vcardLines(kept).includes("PHOTO;ENCODING=b;TYPE=JPEG:AAAA"));

    const replaced = merge.mergeRemoteVCardForPush({
      kontaxVCard: kontaxBody.replace("END:VCARD", "PHOTO;ENCODING=b;TYPE=JPEG:BBBB\r\nEND:VCARD"),
      remoteVCard: withPhoto,
      owned: merge.cardDavOwnedProperties({ significantDates: true, photo: true }),
    });
    assert.equal(countProperty(replaced, "PHOTO"), 1);
    assert.ok(vcardLines(replaced).includes("PHOTO;ENCODING=b;TYPE=JPEG:BBBB"));
  });

  test("without a remote card the Kontax body is unchanged", () => {
    assert.equal(
      merge.mergeRemoteVCardForPush({ kontaxVCard: kontaxBody, remoteVCard: null, owned: new Set() }),
      kontaxBody,
    );
  });

  test("replaceVCardPhoto swaps only the PHOTO (vCard 3 and 4) and can remove it", () => {
    const withPhoto = ICLOUD_CARD.replace("UID:", "PHOTO;VALUE=uri:https://p1.icloud.com/photo/1\r\nUID:");
    const swapped = merge.replaceVCardPhoto(withPhoto, "QkJCQg==");
    assert.equal(countProperty(swapped, "PHOTO"), 1);
    assert.ok(vcardLines(swapped).includes("PHOTO;ENCODING=b;TYPE=JPEG:QkJCQg=="));
    for (const line of vcardLines(ICLOUD_CARD)) {
      assert.ok(vcardLines(swapped).includes(line), `unchanged: ${line}`);
    }

    const removed = merge.replaceVCardPhoto(withPhoto, null);
    assert.equal(countProperty(removed, "PHOTO"), 0);

    const v4 = merge.replaceVCardPhoto(vcard("BEGIN:VCARD", "VERSION:4.0", "FN:A", "UID:a", "END:VCARD"), "QQ==");
    assert.ok(vcardLines(v4).includes("PHOTO:data:image/jpeg;base64,QQ=="));
  });

  test("long lines fold at 75 octets without splitting a UTF-8 character", () => {
    const line = `NOTE:${"日本語のメモ🙂".repeat(12)}`;
    const folded = merge.foldVCardContentLine(line);
    for (const physical of folded.split("\r\n")) {
      assert.ok(Buffer.byteLength(physical, "utf8") <= 75, `≤ 75 octets: ${Buffer.byteLength(physical, "utf8")}`);
    }
    assert.equal(folded.replace(/\r\n /g, ""), line);
  });

  test("readVCardRevision reads basic and extended REV forms", () => {
    const rev = (value: string) => merge.readVCardRevision(vcard("BEGIN:VCARD", `REV:${value}`, "END:VCARD"));
    assert.equal(rev("2026-09-01T10:00:00Z"), Date.parse("2026-09-01T10:00:00Z"));
    assert.equal(rev("20260901T100000Z"), Date.parse("2026-09-01T10:00:00Z"));
    assert.equal(rev("20260901T120000+0200"), Date.parse("2026-09-01T10:00:00Z"));
    assert.equal(rev("not a date"), null);
    assert.equal(merge.readVCardRevision(vcard("BEGIN:VCARD", "END:VCARD")), null);
  });
});

describe("ETag handling", () => {
  test("toIfMatchValue decodes, quotes, and refuses weak ETags", () => {
    assert.equal(carddav.toIfMatchValue("&quot;abc&quot;"), '"abc"');
    assert.equal(carddav.toIfMatchValue('"abc"'), '"abc"');
    assert.equal(carddav.toIfMatchValue("abc"), '"abc"');
    assert.equal(carddav.toIfMatchValue('W/"abc"'), null);
    assert.equal(carddav.toIfMatchValue(null), null);
  });

  test("sameCardDavETag treats an entity-escaped REPORT ETag as the PUT response ETag", () => {
    assert.ok(carddav.sameCardDavETag("&quot;abc&quot;", '"abc"'));
    assert.ok(carddav.sameCardDavETag(null, null));
    assert.ok(!carddav.sameCardDavETag('"abc"', '"abd"'));
    assert.ok(!carddav.sameCardDavETag('"abc"', null));
  });
});

describe("duplicate UIDs (A-21)", () => {
  const fetched = (href: string, uid: string, rev?: string) => ({
    card: { href, uid, etag: null } as unknown as CardDavContactCard,
    vcard: vcard("BEGIN:VCARD", "VERSION:3.0", `UID:${uid}`, ...(rev ? [`REV:${rev}`] : []), "END:VCARD"),
  });

  test("keeps one card per UID: the linked one, else the newest REV, else the first href", () => {
    const a = fetched("https://x/b.vcf", "dup", "2026-01-01T00:00:00Z");
    const b = fetched("https://x/a.vcf", "dup", "2026-06-01T00:00:00Z");
    const c = fetched("https://x/c.vcf", "solo");

    const byRev = carddav.dedupeCardDavCardsByUid([a, b, c]);
    assert.deepEqual(byRev.kept, [b, c], "newest REV wins; server order kept");
    assert.deepEqual(byRev.dropped, [a]);

    const byLink = carddav.dedupeCardDavCardsByUid([a, b, c], new Map([["dup", "https://x/b.vcf"]]));
    assert.deepEqual(byLink.kept, [a, c], "the already-linked card wins over a newer REV");

    const noRev = carddav.dedupeCardDavCardsByUid([fetched("https://x/z.vcf", "d"), fetched("https://x/y.vcf", "d")]);
    assert.equal(noRev.kept[0]!.card.href, "https://x/y.vcf", "deterministic: first href");
  });
});

describe("pushCardDavContact against a CardDAV server", () => {
  test("an iCloud card edited in Kontax (name change) is pushed with X-ABDATE, IMPP, X-ABRELATEDNAMES and CATEGORIES intact, under If-Match", async () => {
    const href = server.seed("icloud-uid-1.vcf", ICLOUD_CARD);
    const [remote] = await carddav.fetchCardDavAddressBookCardsWithRaw({
      addressBookUrl: server.bookUrl,
      credentials,
    });
    assert.ok(remote);
    assert.equal(remote.vcard, ICLOUD_CARD, "the raw card comes back exactly as stored");
    assert.equal(remote.card.fullName, "Johnny Appleseed");

    const result = await carddav.pushCardDavContact({
      addressBookUrl: server.bookUrl,
      credentials,
      remoteUid: "icloud-uid-1",
      contact: renamedContact,
      capabilityProfile: icloudProfile,
      hrefOverride: href,
      remote: { vcard: remote.vcard, etag: remote.card.etag },
    });

    const [put] = server.puts();
    assert.equal(put!.headers["if-match"], '"etag-1"', "conditioned on the ETag Kontax read");
    assert.equal(result.etag, server.card(href)!.etag, "the new ETag is returned");
    assert.equal(put!.headers["if-none-match"], undefined);

    const stored = server.card(href)!.vcard;
    assert.equal(stored, result.vcard);
    const lines = vcardLines(stored);
    assert.ok(lines.includes("FN:Johnny B. Appleseed"));
    for (const preserved of PRESERVED_ICLOUD_LINES) {
      assert.ok(lines.includes(preserved), `preserved: ${preserved}`);
    }
    assert.equal(countProperty(stored, "X-ABDATE"), 1, "the anniversary survives exactly once");
    assert.ok(lines.some((line) => line.endsWith("X-ABDATE:2010-06-12")));
    assert.equal(countProperty(stored, "EMAIL"), 1, "Kontax-owned email replaced, not duplicated");
    assert.equal(countProperty(stored, "TEL"), 1);
    assert.equal(countProperty(stored, "NOTE"), 1);

    // Round trip: Kontax reads back what it wrote.
    const [reread] = await carddav.fetchCardDavAddressBookCardsWithRaw({ addressBookUrl: server.bookUrl, credentials });
    assert.equal(reread!.card.fullName, "Johnny B. Appleseed");
    assert.deepEqual(reread!.card.emailAddresses, ["johnny@example.com"]);
    assert.deepEqual(reread!.card.significantDates.map((d) => d.date), ["2010-06-12"]);
  });

  test("a card edited remotely after Kontax read it is not overwritten: 412 → CARDDAV_PUSH_PRECONDITION_FAILED", async () => {
    const href = server.seed("icloud-uid-1.vcf", ICLOUD_CARD);
    const [remote] = await carddav.fetchCardDavAddressBookCardsWithRaw({ addressBookUrl: server.bookUrl, credentials });
    const concurrent = ICLOUD_CARD.replace("TEL;type=CELL;type=VOICE;type=pref:+1 555 0100", "TEL;type=CELL:+1 555 0199");
    server.remoteEdit(href, concurrent);

    await assert.rejects(
      carddav.pushCardDavContact({
        addressBookUrl: server.bookUrl,
        credentials,
        remoteUid: "icloud-uid-1",
        contact: renamedContact,
        capabilityProfile: icloudProfile,
        hrefOverride: href,
        remote: { vcard: remote!.vcard, etag: remote!.card.etag },
      }),
      (error: unknown) =>
        error instanceof carddav.CardDavPreflightError &&
        error.code === carddav.CARDDAV_PUSH_PRECONDITION_FAILED,
    );
    assert.equal(server.card(href)!.vcard, concurrent, "the concurrent remote edit is intact");
  });

  test("a caller that passes no remote card gets it read first (GET) and still sends If-Match", async () => {
    const href = server.seed("icloud-uid-1.vcf", ICLOUD_CARD);
    await carddav.pushCardDavContact({
      addressBookUrl: server.bookUrl,
      credentials,
      remoteUid: "icloud-uid-1",
      contact: renamedContact,
      capabilityProfile: icloudProfile,
    });
    assert.deepEqual(
      server.requests.map((request) => request.method),
      ["GET", "PUT"],
    );
    assert.equal(server.puts()[0]!.headers["if-match"], '"etag-1"');
    const lines = vcardLines(server.card(href)!.vcard);
    for (const preserved of PRESERVED_ICLOUD_LINES) {
      assert.ok(lines.includes(preserved), `preserved: ${preserved}`);
    }
  });

  test("a create sends If-None-Match: * and never replaces a card already at that href", async () => {
    const created = await carddav.pushCardDavContact({
      addressBookUrl: server.bookUrl,
      credentials,
      remoteUid: "kontax-new-1",
      contact: { ...renamedContact, significantDates: [] },
      capabilityProfile: genericProfile,
      remote: null,
    });
    assert.equal(server.puts()[0]!.headers["if-none-match"], "*");
    assert.equal(server.puts()[0]!.headers["if-match"], undefined);
    assert.ok(server.card(created.href));

    const existing = server.card(created.href)!.vcard;
    await assert.rejects(
      carddav.pushCardDavContact({
        addressBookUrl: server.bookUrl,
        credentials,
        remoteUid: "kontax-new-1",
        contact: { ...renamedContact, fullName: "Someone Else" },
        capabilityProfile: genericProfile,
        remote: null,
      }),
      (error: unknown) =>
        error instanceof carddav.CardDavPreflightError &&
        error.code === carddav.CARDDAV_PUSH_PRECONDITION_FAILED,
    );
    assert.equal(server.card(created.href)!.vcard, existing);
  });

  test("a field push keeps the remote PHOTO; an explicit photo replaces it; null removes it", async () => {
    const href = server.seed("icloud-uid-1.vcf", ICLOUD_CARD.replace("UID:", "PHOTO;ENCODING=b;TYPE=JPEG:AAAA\r\nUID:"));
    const push = async (photoBase64?: string | null) => {
      const current = await carddav.fetchCardDavContact({ href, credentials });
      await carddav.pushCardDavContact({
        addressBookUrl: server.bookUrl,
        credentials,
        remoteUid: "icloud-uid-1",
        contact: renamedContact,
        capabilityProfile: icloudProfile,
        hrefOverride: href,
        photoBase64,
        remote: { vcard: current!.vcard, etag: current!.card.etag },
      });
      return server.card(href)!.vcard;
    };

    const kept = await push();
    assert.ok(vcardLines(kept).includes("PHOTO;ENCODING=b;TYPE=JPEG:AAAA"));
    const replaced = await push("QkJCQg==");
    assert.equal(countProperty(replaced, "PHOTO"), 1);
    assert.ok(vcardLines(replaced).includes("PHOTO;ENCODING=b;TYPE=JPEG:QkJCQg=="));
    const removed = await push(null);
    assert.equal(countProperty(removed, "PHOTO"), 0);
  });

  test("fetchCardDavContact returns null for a card that is gone", async () => {
    assert.equal(await carddav.fetchCardDavContact({ href: server.hrefFor("missing.vcf"), credentials }), null);
  });
});
