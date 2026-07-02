import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { after, before, test } from "node:test";

/**
 * P38-09 — session validation cache against a minimal in-process RESP server.
 * Exercises the real ioredis client end-to-end: read/write round trip, TTL
 * argument, single-key delete, and the SCAN-based invalidate-all path.
 */

// ── tiny RESP2 server ─────────────────────────────────────────────────────────
const store = new Map<string, string>();
const commandLog: string[][] = [];

const encodeBulk = (s: string | null) =>
  s === null ? "$-1\r\n" : `$${Buffer.byteLength(s)}\r\n${s}\r\n`;

function handleCommand(parts: string[]): string {
  commandLog.push(parts);
  const cmd = parts[0]!.toUpperCase();
  switch (cmd) {
    case "INFO":
      return encodeBulk("# Server\r\nredis_version:7.0.0\r\n");
    case "PING":
      return "+PONG\r\n";
    case "GET":
      return encodeBulk(store.get(parts[1]!) ?? null);
    case "SETEX":
      store.set(parts[1]!, parts[3]!);
      return "+OK\r\n";
    case "DEL": {
      let n = 0;
      for (const key of parts.slice(1)) if (store.delete(key)) n += 1;
      return `:${n}\r\n`;
    }
    case "SCAN": {
      const matchIdx = parts.findIndex((p) => p.toUpperCase() === "MATCH");
      const pattern = matchIdx > -1 ? parts[matchIdx + 1]! : "*";
      const regex = new RegExp(
        `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
      );
      const keys = [...store.keys()].filter((k) => regex.test(k));
      return `*2\r\n${encodeBulk("0")}*${keys.length}\r\n${keys.map(encodeBulk).join("")}`;
    }
    default:
      return `-ERR unknown command '${cmd}'\r\n`;
  }
}

function attach(socket: Socket) {
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    // parse complete RESP arrays of bulk strings
    for (;;) {
      if (!buffer.startsWith("*")) break;
      const lines = buffer.split("\r\n");
      const argc = Number(lines[0]!.slice(1));
      const needed = 1 + argc * 2;
      if (lines.length < needed + 1) break; // incomplete frame
      const parts: string[] = [];
      for (let index = 0; index < argc; index += 1) parts.push(lines[2 + index * 2]!);
      buffer = lines.slice(needed).join("\r\n");
      socket.write(handleCommand(parts));
    }
  });
}

const server = createServer(attach);
let port = 0;

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as { port: number }).port;
  process.env.REDIS_URL = `redis://127.0.0.1:${port}`;
  delete process.env.SESSION_VALIDATION_CACHE;
});
after(async () => {
  server.close();
  // the shared ioredis client keeps the event loop alive — disconnect it
  const { getRedis } = await import("../../src/server/rate-limit");
  getRedis()?.disconnect();
});

test("session validation cache round-trips, expires via SETEX, invalidates by scan", async () => {
  // import AFTER REDIS_URL is set — rate-limit.ts creates the client at import
  const { readSessionValidation, writeSessionValidation, invalidateSessionValidation } =
    await import("../../src/server/session-validation-cache");

  // the shared client is lazyConnect + enableOfflineQueue:false — commands
  // before 'ready' are rejected (and swallowed by the fail-open cache), so
  // connect explicitly like a warmed production process.
  const { getRedis } = await import("../../src/server/rate-limit");
  await getRedis()!.connect();
  await getRedis()!.ping();

  const snapshot = {
    sessionVersion: 3,
    lifecycleState: "ACTIVE",
    role: "USER" as const,
    emailVerified: "2026-01-01T00:00:00.000Z",
    revoked: false,
  };

  // miss → null
  assert.equal(await readSessionValidation("userA", "sid1"), null);

  // write → read round trip
  await writeSessionValidation("userA", "sid1", snapshot);
  assert.deepEqual(await readSessionValidation("userA", "sid1"), snapshot);

  // SETEX carried the 45s TTL
  const setex = commandLog.find((c) => c[0]!.toUpperCase() === "SETEX");
  assert.ok(setex, "SETEX issued");
  assert.equal(setex![2], "45");

  // targeted invalidation removes one session, leaves the other
  await writeSessionValidation("userA", "sid2", snapshot);
  await invalidateSessionValidation("userA", "sid1");
  assert.equal(await readSessionValidation("userA", "sid1"), null);
  assert.deepEqual(await readSessionValidation("userA", "sid2"), snapshot);

  // invalidate-all sweeps every session of the user but nobody else's
  await writeSessionValidation("userA", "sid3", snapshot);
  await writeSessionValidation("userB", "sidX", snapshot);
  await invalidateSessionValidation("userA");
  assert.equal(await readSessionValidation("userA", "sid2"), null);
  assert.equal(await readSessionValidation("userA", "sid3"), null);
  assert.deepEqual(await readSessionValidation("userB", "sidX"), snapshot);
});

test("cache disabled via env flag is a no-op", async () => {
  process.env.SESSION_VALIDATION_CACHE = "off";
  const { readSessionValidation, writeSessionValidation } = await import(
    "../../src/server/session-validation-cache"
  );
  await writeSessionValidation("userC", "sid", {
    sessionVersion: 1,
    lifecycleState: "ACTIVE",
    role: "USER",
    emailVerified: null,
    revoked: false,
  });
  assert.equal(await readSessionValidation("userC", "sid"), null);
  delete process.env.SESSION_VALIDATION_CACHE;
});
