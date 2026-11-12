#!/bin/bash
# Keeps the Pi's Wi-Fi up (run as root every 30 s by wifi-watchdog.timer).
# While the router stops answering on wlan0 it steps up, writing each step
# to the journal (journalctl -t wifi-watchdog):
#   2 failed checks (~1 min):  reconnect wlan0 with NetworkManager
#   4 failed checks (~2 min):  reload the brcmfmac Wi-Fi driver
#   8 failed checks (~4 min):  reboot, at most once every 6 hours and only
#                              15 minutes or more after boot
# Nothing happens while Ethernet is plugged in.
IFACE=wlan0
STATE=/run/wifi-watchdog
LAST_REBOOT=/var/lib/wifi-watchdog-reboot
mkdir -p "$STATE"
log() { logger -t wifi-watchdog "$*"; }

if [ "$(cat /sys/class/net/eth0/carrier 2>/dev/null)" = 1 ]; then
  rm -f "$STATE/fails"
  exit 0
fi

gw=$(ip -4 route show default dev "$IFACE" 2>/dev/null | awk '{print $3; exit}')
[ -z "$gw" ] && gw=$(cat "$STATE/gw" 2>/dev/null)
if [ -n "$gw" ] && ping -c 3 -W 2 -I "$IFACE" "$gw" >/dev/null 2>&1; then
  echo "$gw" > "$STATE/gw"
  if [ -f "$STATE/fails" ]; then
    log "back online after $(cat "$STATE/fails") failed checks"
    rm -f "$STATE/fails"
  fi
  exit 0
fi

fails=$(( $(cat "$STATE/fails" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$STATE/fails"
log "check $fails failed (router ${gw:-unknown}); $(nmcli -t -f DEVICE,STATE,CONNECTION dev | grep "^$IFACE:")"

if [ "$fails" -eq 2 ]; then
  log "signal: $(grep "$IFACE" /proc/net/wireless | tr -s ' ')"
  dmesg | grep -i brcmf | tail -20 | logger -t wifi-watchdog
  log "reconnecting $IFACE"
  nmcli device disconnect "$IFACE"
  sleep 2
  nmcli device connect "$IFACE"
elif [ "$fails" -eq 4 ]; then
  dmesg | grep -i brcmf | tail -20 | logger -t wifi-watchdog
  log "reloading the Wi-Fi driver"
  nmcli device disconnect "$IFACE"
  modprobe -r brcmfmac_cyw brcmfmac
  sleep 2
  modprobe brcmfmac
  sleep 10
  nmcli device connect "$IFACE"
elif [ "$fails" -ge 8 ]; then
  uptime_s=$(cut -d. -f1 /proc/uptime)
  last=$(cat "$LAST_REBOOT" 2>/dev/null || echo 0)
  now=$(date +%s)
  if [ "$uptime_s" -gt 900 ] && [ $((now - last)) -gt 21600 ]; then
    log "still offline after $fails checks: rebooting"
    echo "$now" > "$LAST_REBOOT"
    systemctl reboot
  fi
fi
