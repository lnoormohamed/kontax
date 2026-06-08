import { requireDavAuth } from "~/server/dav/auth";
import { methodNotAllowedDavResponse, optionsDavResponse, xmlDavResponse } from "~/server/dav/responses";
import { buildPropfindResponse } from "~/server/dav/xml";
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

  if (depth !== "0" && depth !== "infinity") {
    return new Response("Unsupported Depth", { status: 400 });
  }

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  return xmlDavResponse(
    buildPropfindResponse([
      {
        href: `/dav/principals/${user.id}/`,
        props: [
          { name: "current-user-principal", href: `/dav/principals/${user.id}/` },
          { name: "addressbook-home-set", href: `/dav/addressbooks/${user.id}/` },
          { name: "displayname", value: user.name ?? user.email },
        ],
      },
    ]),
  );
}

export const GET = () => methodNotAllowedDavResponse(ALLOW);
export const POST = () => methodNotAllowedDavResponse(ALLOW);
