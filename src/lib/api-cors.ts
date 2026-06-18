// CORS headers for /api/v1/* routes only.
// "*" origin is safe here because v1 auth uses Bearer tokens, not cookies —
// browsers cannot send credentials: "include" with a wildcard origin anyway.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;
