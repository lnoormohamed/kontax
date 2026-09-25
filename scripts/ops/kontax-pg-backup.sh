#!/bin/sh
# Nightly logical backup of the kontax database (run as the postgres OS user).
# Replaces a crontab entry that was malformed (two jobs on one line with a
# literal "\n" and doubled backslashes before %), so it had never run as
# intended. Writes a dated gzip dump over the local socket, logs, and prunes
# dumps older than 30 days. To enable at-rest encryption see
# roadmap/runbooks/db-restore.md "Backup encryption (P48-17)": set AGE_RECIPIENT
# to the age public key and the dump is piped through `age` before touching disk.
set -u
cd / || exit 1
DIR=/var/lib/postgresql/backups/kontax
LOG=$DIR/backup.log
PGDUMP=/usr/lib/postgresql/18/bin/pg_dump
AGE_RECIPIENT="${AGE_RECIPIENT:-}"
DAY=$(date +%Y%m%d)
mkdir -p "$DIR"
if [ -n "$AGE_RECIPIENT" ] && command -v age >/dev/null 2>&1; then
  OUT=$DIR/kontax_$DAY.sql.gz.age
  if $PGDUMP -d kontax | gzip | age -r "$AGE_RECIPIENT" > "$OUT.tmp" 2>>"$LOG"; then
    mv "$OUT.tmp" "$OUT"
  else
    rm -f "$OUT.tmp"; echo "$(date -u +%FT%TZ) FAILED (encrypted)" >> "$LOG"; exit 1
  fi
else
  OUT=$DIR/kontax_$DAY.sql.gz
  if $PGDUMP -d kontax | gzip > "$OUT.tmp" 2>>"$LOG" && gzip -t "$OUT.tmp"; then
    mv "$OUT.tmp" "$OUT"
  else
    rm -f "$OUT.tmp"; echo "$(date -u +%FT%TZ) FAILED" >> "$LOG"; exit 1
  fi
fi
echo "$(date -u +%FT%TZ) OK $(basename "$OUT") $(stat -c %s "$OUT") bytes" >> "$LOG"
find "$DIR" -name 'kontax_*.sql.gz' -mtime +30 -delete
find "$DIR" -name 'kontax_*.sql.gz.age' -mtime +30 -delete
