// API_VERSION: 1 — update this comment and review all docs when the API version bumps.

import type { Metadata } from "next";
import Link from "next/link";

import { PublicFooter } from "~/app/_components/public-footer";
import { PublicNav } from "~/app/_components/public-nav";
import "~/app/_components/public-site.css";

export const metadata: Metadata = {
  title: "Developer API — Kontax",
  description:
    "The Kontax REST API at api.getkontax.com — CRUD for contacts, labels, and sync. API reference and authentication docs.",
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
