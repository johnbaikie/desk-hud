#!/bin/bash
# Daily automatic updates for the Desk-HUD Pi.
# - 23:45  refresh the package lists
# - 00:00  install all Debian and Raspberry Pi updates (not NodeSource, so
#          Node.js only changes when you choose)
# - reboot straight after, but only when an installed update needs it
#   (the HUD comes back by itself: pm2 and the kiosk start at boot)
# Run once on the Pi: sudo bash setup-auto-updates.sh (see doc/install_software.md)
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades

# "always": run on every timer trigger (a 1-day interval can skip a day when
# yesterday's run finished a few seconds after today's trigger)
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "always";
APT::Periodic::Unattended-Upgrade "always";
APT::Periodic::AutocleanInterval "7";
EOF

cat > /etc/apt/apt.conf.d/52deskhud-unattended-upgrades <<'EOF'
// Desk-HUD: install every update from Debian and Raspberry Pi, not only
// security fixes. NodeSource (Node.js) is deliberately not listed.
Unattended-Upgrade::Origins-Pattern {
  "origin=Debian,codename=${distro_codename}";
  "origin=Debian,codename=${distro_codename}-updates";
  "origin=Debian,codename=${distro_codename}-security,label=Debian-Security";
  "origin=Raspberry Pi Foundation,codename=${distro_codename}";
};
// reboot right after the midnight run, only if an update requires it; the
// desktop session counts as a logged-in user, so allow rebooting with users
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "true";
Unattended-Upgrade::Automatic-Reboot-Time "now";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

mkdir -p /etc/systemd/system/apt-daily.timer.d /etc/systemd/system/apt-daily-upgrade.timer.d
cat > /etc/systemd/system/apt-daily.timer.d/deskhud.conf <<'EOF'
[Timer]
OnCalendar=
OnCalendar=*-*-* 23:45
RandomizedDelaySec=0
EOF
cat > /etc/systemd/system/apt-daily-upgrade.timer.d/deskhud.conf <<'EOF'
[Timer]
OnCalendar=
OnCalendar=*-*-* 00:00
RandomizedDelaySec=0
EOF
systemctl daemon-reload
systemctl restart apt-daily.timer apt-daily-upgrade.timer

echo
echo "== Packages that would be upgraded now (dry run) =="
unattended-upgrade --dry-run 2>&1 | tail -n 5 || true
echo
echo "== Schedule =="
systemctl list-timers 'apt-daily*' --no-pager
echo
echo "Done. Logs: /var/log/unattended-upgrades/"
