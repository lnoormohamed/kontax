#!/bin/bash
# Nightly logical backup of the kontax database (run as the postgres OS user,
# from its crontab on the DB container, LXC 129). P49A-11:
#  - any failure in the pipeline fails the run (pipefail), so a pg_dump that
#    dies half-way can never leave a truncated file logged as OK;
#  - the dump is PostgreSQL's custom format (compressed, restorable with
#    pg_restore) and is verified with `pg_restore -l` before it replaces
#    anything;
#  - if AGE_RECIPIENT is set but `age` isn't installed, the run fails loudly
#    instead of silently writing plaintext;
#  - writes $DIR/last-success (UTC timestamp) for monitoring and the off-host
#    copy (scripts/ops/kontax-db-offsite.sh on the Proxmox host);
#  - reports to the Uptime Kuma push monitor in /etc/kontax-backup.env: up on
#    success, down on any failure. The monitor's 26 h heartbeat also catches a
#    job that never ran.
# Restore: roadmap/runbooks/db-restore.md.
set -euo pipefail
cd /

DIR=/var/lib/postgresql/backups/kontax
LOG=$DIR/backup.log
BIN=/usr/lib/postgresql/18/bin
AGE_RECIPIENT="${AGE_RECIPIENT:-}"
RETENTION_DAYS=30
STAMP=$(date -u +%Y%m%d)
START=$(date +%s)

mkdir -p "$DIR"
log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }

# Alerting: push to Uptime Kuma. The URL is read, not sourced, from a
# root-owned file; a monitoring hiccup never fails the backup itself.
KUMA_PUSH_URL=$(sed -n 's/^KUMA_PUSH_URL=//p' /etc/kontax-backup.env 2>/dev/null || true)
notify() {
  [ -n "$KUMA_PUSH_URL" ] || return 0
  curl -fsS -m 10 -G -o /dev/null --data-urlencode "status=$1" --data-urlencode "msg=$2" \
    --data-urlencode "ping=" "$KUMA_PUSH_URL" 2>>"$LOG" || log "WARN: alert push failed"
}
fail() { log "FAILED: $1"; notify down "kontax backup FAILED: $1"; exit 1; }

OUT=$DIR/kontax_$STAMP.dump
TMP=$OUT.tmp
trap 'rc=$?; rm -f "$TMP" "$TMP.age"; log "FAILED (exit $rc)"; notify down "kontax backup FAILED (exit $rc), see $LOG"' ERR

if [ -n "$AGE_RECIPIENT" ] && ! command -v age >/dev/null 2>&1; then
  fail "AGE_RECIPIENT is set but age is not installed — refusing to write an unencrypted dump"
fi

"$BIN/pg_dump" --format=custom --compress=9 --file="$TMP" kontax 2>>"$LOG"
# A dump whose table of contents can't be read is not a backup.
"$BIN/pg_restore" --list "$TMP" > /dev/null 2>>"$LOG"

if [ -n "$AGE_RECIPIENT" ]; then
  age -r "$AGE_RECIPIENT" -o "$TMP.age" "$TMP" 2>>"$LOG"
  rm -f "$TMP"
  mv "$TMP.age" "$OUT.age"
  FINAL=$OUT.age
else
  mv "$TMP" "$OUT"
  FINAL=$OUT
fi
trap - ERR

SUMMARY="$(basename "$FINAL") $(stat -c %s "$FINAL") bytes in $(( $(date +%s) - START ))s"
log "OK $SUMMARY"
date -u +%FT%TZ > "$DIR/last-success"
notify up "OK $SUMMARY"

# Retention: new custom-format dumps and the older .sql.gz generation.
find "$DIR" -maxdepth 1 \( -name 'kontax_*.dump' -o -name 'kontax_*.dump.age' \
  -o -name 'kontax_*.sql.gz' -o -name 'kontax_*.sql.gz.age' \) -mtime +"$RETENTION_DAYS" -delete
