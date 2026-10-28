---
name: create-widget
description: Create a new Desk-HUD widget (Pixi frontend widget + Node backend service + demo data), wire it up, verify it in demo mode, and deploy it to the Pi. Use when the user asks to add, build or create a widget, panel or new data source on the HUD.
---

# Create a Desk-HUD widget

A widget is a pair that shares one string id (e.g. `'memory'`):
- **Widget** (frontend, ES modules, Pixi): `src/widgets/<id>/<Name>Widget.js`
- **Service** (backend, CommonJS, Node): `src/widgets/<id>/<Name>Service.js`

The service emits `{widgetId: id, payload}` over socket.io; `WidgetContainer` routes it to the widget's `msg2state`. The widget sends commands back with `sendMessage(payload)` → service `onMessage(payload)`.

Before writing code, ask the user only what you can't decide yourself: what data to show, where it comes from (API, Home Assistant entity, local system), and whether it needs controls. Pick sensible defaults for everything else.

## 1. Files and registration

```
src/widgets/<id>/
  index.js              export default from './<Name>Widget'
  <Name>Widget.js
  <Name>Service.js      (omit if the widget needs no backend data)
  <Screen>.js           optional extra main-screen pages
```

Register in all of these:
- `src/widgets/widgets.js` — import from `./<id>` and add to the array. Order = initial slot: index 0 is the active widget (its main screen is shown), index 1 is the second large circle, 2+ are small circles; more than 6 widgets enables rotation arrows.
- `src/widgets/services.js` — `require("./<id>/<Name>Service")` and add to the array.
- `src/frontend/demo/` — add `<Name>DemoData.js` (class with a `data` getter returning `{widgetId, payload}`), instantiate it in `DemoSocket.js`, `_publish('widget', ...)` it in the startup `setTimeout`, and handle it in `emit()` if the widget sends commands. Without this the widget is empty in demo mode.

## 2. Service template

```js
const Service = require('../../backend/services/Service.js')
const fetch = require('node-fetch')
const storage = require('node-persist')   // only if you persist history

class MemoryService extends Service {
  constructor(config, io, webApp) {
    super(config, io, webApp, 'memory')   // 4 args; id must match the widget
    this._loop = null
  }

  async start() {
    if(this._loop) clearInterval(this._loop)
    this._loop = setInterval(() => this.update(), 60*1000)
    await this.update()
  }

  async welcomeClient(socket) {         // send current state to a newly connected client
    if(this._last) this.emit(this._last, socket)
  }

  async onMessage(payload) { }          // commands from the widget

  async update() {
    try {
      const data = await this.fetchAll()
      this._last = data
      this.emit(data)
    } catch(err) {
      this.logger.error(err)
      this.emit({error: String(err.message || err)})
    }
  }
}
module.exports = MemoryService
```

Rules learned the hard way:
- **Validate external API responses** before emitting or caching them. APIs return error JSON with HTTP 200 (StockData did); passing it through crashed the widget. Throw on missing data and emit `{error}` instead.
- If you cache in `node-persist`, validate on restore too — stale bad responses survive restarts.
- `start()` must resolve; a hanging `start()` triggers "did not start" warnings in `src/backend/index.js`.
- Use `this.logger` (streams to the browser console), not `console`.

## 3. Widget template

```js
import Widget from '../../frontend/Widget.js'
import TextField from '../../frontend/components/TextField.js'

export default class MemoryWidget extends Widget {
  constructor() {
    super('memory', 'Memory')            // id, title on the circle
    this.initState({ usage: null })      // initial state; every key render() reads

    this._label = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 16,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeThickness: 0.5,
      align: 'center',
    })
    this.addChild(this._label)

    this.main.title = 'Memory Stats'     // main screen (shown when widget is active)
    // this.main.getPage(0).addChild(...)  // pages 0-2; tabs via this.main.getTabButton(i).visible = true
  }

  msg2state(msg) {
    if(msg.error) return {error: msg.error}            // shows the widget's error overlay
    if(!msg.total) return {error: 'No data available'} // guard: never assume the shape
    return { usage: 1 - msg.free / msg.total, error: null } // error: null clears a previous error
  }

  render(renderer) {
    this._label.progress = this.progress * this.dataLoadProgress
    this._label.text = this.state.usage === null ? '' : (100*this.state.usage).toFixed(1) + '%'
    this._label.style.fontSize = this.size * 8 + 7   // scale with circle size
    this._label.visible = this.size === 1            // hide detail on small circles if needed
    super.render(renderer)
  }
}
```

Key points:
- `msg2state` must never throw — an exception there breaks the socket handler for that message. Guard every nested field and return `{error}` when data is missing.
- `updateState` **merges**, so a successful state must set `error: null` or the error overlay sticks.
- `this.size` is 1 for large circles and 0.5 for small ones; scale positions and font sizes by it. The circle radius is ~100 at size 1.
- Animate with `this.progress` (appear/disappear) × `this.dataLoadProgress` (fades in when first data arrives). Most components have a `progress` setter.
- `onConfig(cfg)` receives server-pushed config, but only for keys listed in the `config` socket event in `src/backend/index.js`; add yours there if the widget needs config on the client.
- Avoid changing a `TextField`'s text every frame (each change re-renders a texture) — only set it from state.

## 4. Visual style (current theme)

- Font: `'ShareTechMono'` for all text; `'Material Symbols Outlined'` via `Icon`/`IconButton`; `'weathericons-regular-webfont'` for weather glyphs.
- Text is **white** (`'#ffffff'`). `TextField`, `ArchText` and `InfoMessage` force uppercase automatically — write strings in normal case.
- Accent color for graphics (pointers, arcs, highlights, dots): **`0x00d8ff`** (Tron blue). Lines/outlines: `0xffffff`. Chart gridlines may stay dark grey.
- Minimum `fontSize` is **10**.
- Reuse components before drawing raw `PIXI.Graphics`: `components/` (`TextField`, `ArchText` curved text, `Chart` with `style: 'bars'`, `ProgressBar`, `Icon`, `IconButton`, `Button`, `DiamondButton`, `LineArt`, `ScrollContainer`, `GaugePointer`, `Battery`, `Thermometer`) and `circles/` (`ScaleCircle`, `ProgressCircle`, `TimelineCircle`, `TickCircle`, `DotCircle`). Read a component's constructor before using it.
- Good references: `src/widgets/weather/` (API + forecast screen), `src/widgets/stocks/` (chart + error handling), `src/widgets/todo/` (list + commands back to service), `src/widgets/room/` (Home Assistant + multiple tabs).

## 5. Config

If the service needs settings or keys:
- Read with `this.config.getProp('<id>.key')` — it **throws** if the key is missing or falsy (`0`, `''`).
- Add the section to all three: local `desk-hud-config.json` (gitignored; never print its values), `desk-hud-config.default.json` (placeholders), and `doc/configuration.md`.
- The Pi's config is separate: `/home/deskhud/desk-hud-config.json` (via `DHUD_CONFIG`). Add the section there over ssh (`deskhud@deskhud.local`) before deploying, or the service fails to start. Ask the user for real secrets rather than inventing them.

## 6. Build and verify

```bash
npm run build      # frontend → src/backend/www/js/app.js (committed)
```

Backend changes are picked up by the pm2 file watcher when `npm run deploy-local` is running.

Verify in demo mode with headless Chrome (no backend needed). Use a fresh profile and `-c-1` or you'll see a cached `app.js`:

```bash
S=<scratchpad>
npx http-server -s -c-1 -p 8765 src/backend/www &   # wait until curl http://localhost:8765/ succeeds
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --use-angle=swiftshader --enable-unsafe-swiftshader --enable-logging=stderr \
  --hide-scrollbars --window-size=1480,320 --virtual-time-budget=10000 \
  --user-data-dir=$S/chrome-$RANDOM --screenshot=$S/demo.png "http://localhost:8765/#demo" 2>&1 | grep -i uncaught
pkill -f "http-server -s -c-1 -p 8765"
```

Then Read the PNG. Check: no `Uncaught` errors, the widget's circle renders with data. To see its main screen, temporarily move it to index 0 in `widgets.js` (revert after). For a readable stack trace, build unminified into the scratchpad: `npx webpack --mode development --devtool inline-source-map --output-path $S/dev/js` after copying `src/backend/www` to `$S/dev`.

Also `node -e 'require("./src/widgets/<id>/<Name>Service.js")'` to catch backend syntax errors.

## 7. Ship

Only when the user asks: commit (don't add the untracked `*.LICENSE.txt` build files), `git push origin main`, then `npm run deploy` (pulls `origin/main` on the Pi, installs, builds, reloads pm2). Confirm with:

```bash
ssh deskhud@deskhud.local 'sleep 20; pm2 jlist'   # status online, uptime growing
ssh deskhud@deskhud.local 'pm2 logs desk-hud --lines 200 --nostream' | grep -i <id>
```
