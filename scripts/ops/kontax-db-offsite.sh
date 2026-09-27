#!/bin/bash
# Off-host copy of the nightly kontax dump (P49A-11). Runs on the Proxmox host
# (root crontab, after the 02:00 backup on LXC 129) and copies the newest
# verified dump from the DB container onto the NAS-backed NFS storage, keeping
# $KEEP_DAYS days there. Fails (exit 1, logged) if the container has no
# successful backup in the last $MAX_AGE_HOURS hours, so a stopped backup job
# shows up in the log instead of silently ageing out. Failures also push "down"
# to the Uptime Kuma backup monitor (/etc/kontax-backup.env); success pushes
# nothing, so it can never mask a failed backup on the container.
set -euo pipefail

CT=129
SRC_DIR=/var/lib/postgresql/backups/kontax
DEST_DIR=/mnt/pve/pve-backup-nfs/kontax-db
LOG=/var/log/kontax-db-offsite.log
KEEP_DAYS=14
MAX_AGE_HOURS=26

log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }
KUMA_PUSH_URL=$(sed -n 's/^KUMA_PUSH_URL=//p' /etc/kontax-backup.env 2>/dev/null || true)
notify() {
  [ -n "$KUMA_PUSH_URL" ] || return 0
  curl -fsS -m 10 -G -o /dev/null --data-urlencode "status=$1" --data-urlencode "msg=$2" \
    --data-urlencode "ping=" "$KUMA_PUSH_URL" 2>>"$LOG" || log "WARN: alert push failed"
}
fail() { log "FAILED: $1"; notify down "kontax off-host copy FAILED: $1"; exit 1; }
trap 'rc=$?; log "FAILED (exit $rc)"; notify down "kontax off-host copy FAILED (exit $rc), see $LOG"' ERR

mkdir -p "$DEST_DIR"

# Newest dump (plain or age-encrypted) on the container.
LATEST=$(pct exec "$CT" -- sh -c "ls -1t $SRC_DIR/kontax_*.dump $SRC_DIR/kontax_*.dump.age 2>/dev/null | head -1")
if [ -z "$LATEST" ]; then
  fail "no kontax_*.dump found on CT $CT"
fi

AGE_S=$(pct exec "$CT" -- sh -c "echo \$(( \$(date +%s) - \$(stat -c %Y '$LATEST') ))")
if [ "$AGE_S" -gt $(( MAX_AGE_HOURS * 3600 )) ]; then
  fail "newest dump $(basename "$LATEST") is $(( AGE_S / 3600 ))h old — nightly backup not running?"
fi

NAME=$(basename "$LATEST")
if [ -f "$DEST_DIR/$NAME" ]; then
  log "SKIP $NAME already copied"
else
  pct pull "$CT" "$LATEST" "$DEST_DIR/$NAME.tmp"
  SRC_SIZE=$(pct exec "$CT" -- stat -c %s "$LATEST")
  DST_SIZE=$(stat -c %s "$DEST_DIR/$NAME.tmp")
  if [ "$SRC_SIZE" != "$DST_SIZE" ]; then
    rm -f "$DEST_DIR/$NAME.tmp"
    fail "size mismatch for $NAME ($SRC_SIZE vs $DST_SIZE)"
  fi
  mv "$DEST_DIR/$NAME.tmp" "$DEST_DIR/$NAME"
  chmod 600 "$DEST_DIR/$NAME"
  log "OK copied $NAME ($DST_SIZE bytes)"
fi
trap - ERR

find "$DEST_DIR" -maxdepth 1 -name 'kontax_*' -mtime +"$KEEP_DAYS" -delete
