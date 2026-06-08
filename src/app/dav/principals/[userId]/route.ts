import { methodNotAllowedDavResponse, optionsDavResponse } from "~/server/dav/responses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOW = "OPTIONS";

export const OPTIONS = () => optionsDavResponse(ALLOW);

export const GET = () => methodNotAllowedDavResponse(ALLOW);
export const POST = () => methodNotAllowedDavResponse(ALLOW);
