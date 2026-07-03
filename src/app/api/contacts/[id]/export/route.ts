import { auth } from "~/server/auth";
import { buildKontaxArchive } from "~/server/export-format/archive";
import {
  buildCards,
  contactFileSlug,
  loadExportableContacts,
} from "~/server/export-format/export";

// P45-DB01 Surface 3: single-contact export in the Kontax contact format
// (all plans — this is the recommended default, so no plan gate; the vCard
// route keeps its own behavior). `?as=document` (default) returns one bare
// Card JSON with the photo inline; `?as=archive` returns a .zip with the
// photo as a separate media file.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const as = url.searchParams.get("as") === "archive" ? "archive" : "document";

  const { contacts, labelRegistry, bookNames } = await loadExportableContacts(userId, {
    ids: [id],
    includeArchived: true,
  });
  const contact = contacts[0];
  if (!contact) {
    return new Response("Not found", { status: 404 });
  }

  const exportedAt = new Date();
  const slug = contactFileSlug(contact.fullName);

  if (as === "document") {
    const { cards } = await buildCards(contacts, {
      labelRegistry,
      bookNames,
      mode: "bare",
      includePhotos: true,
      exportedAt,
    });
    return new Response(JSON.stringify(cards[0], null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${slug}.json"`,
      },
    });
  }

  const { cards, media } = await buildCards(contacts, {
    labelRegistry,
    bookNames,
    mode: "archive",
    includePhotos: true,
    exportedAt,
  });
  const zip = await buildKontaxArchive({ cards, media, exportedAt });
  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}.zip"`,
    },
  });
}
