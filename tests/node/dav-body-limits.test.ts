import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  DAV_BODY_LIMITS,
  decodePathSegment,
  decodeXmlText,
  extractRequestedPropNames,
  hasDoctypeOrEntity,
  hrefToSyncUid,
  parseReportRequest,
} from "../../src/server/dav/parse.mjs";

// The implementation P48-08 replaced. Kept here as the equivalence oracle: the
// tokenizer must agree with it on every body a real client actually sends.
const legacyExtractRequestedPropNames = (body: string) => {
  if (!body.trim()) return null;

  const propMatch = body.match(/<[^>]*:?prop\b[^>]*>([\s\S]*?)<\/[^>]*:?prop>/i);
  const propBody = propMatch?.[1];

  if (!propBody) return null;

  const names = [...propBody.matchAll(/<\s*(?:[A-Za-z0-9_-]+:)?([A-Za-z0-9_-]+)\b[^>]*\/?>/g)]
    .map((match) => match[1])
    .filter(Boolean);

  return names.length > 0 ? [...new Set(names)] : null;
};

// --- real client bodies -----------------------------------------------------

const IOS_PRINCIPAL_PROPFIND = `<?xml version="1.0" encoding="UTF-8"?>
<A:propfind xmlns:A="DAV:">
  <A:prop>
    <A:current-user-principal/>
    <A:principal-URL/>
    <A:resourcetype/>
  </A:prop>
</A:propfind>`;

const MACOS_CONTACTS_PROPFIND = `<?xml version="1.0" encoding="UTF-8"?>
<A:propfind xmlns:A="DAV:" xmlns:B="http://calendarserver.org/ns/" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <A:prop>
    <A:displayname/>
    <A:resourcetype/>
    <B:getctag/>
    <C:addressbook-home-set/>
    <C:supported-address-data/>
    <A:current-user-privilege-set/>
  </A:prop>
</A:propfind>`;

const DAVX5_COLLECTION_PROPFIND = `<propfind xmlns="DAV:" xmlns:CARD="urn:ietf:params:xml:ns:carddav" xmlns:CS="http://calendarserver.org/ns/"><prop><resourcetype/><displayname/><CS:getctag/><sync-token/></prop></propfind>`;

const THUNDERBIRD_MULTIGET = `<?xml version="1.0" encoding="utf-8"?>
<card:addressbook-multiget xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag/>
    <card:address-data/>
  </d:prop>
  <d:href>/dav/addressbooks/usr_1/default/uid-a.vcf</d:href>
  <d:href>/dav/addressbooks/usr_1/default/uid-b.vcf</d:href>
  <d:href>/dav/addressbooks/usr_1/default/gone.vcf</d:href>
</card:addressbook-multiget>`;

const IOS_SYNC_COLLECTION = `<?xml version="1.0" encoding="UTF-8"?>
<A:sync-collection xmlns:A="DAV:">
  <A:sync-token>http://kontax.app/ns/sync/42</A:sync-token>
  <A:sync-level>1</A:sync-level>
  <A:prop>
    <A:getetag/>
  </A:prop>
</A:sync-collection>`;

const ALLPROP = `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:allprop/></d:propfind>`;

// --- extractRequestedPropNames ---------------------------------------------

test("tokenizer matches the legacy regex on real PROPFIND bodies", () => {
  for (const body of [
    IOS_PRINCIPAL_PROPFIND,
    MACOS_CONTACTS_PROPFIND,
    DAVX5_COLLECTION_PROPFIND,
    THUNDERBIRD_MULTIGET,
    IOS_SYNC_COLLECTION,
    ALLPROP,
    "",
    "   ",
  ]) {
    assert.deepEqual(
      extractRequestedPropNames(body),
      legacyExtractRequestedPropNames(body),
      `divergence on:\n${body}`,
    );
  }
});

test("prop names are namespace-prefix agnostic, ordered and de-duplicated", () => {
  assert.deepEqual(extractRequestedPropNames(IOS_PRINCIPAL_PROPFIND), [
    "current-user-principal",
    "principal-URL",
    "resourcetype",
  ]);

  assert.deepEqual(extractRequestedPropNames(DAVX5_COLLECTION_PROPFIND), [
    "resourcetype",
    "displayname",
    "getctag",
    "sync-token",
  ]);

  // Same local name under two different prefixes collapses to one entry.
  assert.deepEqual(
    extractRequestedPropNames(`<d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><A:getetag/></d:prop></d:propfind>`),
    ["getetag"],
  );
});

test("allprop / propname / empty bodies mean 'send everything'", () => {
  assert.equal(extractRequestedPropNames(ALLPROP), null);
  assert.equal(extractRequestedPropNames(`<d:propfind xmlns:d="DAV:"><d:propname/></d:propfind>`), null);
  assert.equal(extractRequestedPropNames(""), null);
  assert.equal(extractRequestedPropNames("   \n "), null);
  // A self-closing <prop/> has no children.
  assert.equal(extractRequestedPropNames(`<d:propfind xmlns:d="DAV:"><d:prop/></d:propfind>`), null);
});

test("comments, CDATA and processing instructions are skipped, not collected", () => {
  const body = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><!-- <d:injected/> --><d:getetag/><![CDATA[<d:alsoInjected/>]]></d:prop></d:propfind>`;
  assert.deepEqual(extractRequestedPropNames(body), ["getetag"]);
});

test("nested prop elements do not truncate the requested list", () => {
  // `<card:prop name="FN"/>` inside address-data: the outer <d:prop> owns the
  // list, and the inner element is just another (unsupported) child name.
  const body = `<card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav"><d:prop><d:getetag/><card:address-data><card:prop name="FN"/></card:address-data></d:prop></card:addressbook-query>`;
  assert.deepEqual(extractRequestedPropNames(body), ["getetag", "address-data", "prop"]);
});

// --- DOCTYPE / ENTITY reject ------------------------------------------------

test("DOCTYPE and ENTITY declarations are detected for a 400", () => {
  assert.equal(
    hasDoctypeOrEntity(
      `<?xml version="1.0"?><!DOCTYPE propfind [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>`,
    ),
    true,
  );
  assert.equal(hasDoctypeOrEntity(`<!doctype html>`), true, "case-insensitive");
  assert.equal(hasDoctypeOrEntity(`<!EnTiTy x "y">`), true);
  assert.equal(hasDoctypeOrEntity(MACOS_CONTACTS_PROPFIND), false);
  assert.equal(hasDoctypeOrEntity(""), false);
});

test("a DOCTYPE'd body is never entity-expanded even if parsed", () => {
  const body = `<!DOCTYPE d [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><d:propfind xmlns:d="DAV:"><d:prop><d:getetag>&xxe;</d:getetag></d:prop></d:propfind>`;
  assert.deepEqual(extractRequestedPropNames(body), ["getetag"]);
});

// --- the DoS that motivated P48-08 -----------------------------------------

test("a 300 KB pathological body parses in linear time (< 50 ms)", () => {
  // Repeated *unclosed* <d:prop> — the input that made the old regex quadratic
  // (measured 281 KB -> ~3.4 s on the regex, extrapolating to ~45 s at 1 MB).
  const unit = "<d:prop>";
  const body = `<d:propfind xmlns:d="DAV:">${unit.repeat(Math.ceil((300 * 1024) / unit.length))}`;

  assert.ok(body.length >= 300 * 1024, "fixture is at least 300 KB");

  const started = performance.now();
  const names = extractRequestedPropNames(body);
  const elapsed = performance.now() - started;

  assert.deepEqual(names, ["prop"], "every child of the first prop is another prop");
  assert.ok(elapsed < 50, `took ${elapsed.toFixed(1)} ms, expected < 50 ms`);
  console.log(`  pathological 300 KB body parsed in ${elapsed.toFixed(2)} ms`);
});

test("an unterminated tag terminates the scan instead of looping", () => {
  const started = performance.now();
  assert.equal(extractRequestedPropNames(`<d:propfind><d:prop${"x".repeat(200_000)}`), null);
  assert.ok(performance.now() - started < 50);
});

// --- body caps --------------------------------------------------------------

test("body caps are 64 KB for queries and 1 MB for PUT", () => {
  assert.equal(DAV_BODY_LIMITS.query, 64 * 1024);
  assert.equal(DAV_BODY_LIMITS.put, 1024 * 1024);
});

// --- REPORT parsing ---------------------------------------------------------

test("addressbook-multiget yields its hrefs and requested props", () => {
  const report = parseReportRequest(THUNDERBIRD_MULTIGET);

  assert.equal(report?.type, "addressbook-multiget");
  assert.deepEqual(report?.hrefs, [
    "/dav/addressbooks/usr_1/default/uid-a.vcf",
    "/dav/addressbooks/usr_1/default/uid-b.vcf",
    "/dav/addressbooks/usr_1/default/gone.vcf",
  ]);
  assert.deepEqual(report?.propNames, ["getetag", "address-data"]);
});

test("sync-collection is identified and carries no hrefs", () => {
  const report = parseReportRequest(IOS_SYNC_COLLECTION);

  assert.equal(report?.type, "sync-collection");
  assert.deepEqual(report?.hrefs, []);
  assert.deepEqual(report?.propNames, ["getetag"]);
});

test("hrefs inside the prop element are not treated as requested resources", () => {
  const body = `<card:addressbook-multiget xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav"><d:prop><d:href/><d:getetag/></d:prop><d:href>/dav/addressbooks/u/default/x.vcf</d:href></card:addressbook-multiget>`;
  assert.deepEqual(parseReportRequest(body)?.hrefs, ["/dav/addressbooks/u/default/x.vcf"]);
});

test("href text is entity-decoded", () => {
  const body = `<card:addressbook-multiget xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav"><d:href>/dav/addressbooks/u/default/a&amp;b.vcf</d:href></card:addressbook-multiget>`;
  assert.deepEqual(parseReportRequest(body)?.hrefs, ["/dav/addressbooks/u/default/a&b.vcf"]);
  assert.equal(decodeXmlText("a&lt;b&gt;c&quot;d&apos;e&#65;&#x42;"), 'a<b>c"d\'eAB');
});

test("parseReportRequest ignores empty bodies", () => {
  assert.equal(parseReportRequest(""), null);
  assert.equal(parseReportRequest("  \n"), null);
});

// --- href -> sync UID -------------------------------------------------------

test("hrefToSyncUid takes the last segment, strips .vcf and percent-decodes", () => {
  assert.equal(hrefToSyncUid("/dav/addressbooks/u/default/uid-a.vcf"), "uid-a");
  assert.equal(hrefToSyncUid("https://kontax.app/dav/addressbooks/u/default/uid-a.VCF"), "uid-a");
  assert.equal(hrefToSyncUid("/dav/addressbooks/u/default/a%20b.vcf"), "a b");
  assert.equal(hrefToSyncUid("/dav/addressbooks/u/default/x.vcf?v=1"), "x");
  assert.equal(hrefToSyncUid(""), null);
  assert.equal(hrefToSyncUid("/dav/addressbooks/u/default/"), null);
  // Malformed percent-escape: must not throw.
  assert.equal(hrefToSyncUid("/dav/addressbooks/u/default/%E0.vcf"), null);
});

test("decodePathSegment rejects malformed escapes and NUL bytes", () => {
  assert.equal(decodePathSegment("plain-uid"), "plain-uid");
  assert.equal(decodePathSegment("a%20b"), "a b");
  assert.equal(decodePathSegment("%E0"), null, "malformed percent-escape");
  assert.equal(decodePathSegment("%"), null);
  assert.equal(decodePathSegment("a%00b"), null, "NUL byte");
});
