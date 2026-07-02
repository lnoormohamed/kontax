import assert from "node:assert/strict";
import { test } from "node:test";

import { getAvatarThumbUrl } from "../../src/lib/avatar-thumb";

// P38-08: the thumb URL is derived by key convention — these cases pin it so
// the upload route (which writes `<key minus ext>-thumb.webp`) and the
// renderers stay in agreement.

test("derives the -thumb.webp sibling for Kontax-hosted avatar keys", () => {
  assert.equal(
    getAvatarThumbUrl("https://media.getkontax.com/kontax-uploads/avatars/user1/abc123.jpg"),
    "https://media.getkontax.com/kontax-uploads/avatars/user1/abc123-thumb.webp",
  );
  assert.equal(
    getAvatarThumbUrl("http://10.0.0.5:9000/kontax-uploads/avatars/u/x.webp"),
    "http://10.0.0.5:9000/kontax-uploads/avatars/u/x-thumb.webp",
  );
  assert.equal(
    getAvatarThumbUrl("https://media.getkontax.com/kontax-uploads/avatars/u/x.JPEG"),
    "https://media.getkontax.com/kontax-uploads/avatars/u/x-thumb.webp",
  );
});

test("passes external / non-matching URLs through as null", () => {
  assert.equal(getAvatarThumbUrl("https://example.com/photos/jane.jpg"), null);
  assert.equal(getAvatarThumbUrl("https://media.getkontax.com/kontax-uploads/exports/file.zip"), null);
  assert.equal(getAvatarThumbUrl("https://example.com/avatars/u/x.svg"), null);
  assert.equal(getAvatarThumbUrl(""), null);
  assert.equal(getAvatarThumbUrl(null), null);
  assert.equal(getAvatarThumbUrl(undefined), null);
});
