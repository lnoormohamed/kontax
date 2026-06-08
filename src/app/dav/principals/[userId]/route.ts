import { methodNotAllowedDavResponse, optionsDavResponse } from "~/server/dav/responses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOW = "OPTIONS, PROPFIND";

export const OPTIONS = () => optionsDavResponse(ALLOW);

// Do not export PROPFIND here. Next.js App Router rejects non-standard route
// method exports during production builds. The custom Node adapter in server.mjs
// owns DAV verbs and delegates normal web traffic back to Next.

export const GET = () => methodNotAllowedDavResponse(ALLOW);
export const POST = () => methodNotAllowedDavResponse(ALLOW);
