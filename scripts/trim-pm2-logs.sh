#!/bin/sh
# Keeps pm2's logs small without the pm2-logrotate module (a resident node
# process, ~75 MB). Run hourly from cron on the Pi:
#   0 * * * * /bin/sh /var/www/current/scripts/trim-pm2-logs.sh
# Any log over 10 MB is cut down to its last 2 MB. The file is rewritten in
# place so pm2 keeps appending to the same open file.
MAX=$((10 * 1024 * 1024))
KEEP=$((2 * 1024 * 1024))
for f in "$HOME"/.pm2/logs/*.log; do
  [ -f "$f" ] || continue
  if [ "$(stat -c %s "$f")" -gt "$MAX" ]; then
    tail -c "$KEEP" "$f" > "$f.tmp" && cat "$f.tmp" > "$f"
    rm -f "$f.tmp"
  fi
done
