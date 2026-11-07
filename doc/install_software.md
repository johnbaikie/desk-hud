# Install Guide - Software

Desk-HUD runs as a Node.js server on the Raspberry Pi (managed by pm2), with Chromium in kiosk mode showing it full screen. You prepare and deploy it from your own computer.

These steps match a Raspberry Pi 5 running Raspberry Pi OS (Debian 13 "trixie", 64-bit, with desktop), the labwc desktop and a user called `deskhud`. Adjust the names and addresses to yours.

## 1. Prepare the project on your computer

```bash
git clone https://github.com/johnbaikie/desk-hud.git
cd desk-hud
npm i
cp desk-hud-config.default.json desk-hud-config.json
```

Fill in `desk-hud-config.json` as described in [Configuration](configuration.md), including the one-off Google sign-in (`node ./google_auth.js`). The file holds keys and tokens, and git ignores it; keep it that way.

## 2. Set up the Raspberry Pi

1. Write **Raspberry Pi OS (64-bit)** to the microSD card with [Raspberry Pi Imager](https://www.raspberrypi.com/software/). In its settings, set the user name (`deskhud`), your Wi-Fi, and enable SSH with your public key.
2. Boot the Pi and give it a fixed address: a DHCP reservation on your router is easiest. Put that address in `ecosystem.config.js` (`deploy.production.host`); `deskhud.local` may not resolve on every network.
3. Over SSH, install Node.js 18 (the version the calendar library is pinned to), pm2 and pm2's log rotation:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2@latest
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 5
   ```

4. Create the app folder and point the server at the config file:

   ```bash
   sudo mkdir -p /var/www && sudo chown deskhud /var/www
   echo 'DHUD_CONFIG=/home/deskhud/desk-hud-config.json' | sudo tee -a /etc/environment
   ```

5. Turn off Wi-Fi power saving, which caused dropouts (find the connection name with `nmcli connection show`):

   ```bash
   sudo nmcli connection modify "<your Wi-Fi connection>" 802-11-wireless.powersave 2
   ```

6. On a 2 GB Pi, give the graphics driver more memory. In `/boot/firmware/config.txt` change the `dtoverlay=vc4-kms-v3d` line to:

   ```
   dtoverlay=vc4-kms-v3d,cma-256
   ```

## 3. Deploy

From the project folder on your computer:

```bash
scp desk-hud-config.json deskhud@<pi address>:/home/deskhud/desk-hud-config.json
npm run provision-remote   # first time only: clones the repo into /var/www on the Pi
npm run deploy             # pulls origin/main on the Pi, installs, builds and (re)starts the app
```

Then, on the Pi, make pm2 start the app at boot:

```bash
pm2 startup     # run the command it prints
pm2 save
```

`npm run deploy` deploys what is pushed to `origin/main`, so push your changes first. Run it again after every change.

## 4. Kiosk mode

`~/.config/labwc/autostart` on the Pi waits for the server, then opens Chromium full screen. `--password-store=basic` stops the keyring prompt that otherwise leaves a white screen after boot; the other flags turn off prompts and background services a kiosk does not need:

```sh
sh -c 'until curl -s -o /dev/null http://localhost:3000/; do sleep 1; done; exec chromium --kiosk --password-store=basic --noerrdialogs --disable-session-crashed-bubble --disable-infobars --no-first-run --disable-renderer-accessibility --disable-extensions --disable-component-extensions-with-background-pages --disable-background-networking --disable-component-update --disable-sync --disable-default-apps --disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication http://localhost:3000/' &
```

To leave kiosk mode, press Alt+F4.

## Display and touch

The panel is natively 320×1480 portrait. Rotate the picture in `~/.config/kanshi/config`:

```
profile {
		output HDMI-A-1 enable scale 1.000000 mode 320x1480@57.680 position 0,0 transform 90
}
```

Then map the touch input to that output in `~/.config/labwc/rc.xml`. labwc names USB devices with their port, so list both names. The calibration matrix rotates touch by the same 90°, because `mapToOutput` alone does not:

```xml
<?xml version="1.0"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <touch deviceName="WaveShare WaveShare" mapToOutput="HDMI-A-1" mouseEmulation="yes"/>
  <touch deviceName="WaveShare WaveShare (USB 3-2)" mapToOutput="HDMI-A-1" mouseEmulation="yes"/>
  <libinput>
    <device category="touch">
      <calibrationMatrix>0 -1 1 1 0 0</calibrationMatrix>
    </device>
  </libinput>
</openbox_config>
```

Log out and back in (or reboot) after changing either file. If taps land in the wrong place, compare `libinput debug-events` with where the page receives them.

## Automatic system updates

[`scripts/setup-auto-updates.sh`](../scripts/setup-auto-updates.sh) installs Debian's `unattended-upgrades` so that every night the Pi installs all Debian and Raspberry Pi updates at midnight and reboots afterwards only if an update needs it (the app and kiosk come back by themselves). Node.js is left alone. Copy it to the Pi and run it once:

```bash
scp scripts/setup-auto-updates.sh deskhud@<pi address>:
ssh -t deskhud@<pi address> sudo bash setup-auto-updates.sh
```

The nightly runs are logged in `/var/log/unattended-upgrades/` on the Pi. Desk-HUD itself is not updated automatically; deploy it with `npm run deploy`.

## Logs

The server's logs stream to the browser's developer console. On the Pi, `pm2 logs desk-hud` shows them too.
