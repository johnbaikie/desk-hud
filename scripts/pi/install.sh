#!/bin/bash
# Run on the Pi from this folder: sudo ./install.sh
set -e
cd "$(dirname "$0")"
install -m 755 wifi-watchdog.sh /usr/local/sbin/wifi-watchdog
install -m 644 wifi-watchdog.service wifi-watchdog.timer /etc/systemd/system/
mkdir -p /etc/systemd/journald.conf.d /var/log/journal
install -m 644 journald-persistent.conf /etc/systemd/journald.conf.d/50-persistent.conf
systemd-tmpfiles --create --prefix /var/log/journal
systemctl restart systemd-journald
journalctl --flush # move the journal from /run to /var/log/journal now, not at the next boot
systemctl daemon-reload
systemctl enable --now wifi-watchdog.timer
echo "Installed. Logs: journalctl -t wifi-watchdog"
