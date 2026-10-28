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
npm run deploy             # pm2 deploy to the Pi (deskhud@deskhud.local, see ecosystem.config.js)
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
- **Widget** (`src/frontend/Widget.js`, extends `PIXI.Container`): `super(id, title)`. Override `msg2state(msg)` to map a service payload into state (`initState` / `this.state`). Override `onConfig(cfg)` for config that the server pushes in the `config` event (only `dateTime` and `webcam` are sent, chosen in `src/backend/index.js`). Use `sendMessage(payload)` to send commands to the service, and `render(renderer)` for per-frame drawing. Animations are driven by `this.progress`.
- **WidgetContainer** routes socket messages to widgets by id and handles layout, sleep and wake (triggered by distance events), and the system/CPU fan UI.
- **UI building blocks**: `src/frontend/components/` and `src/frontend/circles/`. These are reusable Pixi components that take a `progress` value for appear/disappear animations.
- **Demo mode**: `src/frontend/demo/DemoSocket.js` imitates the socket.io client with fake data from `*DemoData.js`. A new widget needs demo data here to show up in the demo.
- **Persistence**: services use `node-persist` (`storage.getItem/setItem`, stored in `.node-persist/`) for history data such as pomodoro history, room temperature, and stocks.

To add a widget, follow the `create-widget` skill (`.claude/skills/create-widget/SKILL.md`). It covers registration, templates, the current visual style, config and verification.

Socket events, server→client: `config`, `widget`, `distance`, `system`, `log`. Client→server: `service` with `{serviceId, payload}`.

## Hardware notes

- The distance sensor always uses the mock (`src/backend/distance_mock.js`) because no GPIO sensor is installed. `distance.py` is the real HC-SR04 reader and is currently unused. `DistanceService` reads numbers from the child process's stdout and respawns it if the data goes stale.
- HDMI power is controlled with `sudo chvt` and the `/sys/class/graphics/fb0/blank` commands in `DistanceService` (Pi 5 setup).
- `WebcamService` uses ffmpeg to transcode an RTSP stream into HLS segments in `src/backend/www/hls/` (gitignored, and excluded from pm2's file watching).
