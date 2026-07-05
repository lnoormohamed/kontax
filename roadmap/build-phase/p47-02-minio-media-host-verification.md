# P47-02 — MinIO / media host verification & avatar round-trip

**Phase:** 47 · **Workstream:** A · **Priority:** P0 · **Depends on:** P47-01

## Objective

Prove that contact photos and avatar uploads work **end-to-end in production** —
uploaded from a browser, stored in MinIO, and loaded back over
`https://media.getkontax.com` as a **direct media URL, not the `/api/image-proxy`
fallback**. This is the "MinIO needs checking" item and the direct remedy for
the **P44-06 blocker** (photos pull + normalize but drop because storage was
never wired).

## Context

MinIO exists — LXC 151, `192.168.1.119:9000`, bucket `kontax-uploads`, access key
`kontax-82429186ae0f8a4c` (readwrite on the bucket), proxied via
`https://media.getkontax.com`. What is **unverified**: whether the app container
has the `MINIO_*` env, whether the browser can actually load an object over
HTTPS, and whether CSP/CORS allow it.

Two reachability planes that are easy to conflate (see env-secrets §Blob storage):
- **Server-side** (upload/store): the container can talk to MinIO over the
  private network (`192.168.1.119:9000` or the proxy).
- **Browser-side** (display): the user's browser must reach the object over a
  **public HTTPS origin** — `https://media.getkontax.com`. A private-network URL
  never loads client-side, and the image proxy **refuses private IPs (SSRF)**,
  so there is no fallback if the public host is wrong.

**Third plane — presigned downloads.** Export-job artifacts (P45) and data
exports build **browser-facing presigned URLs signed against `MINIO_ENDPOINT`**
(`src/server/export-format/jobs.ts`, `src/server/data-export/s3.ts`) — not
against `MINIO_PUBLIC_URL`. If `MINIO_ENDPOINT` is the private IP, avatars will
work but **every export download link points into the private network and
fails**. Either set `MINIO_ENDPOINT` to the public proxy origin, or verify the
signed host is browser-reachable before sign-off.

## Steps

1. **Wire env** (in Coolify LXC 122 → redeploy; see P47-05):
   - `MINIO_ENDPOINT` = the endpoint the container uses to store objects.
     **Presigned-URL caveat:** export downloads are signed against this value
     (see Context) — pick a browser-reachable origin or step 6 fails.
   - `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` — the `kontax-82429186ae0f8a4c` pair.
   - `MINIO_BUCKET=kontax-uploads`.
   - `MINIO_PUBLIC_URL=https://media.getkontax.com/kontax-uploads`.
   - `NEXT_PUBLIC_MEDIA_HOST` — **not needed for prod**: `media.getkontax.com` is
     the built-in legacy match (env-secrets §P46-02 step 2). Setting it wrong
     would break the CSP; leave unset.
2. **Bucket policy / CORS** — confirm the bucket serves objects publicly over
   the proxy (GET on `avatars/…` returns the image, correct `Content-Type`), and
   CORS allows the app origin if any client fetch needs it.
3. **Proxy path preservation** — the Traefik/Cloudflare route for
   `media.getkontax.com` must preserve `/kontax-uploads/avatars/…` so object keys
   resolve unchanged.
4. **Round-trip test** — on the live app: upload a contact photo → confirm two
   MinIO objects (canonical + 96px thumb, per P46-03) → open the contact → the
   `<img src>` is `https://media.getkontax.com/...`, **not** `/api/image-proxy?...`.
5. **Sync-photo path** — trigger a photo sync (P44) for a test contact and
   confirm the pulled+normalized image lands in MinIO and displays (this is the
   exact path that dropped in P44-06). **Prerequisite:** photo sync is gated
   behind `PHOTO_SYNC_ENABLED` (`src/lib/photo-sync-flags.ts`, default **off**,
   not in `src/env.js`) — without it set this step silently no-ops. Use the
   launch decision recorded in P47-05; if launching with the flag off, run this
   step once with the flag temporarily on, then restore.
6. **Export-download round-trip** — run an export job (P45) on the live app and
   open the download link **from a browser outside the private network**;
   confirm the presigned URL host resolves and the artifact downloads. Repeat
   for a data-export (`/api/cron/data-export` artifact) link.

## Acceptance

- A freshly uploaded avatar and a sync-pulled photo both display on the live
  origin via a direct `media.getkontax.com` URL (no image-proxy).
- An export-job artifact downloads in a browser via its presigned URL (no
  private-network host in the signed link).
- Broken-image / initials-only fallback appears only when a contact genuinely
  has no photo — never for a photo that was uploaded/synced.
- Bucket is not world-writable; only the app credential can PUT.
- Result recorded on the P47-01 checklist.

## References

- env-secrets §Blob storage + §P46-02 avatar display deploy checklist
- Memory: `memory/project_p44-06-live-run-blocker.md`
- `scripts/rewrite-avatar-host.mjs` (only if any staging-baked URLs exist → P47-11)
</content>
