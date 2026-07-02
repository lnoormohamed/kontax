/**
 * P38-08 — avatar thumbnail URL convention.
 *
 * Kontax-hosted avatars live in MinIO under `avatars/<userId>/<id>.<ext>`;
 * the upload route writes a 96×96 webp sibling at
 * `avatars/<userId>/<id>-thumb.webp`. This helper derives the thumb URL by
 * key convention so no extra column is needed.
 *
 * Contact avatars can also be arbitrary pasted external URLs — those (and
 * anything else not matching our key shape) return null, and callers fall
 * back to the original. Renderers should also fall back `onError` for
 * Kontax-hosted originals uploaded before the thumbnail backfill ran.
 */
const KONTAX_AVATAR_KEY = /\/avatars\/[^/]+\/[^/]+\.(?:jpe?g|png|webp|gif)$/i;

export function getAvatarThumbUrl(url: string | null | undefined): string | null {
  if (!url || !KONTAX_AVATAR_KEY.test(url)) return null;
  return url.replace(/\.(?:jpe?g|png|webp|gif)$/i, "-thumb.webp");
}
