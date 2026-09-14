import assert from "node:assert/strict";
import { test } from "node:test";

import { isPrivateIp, validateOutboundUrl } from "../../src/server/safe-fetch";

// P48-04: the general outbound guard used by the CardDAV client, discovered
// hrefs, vCard PHOTO URIs and the photo pass. This server lives on a LAN next
// to MinIO/Proxmox/Coolify — these cases pin what must never be fetched.

test("validateOutboundUrl blocks private literals, local hosts, credentials, bad schemes", () => {
  for (const url of [
    "file:///etc/passwd",
    "ftp://example.com/",
    "gopher://example.com/",
    "https://user:pass@example.com/dav/",
    "https://localhost/dav/",
    "https://foo.localhost/dav/",
    "https://minio.local/",
    "https://coolify.internal/",
    "https://nas.home.arpa/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://10.0.50.10:8006/",
    "https://192.168.1.193:5432/",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::ffff:10.0.0.5]/",
    "https://[64:ff9b::a00:1]/",
    "not a url",
  ]) {
    const v = validateOutboundUrl(url, { allowHttp: true });
    assert.equal(v.ok, false, `${url} must be blocked`);
  }
});

test("validateOutboundUrl rejects http when insecure outbound is not allowed", () => {
  assert.equal(validateOutboundUrl("http://example.com/dav/", { allowHttp: false }).ok, false);
  assert.equal(validateOutboundUrl("https://example.com/dav/", { allowHttp: false }).ok, true);
  assert.equal(validateOutboundUrl("http://example.com/dav/", { allowHttp: true }).ok, true);
});

test("validateOutboundUrl allows public https hosts on any port unless defaultPortOnly", () => {
  assert.equal(validateOutboundUrl("https://dav.example.com:8443/remote.php/dav/").ok, true);
  assert.equal(validateOutboundUrl("https://contacts.icloud.com/").ok, true);
  assert.equal(
    validateOutboundUrl("https://dav.example.com:8443/a.jpg", { defaultPortOnly: true }).ok,
    false,
  );
  assert.equal(validateOutboundUrl("https://dav.example.com/a.jpg", { defaultPortOnly: true }).ok, true);
});

test("isPrivateIp covers RFC1918, loopback, link-local, CGNAT, v4-mapped, NAT64", () => {
  for (const ip of [
    "127.0.0.1", "10.0.50.10", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1",
    "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fe80::1", "::ffff:192.168.1.1",
    "64:ff9b::a00:1",
  ]) {
    assert.equal(isPrivateIp(ip), true, `${ip} must be private`);
  }
  for (const ip of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "64:ff9b::101:101"]) {
    assert.equal(isPrivateIp(ip), false, `${ip} must be public`);
  }
});
