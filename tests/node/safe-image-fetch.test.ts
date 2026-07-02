import assert from "node:assert/strict";
import { test } from "node:test";

import { isPrivateIp, validateImageUrl } from "../../src/server/safe-image-fetch";
import { resolveAvatarSrc } from "../../src/lib/avatar-src";

// P38-08 follow-up: the image proxy's SSRF guards. This server lives on a
// LAN next to MinIO/Proxmox/Coolify — these cases pin the address ranges and
// URL shapes that must never be fetched.

test("isPrivateIp blocks loopback, RFC1918, link-local, CGNAT, reserved", () => {
  for (const ip of [
    "127.0.0.1", "10.0.0.200", "172.16.0.1", "172.31.255.255", "192.168.1.193",
    "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
    "::1", "::", "fc00::1", "fd12::1", "fe80::1", "ff02::1", "::ffff:192.168.1.1",
  ]) {
    assert.equal(isPrivateIp(ip), true, `${ip} must be private`);
  }
});

test("isPrivateIp allows public addresses", () => {
  for (const ip of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateIp(ip), false, `${ip} must be public`);
  }
});

test("validateImageUrl blocks non-http schemes, credentials, ports, local hosts", () => {
  for (const url of [
    "file:///etc/passwd",
    "ftp://example.com/a.jpg",
    "gopher://example.com/",
    "https://user:pass@example.com/a.jpg",
    "https://example.com:8443/a.jpg",
    "http://example.com:9000/a.jpg",
    "http://localhost/a.jpg",
    "http://minio.local/a.jpg",
    "http://127.0.0.1/a.jpg",
    "http://[::1]/a.jpg",
    "http://192.168.1.193/a.jpg",
    "not a url",
  ]) {
    assert.equal(validateImageUrl(url).ok, false, `${url} must be blocked`);
  }
});

test("validateImageUrl allows plain public http(s) URLs", () => {
  assert.equal(validateImageUrl("https://i.pravatar.cc/300?img=12").ok, true);
  assert.equal(validateImageUrl("http://example.com/avatar.png").ok, true);
  assert.equal(validateImageUrl("https://example.com:443/a.jpg").ok, true);
});

test("resolveAvatarSrc routes external URLs through the proxy, media host direct", () => {
  assert.equal(
    resolveAvatarSrc("https://media.getkontax.com/kontax-uploads/avatars/u/x.jpg"),
    "https://media.getkontax.com/kontax-uploads/avatars/u/x.jpg",
  );
  assert.equal(
    resolveAvatarSrc("https://media.getkontax.com/kontax-uploads/avatars/u/x.jpg", { thumb: true }),
    "https://media.getkontax.com/kontax-uploads/avatars/u/x-thumb.webp",
  );
  assert.equal(
    resolveAvatarSrc("https://i.pravatar.cc/300?img=12"),
    "/api/image-proxy?url=https%3A%2F%2Fi.pravatar.cc%2F300%3Fimg%3D12",
  );
  assert.equal(
    resolveAvatarSrc("https://i.pravatar.cc/300", { thumb: true }),
    "/api/image-proxy?url=https%3A%2F%2Fi.pravatar.cc%2F300&w=96",
  );
  assert.equal(resolveAvatarSrc("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  assert.equal(resolveAvatarSrc(null), null);
});
