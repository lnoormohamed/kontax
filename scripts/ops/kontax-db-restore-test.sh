#!/bin/bash
# Monthly restore test of the latest kontax dump (P49A-11). Run as the postgres
# OS user on the DB container (LXC 129). Restores the newest custom-format dump
# into a throwaway database, compares row counts of key tables with the live
# database, then drops the throwaway database. A backup that has never been
# restored is only a hope. Logs to the backup log; exits 1 on any mismatch.
set -euo pipefail
cd /

DIR=/var/lib/postgresql/backups/kontax
LOG=$DIR/backup.log
BIN=/usr/lib/postgresql/18/bin
TEST_DB=kontax_restore_test
TABLES=("User" "Contact" "SyncAccount" "Subscription" "Group" "_prisma_migrations")

log() { echo "$(date -u +%FT%TZ) restore-test $*" >> "$LOG"; }
cleanup() { "$BIN/dropdb" --if-exists "$TEST_DB" 2>>"$LOG" || true; }
trap 'log "FAILED (exit $?)"; cleanup' ERR

LATEST=$(ls -1t "$DIR"/kontax_*.dump 2>/dev/null | head -1 || true)
if [ -z "$LATEST" ]; then
  log "FAILED: no plain kontax_*.dump to test (encrypted dumps need decrypting first)"
  exit 1
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
    log "FAILED: $t restored empty (live has $live)$REPORT"
    cleanup
    exit 1
  fi
done
trap - ERR
cleanup
log "OK $(basename "$LATEST") restored and dropped; counts restored/live:$REPORT"
