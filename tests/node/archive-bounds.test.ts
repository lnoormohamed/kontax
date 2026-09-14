import assert from "node:assert/strict";
import { test } from "node:test";
import AdmZip from "adm-zip";

import {
  parseKontaxArchive,
  recognizeKontaxFile,
  ZipBoundsError,
} from "../../src/server/export-format/parse";

// P48-11 item 2: unbounded zip decompression. adm-zip's `entry.getData()`
// inflates whatever uncompressed size the *central directory* declares, with
// no cap of its own (advisory GHSA-xcpc-8h2w-3j85) — a zip that is tiny on
// disk but declares a multi-GB entry OOMs the process the moment anything
// reads it. These tests build a real (small) zip with adm-zip and then
// binary-patch its central-directory record to declare a huge uncompressed
// size, exactly like a hand-crafted malicious archive — and assert the
// bounds check rejects it by reading the declared size alone, without ever
// calling getData() (so there's nothing to allocate).

const CENSIG = Buffer.from([0x50, 0x4b, 0x01, 0x02]); // "PK\x01\x02"
const CENLEN_OFFSET = 24; // offset of the uncompressed-size field within a CEN record

/**
 * Build a zip containing the given entries, then overwrite every central
 * directory record's declared uncompressed size with `declaredSize` — the
 * actual bytes on disk are unchanged (tiny), only what the header *claims*.
 */
function buildZipWithDeclaredSize(
  entries: Array<{ name: string; content: Buffer }>,
  declaredSize: number,
): Buffer {
  const zip = new AdmZip();
  for (const entry of entries) {
    zip.addFile(entry.name, entry.content);
  }
  const buffer = zip.toBuffer();

  let patched = 0;
  let offset = buffer.indexOf(CENSIG);
  while (offset !== -1) {
    buffer.writeUInt32LE(declaredSize >>> 0, offset + CENLEN_OFFSET);
    patched += 1;
    offset = buffer.indexOf(CENSIG, offset + 1);
  }
  assert.equal(patched, entries.length, "test setup: expected to patch one CEN record per entry");
  return buffer;
}

test("parseKontaxArchive rejects a single entry whose declared uncompressed size exceeds the per-entry cap", () => {
  const buffer = buildZipWithDeclaredSize(
    [{ name: "contacts/0001.json", content: Buffer.from('{"@type":"Card"}') }],
    4_000_000_000, // ~4 GB declared; real bytes on disk are a few dozen.
  );
  assert.throws(() => parseKontaxArchive(buffer), ZipBoundsError);
});

test("parseKontaxArchive rejects when declared sizes sum past the aggregate cap even if each entry is individually small", () => {
  // 11 entries × 19 MB declared = 209 MB, each under the 20 MB per-entry cap
  // but over the 200 MB total cap — exercises the running-total check
  // specifically, not just the per-entry one.
  const entries = Array.from({ length: 11 }, (_, i) => ({
    name: `contacts/${String(i).padStart(4, "0")}.json`,
    content: Buffer.from('{"@type":"Card"}'),
  }));
  const buffer = buildZipWithDeclaredSize(entries, 19 * 1024 * 1024);
  assert.throws(() => parseKontaxArchive(buffer), ZipBoundsError);
});

test("recognizeKontaxFile treats an over-bounds archive as unrecognized rather than throwing or reading it", () => {
  const manifest = JSON.stringify({
    "@type": "Archive",
    "getkontax.com:formatVersion": "1.0",
    counts: { contacts: 1, photos: 0 },
  });
  const buffer = buildZipWithDeclaredSize(
    [{ name: "manifest.json", content: Buffer.from(manifest) }],
    4_000_000_000,
  );
  // Must not throw — recognizeKontaxFile's contract is "never throws" so
  // every caller can branch on `.kind` — and must not hang/allocate trying
  // to read the (fake) 4 GB manifest.
  const recognition = recognizeKontaxFile(buffer);
  assert.equal(recognition.kind, "unrecognized");
});

test("a legitimate small archive whose declared sizes match reality still parses fine", () => {
  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify({ "getkontax.com:formatVersion": "1.0" })));
  zip.addFile("contacts/0001.json", Buffer.from('{"@type":"Card"}'));
  const buffer = zip.toBuffer();

  // Bounds check should be a no-op for an honestly-sized archive.
  assert.doesNotThrow(() => parseKontaxArchive(buffer));
  const recognition = recognizeKontaxFile(buffer);
  assert.equal(recognition.kind, "archive");
});
