import { requireDavAuth } from "~/server/dav/auth";
import { davHeaders } from "~/server/dav/responses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const redirectToPrincipal = async (request: Request, includeBody: boolean) => {
  const authResult = await requireDavAuth(request);

  if (authResult instanceof Response) {
    return authResult;
  }

  const location = new URL(`/dav/principals/${authResult.userId}/`, request.url);

  return new Response(includeBody ? "Moved permanently" : null, {
    status: 301,
    headers: davHeaders({
      Location: location.toString(),
      "Content-Type": "text/plain; charset=utf-8",
    }),
  });
};

export const GET = (request: Request) => redirectToPrincipal(request, true);

export const HEAD = (request: Request) => redirectToPrincipal(request, false);
