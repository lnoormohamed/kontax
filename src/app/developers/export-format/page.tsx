// P50A-07 · Export format reference, split out of /developers so it can be
// linked to and indexed on its own (roadmap/build-phase/p50a-07-use-case-and-trust-pages.md).
// Content moved verbatim from src/app/developers/page.tsx (the pre-split
// "Export format" section) — see that page for the REST API reference and a
// short teaser back to this one.
import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { FORMAT_VERSION } from "~/server/export-format/constants";
import { SITE_URL } from "~/lib/site-url";

import { Code, CodeBlock, DocHead, DocPageShell, FORMAT_REPO_URL, H3, P, Section, Table } from "../_doc-ui";

// Outside the (marketing) group, so the root "%s · Kontax" template applies:
// the rendered title is "Export format reference · Kontax".
const TITLE = "Export format reference";
const DESCRIPTION =
  "The open Kontax Contact Export Format: document and archive structure, versioning, the vCard mapping, and the schemas and reference validator.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: "/developers/export-format" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/developers/export-format", siteName: "Kontax", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const webPageSchema = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: TITLE,
  description: DESCRIPTION,
  url: `${SITE_URL}/developers/export-format`,
});

const TOC_ITEMS = [
  { href: "#export-format", label: "Overview" },
  { href: "#format-document", label: "Document" },
  { href: "#format-archive", label: "Archive" },
  { href: "#format-versioning", label: "Versioning" },
  { href: "#format-vcard", label: "vCard mapping" },
  { href: "#format-validate", label: "Schemas & validator" },
];

export default function ExportFormatPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Developer docs", path: "/developers" },
            { name: "Export format", path: "/developers/export-format" },
          ]),
          webPageSchema(),
        ]}
      />
      <DocPageShell tocItems={TOC_ITEMS}>
        <DocHead
          title="Export format reference"
          lede={
            <>
              The complete reference for the Kontax Contact Export Format — the open format behind
              every export from Settings. Part of the{" "}
              <Link href="/developers">developer documentation</Link>.
            </>
          }
        />

        <Section id="export-format" title={`Export format (v${FORMAT_VERSION})`}>
          <P>
            Kontax exports contacts in an <strong>open, documented format</strong> so your data is
            never locked in. One JSON document describes one contact; an archive is packaging
            around many of them plus their photos. The format is{" "}
            <a href={FORMAT_REPO_URL} target="_blank" rel="noreferrer">
              developed in the open
            </a>{" "}
            — this page is the reference; the canonical spec, JSON Schemas, and a reference
            validator live in that repository (also mirrored under{" "}
            <a href="/format/spec.md">/format</a> on this site).
          </P>
          <P>
            The base standard is{" "}
            <a href="https://www.rfc-editor.org/rfc/rfc9553" target="_blank" rel="noreferrer">
              JSContact (RFC 9553)
            </a>
            : an exported contact is a JSContact <Code>Card</Code>. Everything Kontax-specific lives
            under the <Code>getkontax.com:</Code> vendor namespace, so a generic JSContact reader
            that ignores unknown properties still recovers a usable, mostly-complete contact. There
            is no proprietary file type — documents are plain <Code>.json</Code>, archives plain{" "}
            <Code>.zip</Code>; recognition is by content (the{" "}
            <Code>getkontax.com:formatVersion</Code> property and <Code>manifest.json</Code>), never
            the file extension.
          </P>
          <Table
            headers={["Serialization", "File", "Contains"]}
            rows={[
              ["Document", <Code key="d">contact.json</Code>, "One Card. Photo inlined as a data: URI."],
              ["Archive", <Code key="a">contacts.zip</Code>, "manifest.json + contacts/ + content-addressed media/ + optional vcards/ fallback."],
            ]}
          />
        </Section>

        {/* Document */}
        <section id="format-document" className="dev-endpoint">
          <H3>Document structure</H3>
          <P>
            A bare document is a single JSContact Card with two Kontax envelope properties. Native
            JSContact properties (<Code>name</Code>, <Code>emails</Code>, <Code>phones</Code>,{" "}
            <Code>addresses</Code>, <Code>anniversaries</Code>, …) carry the bulk of the data;
            vendor properties add what JSContact has no slot for. In a bare document the photo is an
            inline <Code>data:</Code> URI; in an archive it is a relative reference into{" "}
            <Code>media/</Code>.
          </P>
          <CodeBlock lang="json">{`{
  "@type": "Card",
  "version": "1.0",                         // JSContact spec version
  "uid": "3b1e4c7a-2f90-4d81-9c2a-7e5b6d4f0a11",
  "created": "2024-02-11T08:30:00Z",
  "updated": "2026-05-19T14:02:00Z",
  "getkontax.com:formatVersion": "${FORMAT_VERSION}",     // Kontax extension-set version
  "getkontax.com:exportedAt": "2026-07-04T14:30:00Z",

  "name": {
    "full": "Daniel Cho",
    "components": [
      { "kind": "given", "value": "Daniel" },
      { "kind": "surname", "value": "Cho" }
    ]
  },
  "emails": {
    "e1": { "address": "daniel@northwind.example", "contexts": { "work": true }, "pref": 1 }
  },
  "phones": {
    "p1": { "number": "+1 (415) 555-0132", "features": { "mobile": true }, "pref": 1 }
  },
  "anniversaries": {
    "d1": { "kind": "birth", "date": { "@type": "PartialDate", "year": 1990, "month": 9, "day": 4 } }
  },

  "keywords": { "Clients": true },
  "getkontax.com:labels": { "l1": { "name": "Clients", "color": "#4158f4" } },
  "getkontax.com:customFields": [ { "label": "Client ID", "value": "NW-0042" } ],
  "getkontax.com:favorite": true,

  "media": {
    "m1": {
      "kind": "photo",
      "uri": "data:image/png;base64, ...",  // relative "media/<sha256>.png" inside an archive
      "mediaType": "image/png",
      "getkontax.com:sha256": "a4dd28db…045ae6"
    }
  }
}`}</CodeBlock>
          <P>
            The complete property reference — every field, its class (must / optional / never), and
            its vendor shape — is in{" "}
            <a href="/format/spec.md">the full spec</a> (§3). The
            machine-checkable form is the{" "}
            <a href={`/format/kontax-contact.v${FORMAT_VERSION.split(".")[0]}.schema.json`}>
              contact JSON Schema
            </a>
            . A ready-to-read example is{" "}
            <a href="/format/daniel-cho.json">daniel-cho.json</a>.
          </P>
        </section>

        {/* Archive */}
        <section id="format-archive" className="dev-endpoint">
          <H3>Archive layout</H3>
          <P>
            An archive is a <Code>.zip</Code> containing a manifest, one JSON document per contact,
            and their photos. Photos are <strong>content-addressed</strong> —{" "}
            <Code>media/&lt;sha256&gt;.&lt;ext&gt;</Code> — so two contacts that share a photo store
            it once. Contact filenames are ordinals; the document content (its <Code>uid</Code>) is
            the identity, not the filename.
          </P>
          <CodeBlock lang="text">{`contacts.zip
├─ manifest.json            envelope + integrity table
├─ contacts/0001.json       one Card per contact (photo by relative ref)
├─ contacts/0002.json
├─ media/<sha256>.jpg       content-addressed photo bytes (deduplicated)
└─ vcards/contacts.vcf      optional vCard 3.0 compatibility copy`}</CodeBlock>
          <P>
            The <Code>manifest.json</Code> carries an <Code>integrity</Code> table with a{" "}
            <Code>sha256</Code> and byte length for every packed entry, so a truncated or tampered
            archive is detectable before anything is imported:
          </P>
          <CodeBlock lang="json">{`{
  "@type": "getkontax.com:Archive",
  "getkontax.com:formatVersion": "${FORMAT_VERSION}",
  "getkontax.com:exportedAt": "2026-07-04T14:30:00Z",
  "counts": { "contacts": 2, "photos": 1 },
  "integrity": {
    "algorithm": "sha256",
    "entries": [
      { "path": "contacts/0001.json", "sha256": "…", "bytes": 1180 },
      { "path": "media/3fa4c2….png",  "sha256": "3fa4c2…", "bytes": 20481 }
    ]
  }
}`}</CodeBlock>
          <P>
            Every <Code>contacts/*.json</Code> declares the same <Code>formatVersion</Code> as the
            manifest — a mixed-version archive is invalid. Full container rules (streaming, limits,
            recognition) are in{" "}
            <a href="/format/spec.md">spec §7</a>; the manifest schema
            is{" "}
            <a href={`/format/kontax-archive.v${FORMAT_VERSION.split(".")[0]}.schema.json`}>
              kontax-archive.v{FORMAT_VERSION.split(".")[0]}.schema.json
            </a>
            .
          </P>
        </section>

        {/* Versioning */}
        <section id="format-versioning" className="dev-endpoint">
          <H3>Versioning policy</H3>
          <P>Two independent version fields — do not conflate them:</P>
          <Table
            headers={["Field", "Meaning", "Changes when"]}
            rows={[
              [<Code key="v">version</Code>, "JSContact spec version", "RFC 9553 itself revises (expected to stay 1.0)."],
              [
                <Code key="fv">getkontax.com:formatVersion</Code>,
                "The Kontax extension-set version, MAJOR.MINOR",
                "Kontax adds or changes a getkontax.com:* property.",
              ],
            ]}
          />
          <P>
            A <strong>MINOR</strong> bump is additive — a new optional property; older readers must
            still parse the document (unknown properties are preserved, per RFC 9553 §1.7.4). A{" "}
            <strong>MAJOR</strong> bump removes, renames, or repurposes a property; a reader must
            reject a document whose major exceeds what it supports with a clear error, never a
            silent partial import. One JSON Schema is published per major. The current format
            version is <Code>{FORMAT_VERSION}</Code>.
          </P>
        </section>

        {/* vCard mapping */}
        <section id="format-vcard" className="dev-endpoint">
          <H3>vCard mapping</H3>
          <P>
            Every property maps to a <strong>native vCard property where one exists, or an{" "}
            <Code>X-KONTAX-*</Code> extension otherwise</strong>. The archive&apos;s optional{" "}
            <Code>vcards/contacts.vcf</Code> is that projection, for tools that can&apos;t read
            JSContact — lossy by construction (a generic reader drops the <Code>X-</Code> props);
            the lossless source is always <Code>contacts/</Code>. Key rows (full table in{" "}
            <a href="/format/spec.md">spec §6</a>):
          </P>
          <Table
            headers={["Document property", "vCard line"]}
            rows={[
              [<Code key="1">name.full</Code>, <Code key="1v">FN:</Code>],
              [<Code key="2">name.components</Code>, <Code key="2v">N:family;given;given2;title;credential</Code>],
              [<Code key="3">emails</Code>, <Code key="3v">EMAIL;TYPE=…[,PREF]:</Code>],
              [<Code key="4">phones.number</Code>, <Code key="4v">TEL;TYPE=…[,PREF]:</Code>],
              [<Code key="5">anniversaries (birth)</Code>, <Code key="5v">BDAY:</Code>],
              [<Code key="6">keywords (labels)</Code>, <Code key="6v">CATEGORIES:</Code>],
              [<Code key="7">notes</Code>, <Code key="7v">NOTE:</Code>],
              [<Code key="8">updated</Code>, <Code key="8v">REV:</Code>],
              [<Code key="9">getkontax.com:favorite</Code>, <Code key="9v">X-KONTAX-FAVORITE:TRUE</Code>],
              [<Code key="10">getkontax.com:customFields</Code>, <Code key="10v">X-KONTAX-CUSTOM-FIELD;X-KONTAX-LABEL=…:</Code>],
              [<Code key="11">media (photo)</Code>, <Code key="11v">PHOTO;ENCODING=b;TYPE=…:</Code>],
            ]}
          />
        </section>

        {/* Schemas & validator */}
        <section id="format-validate" className="dev-endpoint">
          <H3>Schemas &amp; validator</H3>
          <P>
            A developer can implement a reader from the files below alone — no Kontax account
            needed. The reference validator is zero-dependency (Node.js ≥ 18): it validates a
            document or an archive against the schemas and verifies the archive integrity
            checksums.
          </P>
          <Table
            headers={["File", "What it is"]}
            rows={[
              [
                <a key="s1" href={`/format/kontax-contact.v${FORMAT_VERSION.split(".")[0]}.schema.json`}>
                  kontax-contact.v{FORMAT_VERSION.split(".")[0]}.schema.json
                </a>,
                "JSON Schema for one contact document",
              ],
              [
                <a key="s2" href={`/format/kontax-archive.v${FORMAT_VERSION.split(".")[0]}.schema.json`}>
                  kontax-archive.v{FORMAT_VERSION.split(".")[0]}.schema.json
                </a>,
                "JSON Schema for the archive manifest",
              ],
              [
                <a key="e1" href="/format/daniel-cho.json">daniel-cho.json</a>,
                "Example bare document (inline photo, custom field, labels)",
              ],
              [
                <a key="e2" href="/format/example-archive.zip">example-archive.zip</a>,
                "Example archive — two contacts sharing one photo",
              ],
              [
                <a key="v1" href="/format/validate.mjs">validate.mjs</a>,
                "Zero-dependency reference validator",
              ],
              [
                <a key="sp" href="/format/spec.md">spec.md</a>,
                "The full human-readable specification",
              ],
            ]}
          />
          <CodeBlock lang="bash">{`# validate any exported file — a renamed .zip still works (content-based)
node validate.mjs contacts.zip
node validate.mjs contact.json`}</CodeBlock>
          <P>
            Source, issues, and the canonical spec live at{" "}
            <a href={FORMAT_REPO_URL} target="_blank" rel="noreferrer">
              {FORMAT_REPO_URL.replace("https://", "")}
            </a>
            . The page and the repository always state the same{" "}
            <Code>formatVersion</Code> ({FORMAT_VERSION}).
          </P>
        </section>

        {/* Footer note */}
        <div className="dev-foot">
          <p>
            API questions or issues?{" "}
            <a href="mailto:support@getkontax.com">support@getkontax.com</a>
            {" · "}
            <Link href="/developers">Back to developer docs →</Link>
          </p>
        </div>
      </DocPageShell>

    </>
  );
}
