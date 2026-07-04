// API_VERSION: 1 — update this comment and review all docs when the API version bumps.
// FORMAT_VERSION: 1.0 — the Kontax Contact Export Format major.minor rendered in
// the "Export format" section. Update this comment, the FORMAT_VERSION constant
// below, and re-sync public/format/* from open-format/ when the format bumps.

import type { Metadata } from "next";
import Link from "next/link";

import { PublicFooter } from "~/app/_components/public-footer";
import { PublicNav } from "~/app/_components/public-nav";
import "~/app/_components/public-site.css";

// Mirrors getkontax.com:formatVersion (see open-format/ — the canonical repo).
const FORMAT_VERSION = "1.0";
// Canonical open-source home of the format (spec, schemas, reference validator).
const FORMAT_REPO_URL = "https://github.com/getkontax/contact-format";

export const metadata: Metadata = {
  title: "Developer docs — Kontax",
  description:
    "Kontax developer documentation: the REST API at api.getkontax.com (CRUD for contacts, labels, sync) and the open Kontax Contact Export Format — a JSContact-based export format with JSON Schemas and a reference validator.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/developers" },
};

function Code({ children }: { children: string }) {
  return (
    <code
      style={{
        background: "#f4f4f5",
        borderRadius: 5,
        padding: "1px 6px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "0.9em",
        color: "#1d2823",
      }}
    >
      {children}
    </code>
  );
}

function CodeBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  void lang;
  return (
    <pre
      style={{
        background: "#1d2823",
        color: "#d4f0e0",
        borderRadius: 10,
        padding: "16px 20px",
        overflowX: "auto",
        fontSize: 13,
        lineHeight: 1.65,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        margin: "12px 0 20px",
        whiteSpace: "pre",
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: 56 }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#1d2823",
          letterSpacing: "-0.01em",
          marginBottom: 16,
          paddingTop: 8,
          borderTop: "1px solid #e4e4e7",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 16,
        fontWeight: 700,
        color: "#1d2823",
        marginBottom: 8,
        marginTop: 28,
      }}
    >
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "#5c655e", marginBottom: 12 }}>
      {children}
    </p>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 20 }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13.5,
          color: "#3a4540",
        }}
      >
        <thead>
          <tr style={{ background: "#f4f4f5" }}>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#8b938c",
                  borderBottom: "1px solid #e4e4e7",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f0f3ef" }}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{ padding: "9px 12px", verticalAlign: "top", lineHeight: 1.5 }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "#1d6fa4",
    POST: "#1a7a40",
    PUT: "#7a5c1a",
    DELETE: "#9a3a23",
  };
  return (
    <span
      style={{
        display: "inline-block",
        background: colors[method] ?? "#5c655e",
        color: "#fff",
        borderRadius: 5,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        marginRight: 10,
      }}
    >
      {method}
    </span>
  );
}

const TOC_ITEMS = [
  { href: "#introduction", label: "Introduction" },
  { href: "#authentication", label: "Authentication" },
  { href: "#endpoints", label: "Endpoints" },
  { href: "#get-contacts", label: "  GET /contacts" },
  { href: "#post-contacts", label: "  POST /contacts" },
  { href: "#get-contact", label: "  GET /contacts/:id" },
  { href: "#put-contact", label: "  PUT /contacts/:id" },
  { href: "#delete-contact", label: "  DELETE /contacts/:id" },
  { href: "#pagination", label: "Pagination" },
  { href: "#errors", label: "Errors" },
  { href: "#fields", label: "Field reference" },
  { href: "#rate-limits", label: "Rate limits" },
  { href: "#examples", label: "Code examples" },
  { href: "#export-format", label: "Export format" },
  { href: "#format-document", label: "  Document" },
  { href: "#format-archive", label: "  Archive" },
  { href: "#format-versioning", label: "  Versioning" },
  { href: "#format-vcard", label: "  vCard mapping" },
  { href: "#format-validate", label: "  Schemas & validator" },
];

export default function DevelopersPage() {

  return (
    <div className="kx">
      <PublicNav />

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "48px 24px 80px",
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          gap: 48,
          alignItems: "start",
        }}
      >
        {/* Sticky TOC sidebar */}
        <nav
          style={{
            position: "sticky",
            top: 80,
            fontSize: 13,
            lineHeight: 1.7,
          }}
          className="dev-toc"
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#8b938c",
              marginBottom: 10,
            }}
          >
            On this page
          </p>
          {TOC_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                color: item.label.startsWith("  ") ? "#8b938c" : "#5c655e",
                padding: "2px 0",
                paddingLeft: item.label.startsWith("  ") ? 12 : 0,
                fontSize: item.label.startsWith("  ") ? 12.5 : 13,
                fontFamily: item.label.startsWith("  ")
                  ? "ui-monospace, SFMono-Regular, Menlo, monospace"
                  : "inherit",
                textDecoration: "none",
                transition: "color 0.1s",
              }}
            >
              {item.label.trim()}
            </a>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ minWidth: 0 }}>
          {/* Page header */}
          <div style={{ marginBottom: 48 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "#8b938c",
                marginBottom: 8,
              }}
            >
              Developer documentation
            </p>
            <h1
              style={{
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#1d2823",
                marginBottom: 12,
              }}
            >
              Kontax API v1
            </h1>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "#5c655e", maxWidth: 600 }}>
              Read and write your contacts programmatically. All API requests are authenticated
              with a Bearer token created in{" "}
              <Link href="/settings/developer" style={{ color: "#4158f4" }}>
                Settings → Developer
              </Link>
              .
            </p>
            <div
              style={{
                marginTop: 16,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#f4f4f5",
                borderRadius: 8,
                padding: "8px 14px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 13.5,
                color: "#1d2823",
              }}
            >
              <span style={{ color: "#8b938c" }}>Base URL</span>
              https://api.getkontax.com/v1
            </div>
          </div>

          {/* Introduction */}
          <Section id="introduction" title="Introduction">
            <P>
              The Kontax REST API allows you to list, create, update, and delete contacts from
              external scripts, automations, and integrations. API access is available on Pro,
              Family, and Teams plans.
            </P>
            <P>
              All requests must include a valid <Code>Authorization</Code> header. The API returns
              JSON and uses standard HTTP status codes. All timestamps are ISO 8601 in UTC.
            </P>
          </Section>

          {/* Authentication */}
          <Section id="authentication" title="Authentication">
            <P>
              Generate an API token in{" "}
              <Link href="/settings/developer" style={{ color: "#4158f4" }}>
                Settings → Developer
              </Link>{" "}
              and include it as a Bearer token on every request:
            </P>
            <CodeBlock lang="http">{`Authorization: Bearer ktx_live_your-token-here`}</CodeBlock>
            <P>
              Tokens come in two scopes. <strong>Read-only</strong> tokens can list and fetch
              contacts. <strong>Read-write</strong> tokens can also create, update, and delete
              contacts. The API returns <Code>403 Forbidden</Code> if a read-only token attempts a
              write operation.
            </P>
            <P>
              Tokens are shown once on creation and hashed at rest. If you lose a token, revoke it
              and create a new one — there is no way to retrieve the original value.
            </P>
          </Section>

          {/* Endpoints */}
          <Section id="endpoints" title="Endpoints">
            <P>All endpoints are under the base URL above. Responses are JSON.</P>
          </Section>

          {/* GET /contacts */}
          <section id="get-contacts" style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <MethodBadge method="GET" />
              <code
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: "#1d2823",
                }}
              >
                /contacts
              </code>
            </div>
            <P>List contacts. Returns up to 100 per page, ordered by full name.</P>
            <H3>Query parameters</H3>
            <Table
              headers={["Parameter", "Type", "Default", "Description"]}
              rows={[
                [<Code key="q">q</Code>, "string", "—", "Search by name, company, or email"],
                [<Code key="l">limit</Code>, "integer", "50", "Results per page (max 100)"],
                [<Code key="c">cursor</Code>, "string", "—", "Pagination cursor from previous response"],
                [<Code key="b">bookId</Code>, "string", "—", "Filter to a specific address book"],
                [<Code key="a">archived</Code>, "boolean", "false", "Return archived contacts instead of active ones"],
              ]}
            />
            <H3>Example request</H3>
            <CodeBlock lang="bash">{`curl -H "Authorization: Bearer ktx_live_..." \\
  "https://api.getkontax.com/v1/contacts?q=acme&limit=10"`}</CodeBlock>
            <H3>Example response</H3>
            <CodeBlock lang="json">{`{
  "contacts": [
    {
      "id": "clx7a...",
      "firstName": "Jane",
      "lastName": "Smith",
      "fullName": "Jane Smith",
      "company": "Acme Corp",
      "jobTitle": "Head of Sales",
      "notes": null,
      "birthday": null,
      "emails": [{ "value": "jane@acme.com", "label": "work", "isPrimary": true }],
      "phones": [{ "value": "+1 415 555 0100", "label": "mobile", "isPrimary": true }],
      "bookId": null,
      "source": "MANUAL",
      "createdAt": "2026-06-01T09:00:00.000Z",
      "updatedAt": "2026-06-10T14:32:00.000Z"
    }
  ],
  "pagination": { "cursor": "clx7a...", "hasMore": true }
}`}</CodeBlock>
          </section>

          {/* POST /contacts */}
          <section id="post-contacts" style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <MethodBadge method="POST" />
              <code
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: "#1d2823",
                }}
              >
                /contacts
              </code>
            </div>
            <P>
              Create a contact. Requires a <strong>read-write</strong> token. At least one of{" "}
              <Code>firstName</Code>, <Code>lastName</Code>, <Code>fullName</Code>, or{" "}
              <Code>company</Code> is required.
            </P>
            <H3>Request body (JSON)</H3>
            <Table
              headers={["Field", "Type", "Description"]}
              rows={[
                [<Code key="fn">firstName</Code>, "string", "Given name (max 80 chars)"],
                [<Code key="ln">lastName</Code>, "string", "Family name (max 80 chars)"],
                [<Code key="fln">fullName</Code>, "string", "Override the derived full name (max 200 chars)"],
                [<Code key="co">company</Code>, "string", "Company or organisation (max 120 chars)"],
                [<Code key="jt">jobTitle</Code>, "string", "Job title (max 120 chars)"],
                [<Code key="no">notes</Code>, "string", "Free-text notes (max 10,000 chars)"],
                [<Code key="bd">birthday</Code>, "string", "YYYY-MM-DD or --MM-DD (year unknown)"],
                [<Code key="em">emails</Code>, "array", "Up to 10 email entries — see entry format below"],
                [<Code key="ph">phones</Code>, "array", "Up to 10 phone entries — see entry format below"],
                [<Code key="bi">bookId</Code>, "string", "CUID of an address book to place the contact in"],
              ]}
            />
            <P>
              Email and phone entries use the shape{" "}
              <Code>{"{ value: string, label?: string }"}</Code>. The first entry in each array
              becomes the primary. Omitting <Code>label</Code> defaults to{" "}
              <Code>primary</Code> / <Code>mobile</Code>.
            </P>
            <H3>Example request</H3>
            <CodeBlock lang="bash">{`curl -X POST "https://api.getkontax.com/v1/contacts" \\
  -H "Authorization: Bearer ktx_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "company": "Acme Corp",
    "emails": [{ "value": "jane@acme.com", "label": "work" }],
    "phones": [{ "value": "+1 415 555 0100", "label": "mobile" }]
  }'`}</CodeBlock>
            <P>
              Returns <Code>201 Created</Code> with the created contact object, or{" "}
              <Code>400</Code> / <Code>403</Code> on validation or limit errors.
            </P>
          </section>

          {/* GET /contacts/:id */}
          <section id="get-contact" style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <MethodBadge method="GET" />
              <code
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: "#1d2823",
                }}
              >
                /contacts/:id
              </code>
            </div>
            <P>Fetch a single contact by ID.</P>
            <CodeBlock lang="bash">{`curl -H "Authorization: Bearer ktx_live_..." \\
  "https://api.getkontax.com/v1/contacts/clx7a..."`}</CodeBlock>
            <P>
              Returns the contact object, or <Code>404 Not Found</Code> if the contact does not
              exist or belongs to a different user.
            </P>
          </section>

          {/* PUT /contacts/:id */}
          <section id="put-contact" style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <MethodBadge method="PUT" />
              <code
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: "#1d2823",
                }}
              >
                /contacts/:id
              </code>
            </div>
            <P>
              Update a contact. Requires a <strong>read-write</strong> token. Only fields included
              in the request body are updated — omitted fields are left unchanged (PATCH semantics
              despite the PUT method name).
            </P>
            <P>
              <strong>Note:</strong> <Code>emails</Code> and <Code>phones</Code> are replaced
              entirely when included. To add a phone number without losing existing ones, send the
              complete array.
            </P>
            <CodeBlock lang="bash">{`curl -X PUT "https://api.getkontax.com/v1/contacts/clx7a..." \\
  -H "Authorization: Bearer ktx_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "jobTitle": "VP of Sales" }'`}</CodeBlock>
            <P>Returns the updated contact object.</P>
          </section>

          {/* DELETE /contacts/:id */}
          <section id="delete-contact" style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <MethodBadge method="DELETE" />
              <code
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: "#1d2823",
                }}
              >
                /contacts/:id
              </code>
            </div>
            <P>
              Archive a contact (soft delete). The contact is hidden from the contacts list but
              remains in the database. Add <Code>?permanent=true</Code> to hard-delete immediately
              — this cannot be undone.
            </P>
            <CodeBlock lang="bash">{`# Archive (reversible)
curl -X DELETE -H "Authorization: Bearer ktx_live_..." \\
  "https://api.getkontax.com/v1/contacts/clx7a..."

# Permanent delete
curl -X DELETE -H "Authorization: Bearer ktx_live_..." \\
  "https://api.getkontax.com/v1/contacts/clx7a...?permanent=true"`}</CodeBlock>
            <P>
              Returns <Code>204 No Content</Code> on success.
            </P>
          </section>

          {/* Pagination */}
          <Section id="pagination" title="Pagination">
            <P>
              List responses include a <Code>pagination</Code> envelope. Pass the returned{" "}
              <Code>cursor</Code> as a query parameter on the next request to fetch the next page.
            </P>
            <CodeBlock lang="json">{`{
  "contacts": [ /* up to limit items */ ],
  "pagination": {
    "cursor": "clx7b...",   // pass as ?cursor= on the next request
    "hasMore": true         // false on the last page
  }
}`}</CodeBlock>
            <P>
              Cursor-based pagination is stable: inserting or deleting contacts between pages does
              not cause duplicates or gaps. The default <Code>limit</Code> is 50; the maximum is
              100.
            </P>
          </Section>

          {/* Errors */}
          <Section id="errors" title="Errors">
            <P>All error responses use the same JSON shape:</P>
            <CodeBlock lang="json">{`{ "error": "ERROR_CODE", "message": "Human-readable description." }`}</CodeBlock>
            <P>
              Validation errors include a <Code>details</Code> field with field-level messages.
            </P>
            <Table
              headers={["Status", "Error code", "Meaning"]}
              rows={[
                ["400", <Code key="v">VALIDATION_ERROR</Code>, "Request body is invalid. See details field."],
                ["400", <Code key="j">INVALID_JSON</Code>, "Request body is not valid JSON."],
                ["401", <Code key="u">UNAUTHENTICATED</Code>, "Authorization header is missing or malformed."],
                ["401", <Code key="i">INVALID_TOKEN</Code>, "Token is invalid, expired, or revoked."],
                ["403", <Code key="f">FORBIDDEN</Code>, "Read-only token attempted a write operation."],
                ["403", <Code key="l">LIMIT_REACHED</Code>, "Contact limit for your plan has been reached."],
                ["404", <Code key="n">NOT_FOUND</Code>, "Contact not found or belongs to another user."],
                ["429", <Code key="r">RATE_LIMITED</Code>, "Too many requests. See X-RateLimit-* headers."],
                ["500", <Code key="s">INTERNAL_ERROR</Code>, "Unexpected server error."],
              ]}
            />
          </Section>

          {/* Field reference */}
          <Section id="fields" title="Field reference">
            <P>All fields returned by the API. Write endpoints accept a subset.</P>
            <Table
              headers={["Field", "Type", "Writable", "Notes"]}
              rows={[
                [<Code key="id">id</Code>, "string", "—", "CUID, assigned on creation"],
                [<Code key="fn">firstName</Code>, "string | null", "✓", "Max 80 chars"],
                [<Code key="ln">lastName</Code>, "string | null", "✓", "Max 80 chars"],
                [<Code key="fln">fullName</Code>, "string", "✓", "Derived from parts if omitted; required indirectly"],
                [<Code key="co">company</Code>, "string | null", "✓", "Max 120 chars"],
                [<Code key="jt">jobTitle</Code>, "string | null", "✓", "Max 120 chars"],
                [<Code key="no">notes</Code>, "string | null", "✓", "Max 10,000 chars"],
                [<Code key="bd">birthday</Code>, "string | null", "✓", "YYYY-MM-DD or --MM-DD"],
                [<Code key="em">emails</Code>, "entry[]", "✓", "Array of { value, label, isPrimary }"],
                [<Code key="ph">phones</Code>, "entry[]", "✓", "Array of { value, label, isPrimary }"],
                [<Code key="la">labels</Code>, "string[]", "✓", "Array of label names, e.g. [\"VIP\", \"Newsletter\"]"],
                [<Code key="if">isFavorite</Code>, "boolean", "✓", "True if the contact is starred"],
                [<Code key="ie">isEmergency</Code>, "boolean", "✓", "True if the contact is marked as an emergency contact"],
                [<Code key="bi">bookId</Code>, "string | null", "✓", "Address book CUID"],
                [<Code key="sr">source</Code>, "string", "—", "Origin: MANUAL, API, SYNC_CARDDAV, etc."],
                [<Code key="ca">createdAt</Code>, "ISO 8601", "—", "UTC timestamp"],
                [<Code key="ua">updatedAt</Code>, "ISO 8601", "—", "UTC timestamp, updated on every write"],
              ]}
            />
          </Section>

          {/* Rate limits */}
          <Section id="rate-limits" title="Rate limits">
            <P>Rate limits are enforced per token using a sliding 1-hour window.</P>
            <Table
              headers={["Token scope", "Requests per hour"]}
              rows={[
                ["Read-only", "1,000"],
                ["Read-write", "200"],
              ]}
            />
            <P>Every response includes rate limit headers:</P>
            <CodeBlock lang="http">{`X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 2026-06-11T15:00:00.000Z`}</CodeBlock>
            <P>
              When the limit is exceeded, the API returns <Code>429 Too Many Requests</Code> with a{" "}
              <Code>Retry-After</Code> header (seconds until the window resets).
            </P>
          </Section>

          {/* Code examples */}
          <Section id="examples" title="Code examples">
            <H3>cURL — list contacts</H3>
            <CodeBlock lang="bash">{`curl -H "Authorization: Bearer ktx_live_your-token" \\
  "https://api.getkontax.com/v1/contacts?limit=20"`}</CodeBlock>

            <H3>JavaScript (fetch) — create a contact</H3>
            <CodeBlock lang="javascript">{`const response = await fetch("https://api.getkontax.com/v1/contacts", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ktx_live_your-token",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    firstName: "Jane",
    lastName: "Smith",
    emails: [{ value: "jane@example.com", label: "work" }],
  }),
});

const contact = await response.json();
console.log(contact.id);`}</CodeBlock>

            <H3>Python (requests) — paginate all contacts</H3>
            <CodeBlock lang="python">{`import requests

TOKEN = "ktx_live_your-token"
BASE  = "https://api.getkontax.com/v1"

def list_all_contacts():
    contacts = []
    cursor = None

    while True:
        params = {"limit": 100}
        if cursor:
            params["cursor"] = cursor

        r = requests.get(
            f"{BASE}/contacts",
            headers={"Authorization": f"Bearer {TOKEN}"},
            params=params,
        )
        r.raise_for_status()
        data = r.json()
        contacts.extend(data["contacts"])

        if not data["pagination"]["hasMore"]:
            break
        cursor = data["pagination"]["cursor"]

    return contacts

all_contacts = list_all_contacts()
print(f"Fetched {len(all_contacts)} contacts")`}</CodeBlock>
          </Section>

          {/* ─────────────────────────  Export format  ───────────────────────── */}

          <Section id="export-format" title={`Export format (v${FORMAT_VERSION})`}>
            <P>
              Kontax exports contacts in an <strong>open, documented format</strong> so your data is
              never locked in. One JSON document describes one contact; an archive is packaging
              around many of them plus their photos. The format is{" "}
              <a href={FORMAT_REPO_URL} style={{ color: "#4158f4" }} target="_blank" rel="noreferrer">
                developed in the open
              </a>{" "}
              — this section is the reference; the canonical spec, JSON Schemas, and a reference
              validator live in that repository (also mirrored under{" "}
              <a href="/format/spec.md" style={{ color: "#4158f4" }}>/format</a> on this site).
            </P>
            <P>
              The base standard is{" "}
              <a href="https://www.rfc-editor.org/rfc/rfc9553" style={{ color: "#4158f4" }} target="_blank" rel="noreferrer">
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
          <section id="format-document" style={{ marginBottom: 48 }}>
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
              <a href="/format/spec.md" style={{ color: "#4158f4" }}>the full spec</a> (§3). The
              machine-checkable form is the{" "}
              <a href={`/format/kontax-contact.v${FORMAT_VERSION.split(".")[0]}.schema.json`} style={{ color: "#4158f4" }}>
                contact JSON Schema
              </a>
              . A ready-to-read example is{" "}
              <a href="/format/daniel-cho.json" style={{ color: "#4158f4" }}>daniel-cho.json</a>.
            </P>
          </section>

          {/* Archive */}
          <section id="format-archive" style={{ marginBottom: 48 }}>
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
              <a href="/format/spec.md" style={{ color: "#4158f4" }}>spec §7</a>; the manifest schema
              is{" "}
              <a href={`/format/kontax-archive.v${FORMAT_VERSION.split(".")[0]}.schema.json`} style={{ color: "#4158f4" }}>
                kontax-archive.v{FORMAT_VERSION.split(".")[0]}.schema.json
              </a>
              .
            </P>
          </section>

          {/* Versioning */}
          <section id="format-versioning" style={{ marginBottom: 48 }}>
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
          <section id="format-vcard" style={{ marginBottom: 48 }}>
            <H3>vCard mapping</H3>
            <P>
              Every property maps to a <strong>native vCard property where one exists, or an{" "}
              <Code>X-KONTAX-*</Code> extension otherwise</strong>. The archive&apos;s optional{" "}
              <Code>vcards/contacts.vcf</Code> is that projection, for tools that can&apos;t read
              JSContact — lossy by construction (a generic reader drops the <Code>X-</Code> props);
              the lossless source is always <Code>contacts/</Code>. Key rows (full table in{" "}
              <a href="/format/spec.md" style={{ color: "#4158f4" }}>spec §6</a>):
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
          <section id="format-validate" style={{ marginBottom: 48 }}>
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
                  <a key="s1" href={`/format/kontax-contact.v${FORMAT_VERSION.split(".")[0]}.schema.json`} style={{ color: "#4158f4" }}>
                    kontax-contact.v{FORMAT_VERSION.split(".")[0]}.schema.json
                  </a>,
                  "JSON Schema for one contact document",
                ],
                [
                  <a key="s2" href={`/format/kontax-archive.v${FORMAT_VERSION.split(".")[0]}.schema.json`} style={{ color: "#4158f4" }}>
                    kontax-archive.v{FORMAT_VERSION.split(".")[0]}.schema.json
                  </a>,
                  "JSON Schema for the archive manifest",
                ],
                [
                  <a key="e1" href="/format/daniel-cho.json" style={{ color: "#4158f4" }}>daniel-cho.json</a>,
                  "Example bare document (inline photo, custom field, labels)",
                ],
                [
                  <a key="e2" href="/format/example-archive.zip" style={{ color: "#4158f4" }}>example-archive.zip</a>,
                  "Example archive — two contacts sharing one photo",
                ],
                [
                  <a key="v1" href="/format/validate.mjs" style={{ color: "#4158f4" }}>validate.mjs</a>,
                  "Zero-dependency reference validator",
                ],
                [
                  <a key="sp" href="/format/spec.md" style={{ color: "#4158f4" }}>spec.md</a>,
                  "The full human-readable specification",
                ],
              ]}
            />
            <CodeBlock lang="bash">{`# validate any exported file — a renamed .zip still works (content-based)
node validate.mjs contacts.zip
node validate.mjs contact.json`}</CodeBlock>
            <P>
              Source, issues, and the canonical spec live at{" "}
              <a href={FORMAT_REPO_URL} style={{ color: "#4158f4" }} target="_blank" rel="noreferrer">
                {FORMAT_REPO_URL.replace("https://", "")}
              </a>
              . The page and the repository always state the same{" "}
              <Code>formatVersion</Code> ({FORMAT_VERSION}).
            </P>
          </section>

          {/* Footer note */}
          <div
            style={{
              borderTop: "1px solid #e4e4e7",
              paddingTop: 24,
              marginTop: 8,
            }}
          >
            <p style={{ fontSize: 13, color: "#8b938c", lineHeight: 1.6 }}>
              API questions or issues?{" "}
              <a href="mailto:support@getkontax.com" style={{ color: "#4158f4" }}>
                support@getkontax.com
              </a>
              {" · "}
              <Link href="/settings/developer" style={{ color: "#4158f4" }}>
                Manage your tokens →
              </Link>
            </p>
          </div>
        </main>
      </div>

      <PublicFooter />

      <style>{`
        @media (max-width: 700px) {
          .dev-toc { display: none; }
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
