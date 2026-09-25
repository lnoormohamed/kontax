import test from "node:test";
import assert from "node:assert/strict";

import {
  DAV_CORE_FIELDS,
  DAV_EXTENDED_FIELDS,
  DAV_OWNED_FIELDS,
  buildDavContactWriteData,
  parseVCardToContactFields,
  serializeContactToVCard,
  splitVCardComponents,
  unescapeVCardValue,
} from "../../src/server/dav/vcard.mjs";

// P49A-02: the vCard mapping behind Kontax's own CardDAV server (server.mjs).

const crlf = (lines: string[]) => lines.join("\r\n");

// Shaped on what iOS 17 Contacts PUTs: grouped ADR/URL/TEL, Apple labels,
// X-APPLE-OMIT-YEAR birthday, escaped commas and newlines.
const IOS_CARD = crlf([
  "BEGIN:VCARD",
  "VERSION:3.0",
  "PRODID:-//Apple Inc.//iPhone OS 17.5//EN",
  "N:Appleseed;Jane;Q.;Dr.;PhD",
  "FN:Dr. Jane Q. Appleseed PhD",
  "ORG:Acme\\, Inc.;Research",
  "TITLE:Chief Scientist",
  "item1.EMAIL;type=INTERNET;type=HOME;type=pref:jane@example.com",
  "item2.EMAIL;type=INTERNET:jane@work.example",
  "item2.X-ABLabel:_$!<Other>!$_",
  "TEL;type=CELL;type=VOICE;type=pref:+1 (555) 010-0100",
  "item3.TEL:+1 555 010 0199",
  "item3.X-ABLabel:Gym",
  "TEL;type=IPHONE;type=CELL;type=VOICE:+1 555 010 0111",
  "item4.ADR;type=HOME;type=pref:;;1 Infinite Loop\\nSuite 5;Cupertino;CA;95014;United States",
  "item4.X-ABADR:us",
  "item5.URL;type=pref:https://jane.example",
  "item5.X-ABLabel:_$!<HomePage>!$_",
  "BDAY;X-APPLE-OMIT-YEAR=1604:1604-03-14",
  "NOTE:Line one\\nLine two",
  "UID:ios-uid-1",
  "END:VCARD",
]);

// macOS Contacts: same dialect, work-first, a custom-labelled phone that
// shares its group number with nothing else, company card.
const MACOS_CARD = crlf([
  "BEGIN:VCARD",
  "VERSION:3.0",
  "PRODID:-//Apple Inc.//Mac OS X 14.5//EN",
  "N:Doe;John;;;",
  "FN:John Doe",
  "ORG:Example Corp;",
  "EMAIL;type=INTERNET;type=WORK;type=pref:john@corp.example",
  "TEL;type=WORK;type=VOICE;type=pref:+44 20 7946 0000",
  "item1.TEL;type=VOICE:+44 7700 900123",
  "item1.X-ABLabel:Boat phone",
  "item2.ADR;type=WORK;type=pref:;;10 Downing St;London;;SW1A 2AA;United Kingdom",
  "item2.X-ABADR:gb",
  "item3.URL;type=pref:https://corp.example",
  "item3.X-ABLabel:_$!<HomePage>!$_",
  "X-ABShowAs:COMPANY",
  "BDAY:1980-07-01",
  "UID:mac-uid-1",
  "END:VCARD",
]);

// DAVx⁵ (ez-vcard): lower-case TYPE values, `davdroidN.` groups for custom
// labels, vCard 4-style year-less birthday, folded long line.
const DAVX5_CARD = crlf([
  "BEGIN:VCARD",
  "VERSION:3.0",
  "UID:davx5-uid-1",
  "PRODID:ez-vcard 0.11.3",
  "FN:María García",
  "N:García;María;;;",
  "TEL;TYPE=cell:+34 600 000 000",
  "davdroid1.TEL:+34 911 000 000",
  "davdroid1.X-ABLabel:Casa de verano",
  "EMAIL;TYPE=home:maria@example.es",
  "ADR;TYPE=home:;;Calle Mayor 1;Madrid;;28013;España",
  "URL:https://maria.example.es",
  "BDAY:--0314",
  "NOTE:A note long enough that DAVx⁵ folds it across two physical lines of ",
  " the vCard body.",
  "REV:20260925T120000Z",
  "END:VCARD",
]);

test("iOS card: grouped EMAIL/TEL/ADR/URL, Apple labels, OMIT-YEAR birthday", () => {
  const fields = parseVCardToContactFields(IOS_CARD);

  assert.equal(fields.fullName, "Dr. Jane Q. Appleseed PhD");
  assert.equal(fields.lastName, "Appleseed");
  assert.equal(fields.firstName, "Jane");
  assert.equal(fields.middleName, "Q.");
  assert.equal(fields.namePrefix, "Dr.");
  assert.equal(fields.nameSuffix, "PhD");
  assert.equal(fields.company, "Acme, Inc.");
  assert.equal(fields.department, "Research");
  assert.equal(fields.jobTitle, "Chief Scientist");

  assert.deepEqual(fields.emailEntries, [
    { label: "Home", value: "jane@example.com", isPrimary: true },
    { label: "Other", value: "jane@work.example", isPrimary: false },
  ]);
  assert.equal(fields.email, "jane@example.com");
  assert.deepEqual(fields.emailAddresses, ["jane@example.com", "jane@work.example"]);

  assert.deepEqual(fields.phoneEntries, [
    { label: "Mobile", value: "+1 (555) 010-0100", isPrimary: true },
    { label: "Gym", value: "+1 555 010 0199", isPrimary: false },
    { label: "iPhone", value: "+1 555 010 0111", isPrimary: false },
  ]);
  assert.equal(fields.phone, "+1 (555) 010-0100");
  assert.deepEqual(fields.phoneNumbers, ["+1 (555) 010-0100", "+1 555 010 0199", "+1 555 010 0111"]);

  assert.deepEqual(fields.addressEntries, [
    {
      label: "Home",
      formatted: "1 Infinite Loop\nSuite 5, Cupertino, CA, 95014, United States",
      isPrimary: true,
      streetLine1: "1 Infinite Loop\nSuite 5",
      cityOrTown: "Cupertino",
      stateOrProvince: "CA",
      postcode: "95014",
      countryOrRegion: "United States",
    },
  ]);
  assert.equal(fields.address, "1 Infinite Loop\nSuite 5, Cupertino, CA, 95014, United States");
  assert.deepEqual(fields.postalAddresses, [
    { label: "Home", formatted: "1 Infinite Loop\nSuite 5, Cupertino, CA, 95014, United States" },
  ]);

  assert.deepEqual(fields.websiteEntries, [
    { label: "Homepage", value: "https://jane.example", isPrimary: true },
  ]);
  assert.equal(fields.website, "https://jane.example");

  assert.equal(fields.birthday, "--03-14");
  assert.equal(fields.notes, "Line one\nLine two");
});

test("macOS card: custom-labelled phone, work address, dated birthday", () => {
  const fields = parseVCardToContactFields(MACOS_CARD);

  assert.equal(fields.company, "Example Corp");
  assert.equal(fields.department, null);
  assert.deepEqual(fields.emailEntries, [
    { label: "Work", value: "john@corp.example", isPrimary: true },
  ]);
  assert.deepEqual(fields.phoneEntries, [
    { label: "Work", value: "+44 20 7946 0000", isPrimary: true },
    { label: "Boat phone", value: "+44 7700 900123", isPrimary: false },
  ]);
  assert.equal(fields.addressEntries[0]?.label, "Work");
  assert.equal(fields.address, "10 Downing St, London, SW1A 2AA, United Kingdom");
  assert.equal(fields.website, "https://corp.example");
  assert.equal(fields.birthday, "1980-07-01");
});

test("DAVx⁵ card: lower-case TYPE, davdroid groups, --MMDD birthday, folded note", () => {
  const fields = parseVCardToContactFields(DAVX5_CARD);

  assert.equal(fields.fullName, "María García");
  assert.deepEqual(fields.phoneEntries, [
    { label: "Mobile", value: "+34 600 000 000", isPrimary: true },
    { label: "Casa de verano", value: "+34 911 000 000", isPrimary: false },
  ]);
  assert.deepEqual(fields.emailEntries, [
    { label: "Home", value: "maria@example.es", isPrimary: true },
  ]);
  assert.equal(fields.address, "Calle Mayor 1, Madrid, 28013, España");
  assert.deepEqual(fields.websiteEntries, [
    { label: "Other", value: "https://maria.example.es", isPrimary: true },
  ]);
  assert.equal(fields.birthday, "--03-14");
  assert.equal(
    fields.notes,
    "A note long enough that DAVx⁵ folds it across two physical lines of the vCard body.",
  );
});

test("year-less birthday forms all store as --MM-DD", () => {
  const birthdayOf = (line: string) =>
    parseVCardToContactFields(crlf(["BEGIN:VCARD", "VERSION:3.0", "FN:X", line, "END:VCARD"])).birthday;

  assert.equal(birthdayOf("BDAY;X-APPLE-OMIT-YEAR=1604:1604-03-14"), "--03-14");
  assert.equal(birthdayOf("BDAY;X-APPLE-OMIT-YEAR=1604;VALUE=date:1604-03-14"), "--03-14");
  assert.equal(birthdayOf("BDAY:--03-14"), "--03-14");
  assert.equal(birthdayOf("BDAY:--0314"), "--03-14");
  assert.equal(birthdayOf("BDAY:19900314"), "1990-03-14");
  assert.equal(birthdayOf("BDAY;VALUE=date:1990-03-14"), "1990-03-14");
  // OMIT-YEAR only applies when it names the year actually written.
  assert.equal(birthdayOf("BDAY;X-APPLE-OMIT-YEAR=1604:1990-03-14"), "1990-03-14");
});

test("year-less birthday serializes in Apple's form and round-trips", () => {
  const vcard = serializeContactToVCard({
    syncUid: "uid-bday",
    fullName: "No Year",
    birthday: "--03-14",
  });

  assert.match(vcard, /\r\nBDAY;X-APPLE-OMIT-YEAR=1604:1604-03-14\r\n/);
  assert.equal(parseVCardToContactFields(vcard).birthday, "--03-14");

  const dated = serializeContactToVCard({ syncUid: "u", fullName: "Y", birthday: "1990-03-14" });
  assert.match(dated, /\r\nBDAY:1990-03-14\r\n/);
});

test("unescape handles \\\\ last and structured values are unescaped once", () => {
  // `\\n` is an escaped backslash followed by `n` — not a newline.
  assert.equal(unescapeVCardValue("a\\\\nb"), "a\\nb");
  assert.equal(unescapeVCardValue("a\\nb\\,c\\;d\\\\e"), "a\nb,c;d\\e");

  // Split on unescaped `;` only; components come back still escaped.
  assert.deepEqual(splitVCardComponents("a\\;b;c\\\\;d"), ["a\\;b", "c\\\\", "d"]);

  const fields = parseVCardToContactFields(
    crlf([
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Escapes",
      "N:Smith\\\\nJones;Ann\\;Marie;;;",
      "ORG:Back\\\\slash\\;Co;R\\,D",
      "ADR:;;1 Road\\, Flat 2;Town\\\\ship;;;",
      "END:VCARD",
    ]),
  );

  assert.equal(fields.lastName, "Smith\\nJones");
  assert.equal(fields.firstName, "Ann;Marie");
  assert.equal(fields.company, "Back\\slash;Co");
  assert.equal(fields.department, "R,D");
  assert.equal(fields.addressEntries[0]?.streetLine1, "1 Road, Flat 2");
  assert.equal(fields.addressEntries[0]?.cityOrTown, "Town\\ship");
});

test("a stored contact round-trips through serialize → parse", () => {
  const stored = {
    syncUid: "uid-round-trip",
    fullName: "Ana Lima",
    firstName: "Ana",
    lastName: "Lima",
    nickname: "Aninha",
    phoneticFirstName: "AH-na",
    company: "Lima; Filhos",
    department: "Ops",
    jobTitle: "Director",
    notes: "Likes \\ backslashes, commas; and\nnewlines",
    birthday: "--12-25",
    emailEntries: [
      { label: "Work", value: "ana@lima.example", isPrimary: true },
      { label: "Personal", value: "ana@home.example", isPrimary: false },
    ],
    phoneEntries: [
      { label: "Mobile", value: "+55 11 90000-0000", isPrimary: true },
      { label: "Studio", value: "+55 11 3000-0000", isPrimary: false },
      { label: "Work fax", value: "+55 11 3000-0001", isPrimary: false },
    ],
    websiteEntries: [
      { label: "Portfolio", value: "https://ana.example", isPrimary: true },
      { label: "Homepage", value: "https://lima.example", isPrimary: false },
    ],
    addressEntries: [
      {
        label: "Home",
        formatted: "Rua A 1, São Paulo, SP, 01000-000, Brasil",
        isPrimary: true,
        streetLine1: "Rua A 1",
        cityOrTown: "São Paulo",
        stateOrProvince: "SP",
        postcode: "01000-000",
        countryOrRegion: "Brasil",
      },
      {
        label: "Beach house",
        formatted: "Av. Praia 9, Ubatuba",
        isPrimary: false,
        streetLine1: "Av. Praia 9",
        cityOrTown: "Ubatuba",
      },
    ],
  };

  const vcard = serializeContactToVCard(stored);
  assert.match(vcard, /\r\nitem\d+\.TEL(;TYPE=[A-Z]+)*:\+55 11 3000-0000\r\nitem\d+\.X-ABLabel:Studio\r\n/);

  const fields = parseVCardToContactFields(vcard);
  assert.equal(fields.fullName, "Ana Lima");
  assert.equal(fields.nickname, "Aninha");
  assert.equal(fields.phoneticFirstName, "AH-na");
  assert.equal(fields.company, "Lima; Filhos");
  assert.equal(fields.department, "Ops");
  assert.equal(fields.notes, stored.notes);
  assert.equal(fields.birthday, "--12-25");
  assert.deepEqual(fields.emailEntries, stored.emailEntries);
  assert.deepEqual(fields.phoneEntries, stored.phoneEntries);
  assert.deepEqual(fields.websiteEntries, stored.websiteEntries);
  assert.deepEqual(fields.addressEntries, stored.addressEntries);
});

test("legacy contacts with only scalar/array columns still serialize every value", () => {
  const vcard = serializeContactToVCard({
    syncUid: "uid-legacy",
    fullName: "Legacy",
    email: "a@example.com",
    emailAddresses: ["a@example.com", "b@example.com"],
    phone: "+1 555 0100",
    phoneNumbers: ["+1 555 0101"],
    website: "https://legacy.example",
    address: "1 Main St, Springfield",
    postalAddresses: [{ label: "work", formatted: "2 Side St, Shelbyville" }],
  });
  const fields = parseVCardToContactFields(vcard);

  assert.deepEqual(fields.emailAddresses, ["a@example.com", "b@example.com"]);
  assert.deepEqual(fields.phoneNumbers, ["+1 555 0100", "+1 555 0101"]);
  assert.equal(fields.website, "https://legacy.example");
  assert.deepEqual(
    fields.postalAddresses.map((entry) => entry.formatted),
    ["1 Main St, Springfield", "2 Side St, Shelbyville"],
  );
  assert.equal(fields.postalAddresses[1]?.label, "Work");

  // Web-editor address entry shape (street/city/state/country) is understood too.
  const webEditor = parseVCardToContactFields(
    serializeContactToVCard({
      syncUid: "uid-web",
      fullName: "Web",
      addressEntries: [
        { label: "Work", street: "5 Market St", city: "Leeds", state: "", postcode: "LS1", country: "UK", formatted: "x" },
      ],
    }),
  );
  assert.equal(webEditor.address, "5 Market St, Leeds, LS1, UK");
});

test("PUT write data: removing a property clears it; unowned columns are untouched", () => {
  const DB_NULL = Symbol("DbNull");
  const withoutEmailOrAddress = IOS_CARD.split("\r\n")
    .filter((line) => !/^item[12]\.(EMAIL|X-ABLabel)/.test(line) && !line.startsWith("item4."))
    .filter((line) => !line.startsWith("BDAY") && !line.startsWith("NOTE") && !line.startsWith("ORG"))
    .join("\r\n");

  const data = buildDavContactWriteData(withoutEmailOrAddress, { jsonNull: DB_NULL });

  // Every core column is present, so the update overwrites it.
  for (const key of DAV_CORE_FIELDS) {
    assert.ok(key in data, `missing core field ${key}`);
  }

  assert.equal(data.email, null);
  assert.equal(data.emailAddresses, DB_NULL);
  assert.equal(data.emailEntries, DB_NULL);
  assert.equal(data.address, null);
  assert.equal(data.postalAddresses, DB_NULL);
  assert.equal(data.addressEntries, DB_NULL);
  assert.equal(data.birthday, null);
  assert.equal(data.notes, null);
  assert.equal(data.company, null);
  // Department is extended: with no ORG line at all it is left untouched.
  assert.ok(!("department" in data));

  // Still-present values are written in both shapes.
  assert.equal(data.phone, "+1 (555) 010-0100");
  assert.deepEqual(data.phoneNumbers, ["+1 (555) 010-0100", "+1 555 010 0199", "+1 555 010 0111"]);
  assert.equal((data.phoneEntries as unknown[]).length, 3);

  // Columns the DAV mapping does not own are never part of the write.
  for (const key of ["labels", "significantDates", "relatedPeople", "customFields", "isFavorite", "phoneticCompany", "avatarUrl"]) {
    assert.ok(!(key in data), `unowned field ${key} must not be written`);
  }
});

test("PUT write data: a Thunderbird-style minimal card keeps nickname, phonetics and department", () => {
  // Thunderbird / many Android apps don't model NICKNAME, X-PHONETIC-* or the
  // ORG department — they send back only what they understand.
  const thunderbird = crlf([
    "BEGIN:VCARD",
    "VERSION:4.0",
    "PRODID:-//Thunderbird//EN",
    "UID:tb-uid-1",
    "FN:Jane Appleseed",
    "N:Appleseed;Jane;;;",
    "EMAIL;PREF=1:jane@example.com",
    "TEL;TYPE=cell:+1 555 010 0100",
    "ORG:Acme",
    "TITLE:Chief Scientist",
    "END:VCARD",
  ]);

  const data = buildDavContactWriteData(thunderbird);
  for (const key of DAV_EXTENDED_FIELDS) {
    assert.ok(!(key in data), `extended field ${key} must be left untouched`);
  }
  assert.equal(data.company, "Acme");
  assert.equal(data.jobTitle, "Chief Scientist");
  // Core fields the card omits are still cleared.
  assert.equal(data.notes, null);
  assert.equal(data.birthday, null);
  assert.equal(data.addressEntries, null);

  // A client that does model them sends the deletion explicitly.
  const apple = buildDavContactWriteData(
    crlf(["BEGIN:VCARD", "VERSION:3.0", "FN:J", "NICKNAME:", "ORG:Acme;", "X-PHONETIC-FIRST-NAME:JAY-n", "END:VCARD"]),
  );
  assert.equal(apple.nickname, null);
  assert.equal(apple.department, null);
  assert.equal(apple.phoneticFirstName, "JAY-n");
  assert.ok(!("phoneticLastName" in apple));
  assert.deepEqual([...DAV_OWNED_FIELDS].sort(), [...DAV_CORE_FIELDS, ...DAV_EXTENDED_FIELDS].sort());
});

test("PUT write data: iPhone email deletion still clears it; phone metadata survives the round-trip", () => {
  const existing = {
    email: "jane@example.com",
    emailEntries: [
      { label: "Home", value: "jane@example.com", isPrimary: true },
      { label: "Work", value: "jane@work.example", isPrimary: false },
    ],
    phoneEntries: [
      {
        label: "Mobile",
        value: "+1 (555) 010-0100",
        isPrimary: true,
        e164: "+15550100100",
        validationStatus: "valid",
        source: "user",
      },
      { label: "Gym", value: "+1 555 010 0199", isPrimary: false, e164: "+15550100199" },
    ],
  };
  const iphone = crlf([
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Jane",
    "item1.EMAIL;type=INTERNET;type=HOME;type=pref:jane@example.com",
    // The Work email was deleted on the phone; the Mobile phone relabelled.
    "TEL;type=WORK;type=VOICE;type=pref:+1 (555) 010-0100",
    "TEL;type=CELL:+1 555 010 0222",
    "UID:ios-uid-1",
    "END:VCARD",
  ]);

  const data = buildDavContactWriteData(iphone, { existing });

  assert.deepEqual(data.emailEntries, [{ label: "Home", value: "jane@example.com", isPrimary: true }]);
  assert.deepEqual(data.emailAddresses, ["jane@example.com"]);
  assert.deepEqual(data.phoneEntries, [
    {
      label: "Work",
      value: "+1 (555) 010-0100",
      isPrimary: true,
      e164: "+15550100100",
      validationStatus: "valid",
      source: "user",
    },
    // New number: no stored metadata to carry. Removed Gym number: gone.
    { label: "Mobile", value: "+1 555 010 0222", isPrimary: false },
  ]);
});

test("one value under two labels stays two entries through serialize and parse", () => {
  const stored = {
    syncUid: "uid-shared-line",
    fullName: "Shared",
    phoneEntries: [
      { label: "Home", value: "+44 20 7946 0000", isPrimary: true, e164: "+442079460000" },
      { label: "Work", value: "+44 20 7946 0000", isPrimary: false, e164: "+442079460000" },
    ],
  };
  const vcard = serializeContactToVCard(stored);
  assert.equal(vcard.match(/\r\nTEL/g)?.length, 2);

  const fields = parseVCardToContactFields(vcard);
  assert.deepEqual(
    fields.phoneEntries.map((entry) => entry.label),
    ["Home", "Work"],
  );
  assert.deepEqual(fields.phoneNumbers, ["+44 20 7946 0000"]);

  const data = buildDavContactWriteData(vcard, { existing: stored });
  assert.deepEqual(data.phoneEntries, stored.phoneEntries);

  // An exact value + label repeat is still a duplicate.
  const dup = parseVCardToContactFields(
    crlf(["BEGIN:VCARD", "VERSION:3.0", "FN:D", "TEL;TYPE=HOME:1", "TEL;TYPE=HOME:1", "END:VCARD"]),
  );
  assert.equal(dup.phoneEntries.length, 1);
});

test("PUT write data: display name derived when FN is missing; URI photo handling kept", () => {
  const data = buildDavContactWriteData(
    crlf(["BEGIN:VCARD", "VERSION:3.0", "N:Doe;Jane;;;", "PHOTO;VALUE=URI:https://img.example/a.jpg", "END:VCARD"]),
  );
  assert.equal(data.fullName, "Jane Doe");
  assert.equal(data.avatarUrl, "https://img.example/a.jpg");
  // Default jsonNull is plain null.
  assert.equal(data.emailEntries, null);

  const unsafe = buildDavContactWriteData(
    crlf(["BEGIN:VCARD", "VERSION:3.0", "ORG:Acme", "PHOTO;VALUE=uri:file:///etc/passwd", "END:VCARD"]),
  );
  assert.equal(unsafe.fullName, "Acme");
  assert.equal(unsafe.avatarUrl, null);
});

test("long lines fold at 75 octets without splitting UTF-8 and unfold back", () => {
  const notes = "é".repeat(120);
  const vcard = serializeContactToVCard({ syncUid: "u", fullName: "Fold", notes });
  for (const line of vcard.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `line over 75 octets: ${line}`);
  }
  assert.equal(parseVCardToContactFields(vcard).notes, notes);
});
