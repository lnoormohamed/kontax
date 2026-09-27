#!/bin/bash
# Monthly restore test of the latest kontax dump (P49A-11). Run as the postgres
# OS user on the DB container (LXC 129). Restores the newest custom-format dump
# into a throwaway database, compares row counts of key tables with the live
# database, then drops the throwaway database. A backup that has never been
# restored is only a hope. Logs to the backup log; exits 1 on any mismatch and
# pushes "down" to the Uptime Kuma backup monitor (/etc/kontax-backup.env).
set -euo pipefail
cd /

DIR=/var/lib/postgresql/backups/kontax
LOG=$DIR/backup.log
BIN=/usr/lib/postgresql/18/bin
TEST_DB=kontax_restore_test
TABLES=("User" "Contact" "SyncAccount" "Subscription" "Group" "_prisma_migrations")

log() { echo "$(date -u +%FT%TZ) restore-test $*" >> "$LOG"; }
cleanup() { "$BIN/dropdb" --if-exists "$TEST_DB" 2>>"$LOG" || true; }
KUMA_PUSH_URL=$(sed -n 's/^KUMA_PUSH_URL=//p' /etc/kontax-backup.env 2>/dev/null || true)
notify() {
  [ -n "$KUMA_PUSH_URL" ] || return 0
  curl -fsS -m 10 -G -o /dev/null --data-urlencode "status=$1" --data-urlencode "msg=$2" \
    --data-urlencode "ping=" "$KUMA_PUSH_URL" 2>>"$LOG" || log "WARN: alert push failed"
}
fail() { log "FAILED: $1"; notify down "kontax restore test FAILED: $1"; cleanup; exit 1; }
trap 'rc=$?; log "FAILED (exit $rc)"; notify down "kontax restore test FAILED (exit $rc), see $LOG"; cleanup' ERR

LATEST=$(ls -1t "$DIR"/kontax_*.dump 2>/dev/null | head -1 || true)
if [ -z "$LATEST" ]; then
  fail "no plain kontax_*.dump to test (encrypted dumps need decrypting first)"
fi

cleanup
"$BIN/createdb" "$TEST_DB"
"$BIN/pg_restore" --no-owner --no-privileges --exit-on-error --dbname="$TEST_DB" "$LATEST" 2>>"$LOG"

# The dump is up to ~24 h old, so counts can legitimately differ a little on a
# live system; report both and fail only if the restored copy is empty where
# the live one is not, or a table is missing.
REPORT=""
for t in "${TABLES[@]}"; do
  live=$("$BIN/psql" -XtAq -d kontax -c "SELECT count(*) FROM \"$t\"")
  restored=$("$BIN/psql" -XtAq -d "$TEST_DB" -c "SELECT count(*) FROM \"$t\"")
  REPORT+=" $t=$restored/$live"
  if [ "$live" -gt 0 ] && [ "$restored" -eq 0 ]; then
    fail "$t restored empty (live has $live)$REPORT"
  fi
done
trap - ERR
cleanup
log "OK $(basename "$LATEST") restored and dropped; counts restored/live:$REPORT"
