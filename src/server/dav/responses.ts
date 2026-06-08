export const DAV_CAPABILITY_HEADER = "1, addressbook";
export const DAV_REALM = 'Basic realm="Kontax CardDAV"';

export const davHeaders = (extra?: HeadersInit) =>
  new Headers({
    DAV: DAV_CAPABILITY_HEADER,
    "Cache-Control": "no-cache, no-store",
    ...extra,
  });

export const unauthorizedDavResponse = () =>
  new Response("Unauthorized", {
    status: 401,
    headers: davHeaders({
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": DAV_REALM,
    }),
  });

export const forbiddenDavResponse = () =>
  new Response("Forbidden", {
    status: 403,
    headers: davHeaders({
      "Content-Type": "text/plain; charset=utf-8",
    }),
  });

export const tooManyRequestsDavResponse = () =>
  new Response("Too many requests", {
    status: 429,
    headers: davHeaders({
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": "900",
    }),
  });

export const methodNotAllowedDavResponse = (allow: string) =>
  new Response("Method not allowed", {
    status: 405,
    headers: davHeaders({
      Allow: allow,
      "Content-Type": "text/plain; charset=utf-8",
    }),
  });

export const optionsDavResponse = (allow: string) =>
  new Response(null, {
    status: 200,
    headers: davHeaders({
      Allow: allow,
      "Content-Length": "0",
    }),
  });

export const xmlDavResponse = (body: string) =>
  new Response(body, {
    status: 207,
    headers: davHeaders({
      "Content-Type": "application/xml; charset=utf-8",
    }),
  });
