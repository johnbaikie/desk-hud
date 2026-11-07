# Setup of Development Environment

## Set up the project

```bash
git clone https://github.com/johnbaikie/desk-hud.git
cd desk-hud
npm i
cp desk-hud-config.default.json desk-hud-config.json
```

Fill in `desk-hud-config.json` as described in [Configuration](configuration.md).

## Run it locally

```bash
npm run deploy-local   # start the backend with pm2 (restarts on backend changes)
npm run watch          # rebuild the frontend on every change
```

Open [http://localhost:3000](http://localhost:3000). The page reloads by itself when the backend restarts. `npm run undeploy-local` stops the backend.

The compiled frontend (`src/backend/www/js/app.js`) is committed, so run `npm run build` before committing frontend changes.

## Demo mode

The demo runs the whole interface on simulated data, with no backend or config:

```bash
npm run build-demo     # builds into dist/demo
npm run serve-demo     # serves it at http://localhost:8080
```

Any build also switches to demo mode when you add `#demo` to its URL. A new widget needs demo data in `src/frontend/demo/` to appear in the demo.

Every push to `main` publishes the demo to GitHub Pages ([johnbaikie.github.io/desk-hud](https://johnbaikie.github.io/desk-hud/)) through `.github/workflows/demo.yml`.

## README screenshots

The screenshots in `doc/img/preview_*.png` come from the demo build:

```bash
npm run build-demo
node --experimental-websocket scripts/capture-screenshots.mjs              # all of them
node --experimental-websocket scripts/capture-screenshots.mjs f1 rainbow   # only names containing "f1" or "rainbow"
```

It needs Google Chrome; set `CHROME` if it is not in `/Applications`. The clock is fixed to a weekday morning so every run matches. Edit `SHOTS` in the script to add or change screens.

## Notes for contributors

[CLAUDE.md](../CLAUDE.md) summarises the architecture and conventions (widgets and services, the accent colour, text sizes, demo data), and [.claude/skills/create-widget/SKILL.md](../.claude/skills/create-widget/SKILL.md) is a step-by-step checklist for adding a widget.
