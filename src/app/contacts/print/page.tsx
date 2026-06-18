import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { parseContactStringArray } from "~/server/contact-portability";

// P36-DB04: print-friendly view for a bulk selection. Opened in a new tab from
// the contacts bulk toolbar (?ids=a,b,c); auto-triggers the browser print dialog.

const PrintTrigger = () => (
  <script
    // Fire once the document is ready. Kept inline so the new tab prints itself.
    dangerouslySetInnerHTML={{ __html: "window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };" }}
  />
);

export default async function ContactsPrintPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/contacts");
  const userId = session.user.id;

  const resolved = searchParams ? await searchParams : {};
  const raw = resolved.ids;
  const idsParam = Array.isArray(raw) ? raw[0] : raw;
  const ids = (idsParam ?? "").split(",").map((v) => v.trim()).filter(Boolean);

  const contacts = ids.length
    ? await db.contact.findMany({
        where: { userId, id: { in: ids } },
        orderBy: [{ fullName: "asc" }],
        select: {
          id: true,
          fullName: true,
          company: true,
          jobTitle: true,
          email: true,
          phone: true,
          emailAddresses: true,
          phoneNumbers: true,
          address: true,
        },
      })
    : [];

  return (
    <html lang="en">
      <head>
        <title>Kontax — Print contacts</title>
        <style>{`
          * { box-sizing: border-box; }
          body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #1d2823; margin: 32px; }
          h1 { font-size: 18px; margin: 0 0 4px; }
          .meta { color: #8b938c; font-size: 12px; margin-bottom: 20px; }
          .c { padding: 12px 0; border-top: 1px solid #e2e6e0; break-inside: avoid; }
          .c:first-of-type { border-top: 2px solid #1d2823; }
          .name { font-size: 15px; font-weight: 600; }
          .sub { font-size: 12.5px; color: #5c655e; margin-top: 1px; }
          .row { font-size: 13px; margin-top: 3px; }
          .row b { color: #8b938c; font-weight: 600; display: inline-block; min-width: 58px; }
          @media print { body { margin: 14mm; } .noprint { display: none; } }
        `}</style>
      </head>
      <body>
        <PrintTrigger />
        <h1>Contacts</h1>
        <div className="meta">{contacts.length} contact{contacts.length === 1 ? "" : "s"} · Kontax</div>
        {contacts.length === 0 ? (
          <p>No contacts to print.</p>
        ) : (
          contacts.map((c) => {
            const emails = [c.email, ...parseContactStringArray(c.emailAddresses)].filter(Boolean);
            const phones = [c.phone, ...parseContactStringArray(c.phoneNumbers)].filter(Boolean);
            const uniqEmails = [...new Set(emails as string[])];
            const uniqPhones = [...new Set(phones as string[])];
            const org = [c.jobTitle, c.company].filter(Boolean).join(" · ");
            return (
              <div key={c.id} className="c">
                <div className="name">{c.fullName || "Unnamed contact"}</div>
                {org ? <div className="sub">{org}</div> : null}
                {uniqEmails.length ? <div className="row"><b>Email</b>{uniqEmails.join(", ")}</div> : null}
                {uniqPhones.length ? <div className="row"><b>Phone</b>{uniqPhones.join(", ")}</div> : null}
                {c.address ? <div className="row"><b>Address</b>{c.address}</div> : null}
              </div>
            );
          })
        )}
      </body>
    </html>
  );
}
