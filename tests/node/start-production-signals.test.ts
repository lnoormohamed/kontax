import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// P49A-04: scripts/runtime/start-production.mjs is PID 1 in the container. It
// must run `node server.mjs` as its direct child, forward SIGTERM/SIGINT to
// it, and exit with the child's status — otherwise `docker stop` never reaches
// server.mjs's graceful shutdown. Exercised against a stand-in server.mjs in a
// temp directory (KONTAX_SCHEMA_MODE=skip, so no database is touched).

const START_SCRIPT = fileURLToPath(
  new URL("../../scripts/runtime/start-production.mjs", import.meta.url),
);

const runWithFakeServer = async (
  fakeServerSource: string,
  { signal }: { signal?: NodeJS.Signals } = {},
) => {
  const dir = mkdtempSync(path.join(tmpdir(), "kontax-start-"));
  writeFileSync(path.join(dir, "server.mjs"), fakeServerSource);
  try {
    const child = spawn(process.execPath, [START_SCRIPT], {
      cwd: dir,
      env: { ...process.env, KONTAX_SCHEMA_MODE: "skip", KONTAX_DEPLOY_ENV: "staging" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    if (signal) {
      // Wait for the stand-in server to be up, then signal PID "1".
      const deadline = Date.now() + 10_000;
      while (!output.includes("fake server ready") && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(output.includes("fake server ready"), `server never started:\n${output}`);
      child.kill(signal);
    }

    const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
    return { code, output, startScriptPid: child.pid };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const GRACEFUL_SERVER = `
console.log("fake server ready pid=" + process.pid + " ppid=" + process.ppid);
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log("fake server got " + signal);
    setTimeout(() => {
      console.log("fake server drained");
      process.exit(0);
    }, 150);
  });
}
setInterval(() => {}, 1000);
`;

test("SIGTERM to the start script reaches server.mjs, which drains and exits 0", async () => {
  const { code, output } = await runWithFakeServer(GRACEFUL_SERVER, { signal: "SIGTERM" });
  assert.match(output, /Received SIGTERM; forwarding to the Kontax server/);
  assert.match(output, /fake server got SIGTERM/);
  assert.match(output, /fake server drained/);
  assert.equal(code, 0);
});

test("SIGINT is forwarded too", async () => {
  const { code, output } = await runWithFakeServer(GRACEFUL_SERVER, { signal: "SIGINT" });
  assert.match(output, /fake server got SIGINT/);
  assert.equal(code, 0);
});

test("the start script exits with the server's exit code", async () => {
  const { code, output } = await runWithFakeServer(`console.log("boom"); process.exit(3);`);
  assert.match(output, /Kontax server exited with code 3/);
  assert.equal(code, 3);
});

test("server.mjs is the start script's direct child", async () => {
  const { output, startScriptPid } = await runWithFakeServer(`
console.log("fake server ready pid=" + process.pid + " ppid=" + process.ppid);
process.exit(0);
`);
  const match = /ppid=(\d+)/.exec(output);
  assert.ok(match, output);
  // No npm / sh layer in between: the server's parent is the start script.
  assert.equal(Number(match[1]), startScriptPid);
});
