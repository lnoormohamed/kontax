// P44-02/03/04 — pure selftest for the photo change-detection decision table.
// No DB, no network, no image work. Proves docs/adr/0001 §4 + the no-loop
// guarantee (§6). Run: npm run qa:phase44:photo-decision
//
// Exits non-zero on the first failed assertion.

import {
  classifyLocal,
  classifyRemote,
  decidePhotoAction,
  parsePhotoShadow,
  type PhotoAction,
  type PhotoShadow,
  type SideChange,
} from "../src/server/contact-photo-sync.ts";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(`✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${label}`);
  }
};

const BOTH = { canPull: true, canPush: true };

// ── The full 4×4 table (docs/adr/0001 §4), both directions allowed ───────────
const TABLE: Record<SideChange, Record<SideChange, PhotoAction>> = {
  absent: { absent: "noop", same: "noop", changed: "pull", deleted: "noop" },
  same: { absent: "noop", same: "noop", changed: "pull", deleted: "pull-delete" },
  changed: { absent: "push", same: "push", changed: "conflict", deleted: "conflict" },
  deleted: { absent: "noop", same: "push-delete", changed: "conflict", deleted: "noop" },
};
const SIDES: SideChange[] = ["absent", "same", "changed", "deleted"];
for (const l of SIDES) {
  for (const r of SIDES) {
    check(`table ${l}×${r}`, decidePhotoAction(l, r, BOTH), TABLE[l][r]);
  }
}

// ── Direction gating: a write the direction disallows degrades to noop ────────
check("pull blocked when canPull=false", decidePhotoAction("same", "changed", { canPull: false, canPush: true }), "noop");
check("pull-delete blocked when canPull=false", decidePhotoAction("same", "deleted", { canPull: false, canPush: true }), "noop");
check("push blocked when canPush=false", decidePhotoAction("changed", "same", { canPull: true, canPush: false }), "noop");
check("push-delete blocked when canPush=false", decidePhotoAction("deleted", "same", { canPull: true, canPush: false }), "noop");
check("conflict always surfaces", decidePhotoAction("changed", "changed", { canPull: false, canPush: false }), "conflict");
check("photo-excluded → noop", decidePhotoAction("changed", "same", { canPull: false, canPush: false }), "noop");

// ── classifyLocal ────────────────────────────────────────────────────────────
check("local: photo, matches shadow → same", classifyLocal(true, true, true), "same");
check("local: photo, differs → changed", classifyLocal(true, false, true), "changed");
check("local: new photo, no prior → changed", classifyLocal(true, false, false), "changed");
check("local: gone, shadow had one → deleted", classifyLocal(false, false, true), "deleted");
check("local: none, no shadow → absent", classifyLocal(false, false, false), "absent");

// ── classifyRemote (signal compare) ──────────────────────────────────────────
const shadow = (over: Partial<PhotoShadow>): PhotoShadow => ({
  signalKind: "contentHash",
  remoteSignal: null,
  remoteCanonicalHash: null,
  localAvatarUrl: null,
  localPhotoHash: null,
  lastSyncedRemoteAt: null,
  lastPushRejected: false,
  ...over,
});
check("remote: signal matches → same", classifyRemote({ hasPhoto: true, signal: "abc" }, shadow({ remoteSignal: "abc" })), "same");
check("remote: signal differs → changed", classifyRemote({ hasPhoto: true, signal: "xyz" }, shadow({ remoteSignal: "abc" })), "changed");
check("remote: new photo, no shadow → changed", classifyRemote({ hasPhoto: true, signal: "abc" }, null), "changed");
check("remote: gone, shadow had one → deleted", classifyRemote({ hasPhoto: false, signal: null }, shadow({ remoteSignal: "abc" })), "deleted");
check("remote: none, no shadow → absent", classifyRemote({ hasPhoto: false, signal: null }, null), "absent");

// ── No-loop guarantee (§6): after a push/pull seeded the shadow, a no-change
//    cycle is a noop for both provider signal kinds ────────────────────────────
for (const kind of ["contentHash", "resourceIdentifier"] as const) {
  const seeded = shadow({ signalKind: kind, remoteSignal: "SEED", localAvatarUrl: "u", localPhotoHash: "H" });
  const local = classifyLocal(true, true, true); // avatarUrl === shadow.localAvatarUrl
  const remote = classifyRemote({ hasPhoto: true, signal: "SEED" }, seeded); // provider returns the seeded signal
  check(`no-loop (${kind}): cycle 1`, decidePhotoAction(local, remote, BOTH), "noop");
  check(`no-loop (${kind}): cycle 2`, decidePhotoAction(local, remote, BOTH), "noop");
}

// ── parsePhotoShadow tolerance ───────────────────────────────────────────────
check("parse: junk → null", parsePhotoShadow({ foo: 1 }), null);
check("parse: null → null", parsePhotoShadow(null), null);
check(
  "parse: valid round-trips signalKind",
  parsePhotoShadow({ signalKind: "contentHash", remoteSignal: "s" })?.remoteSignal,
  "s",
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll photo-decision selftests passed.");
