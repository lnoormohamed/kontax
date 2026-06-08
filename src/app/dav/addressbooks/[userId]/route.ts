import { requireDavAuth } from "~/server/dav/auth";
import { computeAddressBookCTag } from "~/server/dav/ctag";
import { methodNotAllowedDavResponse, optionsDavResponse, xmlDavResponse } from "~/server/dav/responses";
import { buildPropfindResponse, type DavResponseItem } from "~/server/dav/xml";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

const ALLOW = "OPTIONS, PROPFIND";

export const OPTIONS = () => optionsDavResponse(ALLOW);

export async function PROPFIND(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const authResult = await requireDavAuth(request, userId);

  if (authResult instanceof Response) {
    return authResult;
  }

  const depth = request.headers.get("depth") ?? "0";

  if (depth !== "0" && depth !== "1") {
    return new Response("Unsupported Depth", { status: 400 });
  }

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  const homeHref = `/dav/addressbooks/${user.id}/`;
  const responses: DavResponseItem[] = [
    {
      href: homeHref,
      props: [
        { name: "displayname", value: "Address Books" },
        { name: "resourcetype", types: ["collection"] },
        { name: "current-user-principal", href: `/dav/principals/${user.id}/` },
      ],
    },
  ];

  if (depth === "1") {
    const ctag = await computeAddressBookCTag(user.id);

    responses.push({
      href: `${homeHref}default/`,
      props: [
        { name: "displayname", value: "Kontax" },
        { name: "resourcetype", types: ["collection", "addressbook"] },
        { name: "getctag", value: ctag },
        { name: "supported-address-data" },
      ],
    });
  }

  return xmlDavResponse(buildPropfindResponse(responses));
}

export const GET = () => methodNotAllowedDavResponse(ALLOW);
export const POST = () => methodNotAllowedDavResponse(ALLOW);
