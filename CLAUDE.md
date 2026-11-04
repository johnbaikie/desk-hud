# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Desk-HUD is a side-monitor dashboard (1480×320 touch screen) running on a Raspberry Pi. A Node.js server (Express + Socket.IO) and a Pixi.js browser client run on the same device; the client is shown in a kiosk browser at `http://localhost:3000`.

## Commands

```bash
npm i                      # install deps
npm run deploy-local       # start backend via pm2 (watches files, DHUD_ENV=development)
npm run undeploy-local     # stop the local pm2 app
npm run watch              # webpack dev build of the frontend in watch mode
npm run build              # production frontend build
npm run build-demo         # build demo mode (simulated data) into dist/demo
npm run serve-demo         # serve dist/demo
npm run deploy             # pm2 deploy to the Pi (deskhud@10.168.168.159, see ecosystem.config.js)
node ./google_auth.js      # one-off Google OAuth flow; writes tokens into the config file
```

There is no test suite or linter.

Backend logs stream to the browser dev-tools console (`log` socket event), and the server uses livereload, so the page refreshes when the backend restarts.

## Configuration

The backend reads `desk-hud-config.json` from the repo root (gitignored), or the path in the `DHUD_CONFIG` env var. `desk-hud-config.default.json` is the committed template; keep it in sync when adding config keys. `.env` is loaded via dotenv. Parameters are documented in [doc/configuration.md](doc/configuration.md). `Config.getProp('a.b.c')` **throws** if a key is missing or falsy, so any new config key a service reads must exist in the config file.

## Build layout

- Webpack entry: `src/frontend/index.js` → output `src/backend/www/js/app.js`, served statically by Express.
- `build/index.html` (HTML template), `build/assets/` and `build/js/` (vendored Pixi, socket.io client, fonts) are copied into `src/backend/www/` during the build. Edit the files in `build/`, not the copies in `src/backend/www/`.
- `src/backend/www/` (including the compiled `app.js`) is committed. Rebuild after changing frontend code.
- Pixi.js and socket.io are loaded as globals (`PIXI`, `io`) from `<script>` tags, not imported.
- `BUILD_DEMO_MODE` is injected by webpack's DefinePlugin. Demo mode can also be turned on at runtime with the `#demo` URL hash.

## Architecture

Each feature is a **widget** (frontend, ES modules) paired with a **service** (backend, CommonJS), and both live together in `src/widgets/<name>/`. Both sides use the same string id to link them.

- **Registration**: frontend widgets are listed in `src/widgets/widgets.js`; backend services in `src/widgets/services.js`. `DistanceService` and `SysMonitorService` are core services that `src/backend/index.js` adds directly. They emit their own `distance` and `system` events instead of `widget`.
- **Service** (`src/backend/services/Service.js`): constructor is `super(config, io, webApp, id)`. Implement `start()` (usually a `setInterval` polling loop), `welcomeClient(socket)` (send the current state to a new client), and `onMessage(payload)` (handle commands from the client). `this.emit(payload, socket?)` sends `{widgetId, payload}` on the `widget` event. Emitting `{error: "..."}` puts the widget into its error state, and `{error: null}` clears it.
- **Widget** (`src/frontend/Widget.js`, extends `PIXI.Container`): `super(id, title)`. Override `msg2state(msg)` to map a service payload into state (`initState` / `this.state`). Override `onConfig(cfg)` for config that the server pushes in the `config` event (only `dateTime` is sent, chosen in `src/backend/index.js`). Use `sendMessage(payload)` to send commands to the service, and `render(renderer)` for per-frame drawing. Animations are driven by `this.progress`.
- **WidgetContainer** routes socket messages to widgets by id and handles layout, sleep and wake (triggered by distance events), and the system/CPU fan UI.
- **UI building blocks**: `src/frontend/components/` and `src/frontend/circles/`. These are reusable Pixi components that take a `progress` value for appear/disappear animations.
- **Text size**: every `TextField` is drawn at `TEXT_SCALE` (`components/TextField.js`) on top of its `fontSize`. Text that is space-padded to line up with a grid (forecast rows, calendar hour scale) opts out with `scale.set(1)`, and code that measures text with `PIXI.TextMetrics` must multiply by the field's `scale.x` (see `DateScreen`).
- **Accent color**: graphics use `ACCENT` from `src/frontend/theme.js`, never a color literal. It is read from `localStorage` (`DeskHud_accent`, `DeskHud_rainbow`) when the page loads. The Accent widget (`src/widgets/accent/`, no service) saves a new color or toggles rainbow mode and reloads the page, because most accents are drawn into Graphics in constructors. In rainbow mode `ACCENT` is a live binding that `index.js` switches before building each widget, so a component that uses the accent after its constructor (in `render`, a setter, or for objects created later) must copy it in the constructor (`this._accent = ACCENT`) and use the copy.
- **Demo mode**: `src/frontend/demo/DemoSocket.js` imitates the socket.io client with fake data from `*DemoData.js`. A new widget needs demo data here to show up in the demo.
- **Persistence**: services use `node-persist` (`storage.getItem/setItem`, stored in `.node-persist/`) for history data such as pomodoro history and stocks. The running pomodoro timer lives in the browser's `localStorage` (`Pomodoro_mode` is the running or next session, `Pomodoro_timerStart` is set only while one runs); only finished work sessions are sent to the service.
- **Google widgets**: `TodoService` reads every Google Tasks list (open tasks, then tasks completed in the last `COMPLETED_DAYS`) and remembers each task's list for completing it. `CalendarService` reads the calendar IDs in `google.calendars`. The Outlook widget (`src/widgets/outlook/`) reuses `CalendarWidget` with its own id; `OutlookService` reads a published ICS link (`outlook.icsUrl`) with `node-ical`, pinned to 0.25.x because newer versions need Node ≥20 and the Pi runs Node 18.

To add a widget, follow the `create-widget` skill (`.claude/skills/create-widget/SKILL.md`). It covers registration, templates, the current visual style, config and verification.

Socket events, server→client: `config`, `widget`, `distance`, `system`, `log`. Client→server: `service` with `{serviceId, payload}`.

## Hardware notes

- No distance sensor is fitted, so `DistanceService` simulates one in-process (a timer pushing a constant 20 cm reading; it used to be a separate `distance_mock.js` process). `distance.py` is the real HC-SR04 reader and is currently unused; wiring it up means spawning it again and parsing its stdout line by line.
- HDMI power is controlled with `sudo chvt` and the `/sys/class/graphics/fb0/blank` commands in `DistanceService` (Pi 5 setup).
- Pi desktop setup (not in this repo, on `deskhud@10.168.168.159`): the labwc compositor shows the WaveShare 11.9" panel (320×1480, rotated with `transform 90` in `~/.config/kanshi/config`). Touch is mapped in `~/.config/labwc/rc.xml` by device name; labwc names USB devices with their port (e.g. `WaveShare WaveShare (USB 3-2)`), so both the plain and the port name are listed. `mapToOutput` does not apply the output's 90° rotation to touch, so the same file sets `<libinput><device category="touch"><calibrationMatrix>0 -1 1 1 0 0</calibrationMatrix>`; without it taps land at transposed positions (only the right-hand widgets visibly fail). To debug touch, compare `libinput debug-events` with where the page receives the press (`app.renderer.events.rootBoundary.hitTest`); see commit 03977e1 for a throwaway tap logger. `~/.config/labwc/autostart` waits for `http://localhost:3000` and then starts Chromium in kiosk mode with `--password-store=basic`, which avoids the keyring prompt that otherwise blocks the browser (white screen) after boot. `/boot/firmware/config.txt` uses `dtoverlay=vc4-kms-v3d,cma-256` because the 2 GB Pi ran out of graphics memory with the default.
- Pi networking and processes: the Pi has a DHCP reservation at `10.168.168.159`; `deskhud.local` (mDNS) does not resolve from the Mac on this network, so ssh and `npm run deploy` use the IP. Wi-Fi power saving is disabled on the `netplan-wlan0-PB&J` connection (it caused dropouts). pm2 watches only `src/backend` and `src/widgets` (watching `.` restarted the app whenever a service saved to `.node-persist`); a change to `watch` needs `pm2 delete desk-hud && pm2 start ecosystem.config.js --env production && pm2 save`, not a reload. `pm2-logrotate` caps logs at 10 MB × 5. The Pi 5 Active Cooler is firmware-controlled; `SysMonitorService` only reads its speed from the `pwmfan` hwmon device.
