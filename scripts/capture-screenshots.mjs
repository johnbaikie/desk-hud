// Regenerates the README screenshots (doc/img/preview_*.png) from the demo
// build, at the panel's 1480x320, with the clock fixed to a weekday morning
// so calendars and the world map look the same every run.
//
//   npm run build-demo
//   node --experimental-websocket scripts/capture-screenshots.mjs
//
// Needs Google Chrome in /Applications (or CHROME=/path/to/chrome) and
// Node 20+ (Node 22+ has WebSocket without the flag).
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DEMO = path.join(ROOT, 'dist', 'demo')
const OUT = path.join(ROOT, 'doc', 'img')
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAKE_NOW = '2026-11-10T10:42:00-06:00' // a Tuesday morning in Chicago
const TIMEZONE = 'America/Chicago'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// what to capture: [file, widget id, tab, extra setup]
// [file, widget id, tab, optional JavaScript to run once the tab is shown]
const SHOTS = [
  ['preview_date.png', 'dateTime', 0],
  ['preview_time.png', 'dateTime', 1],
  ['preview_weather.png', 'weather', 0],
  ['preview_weather_days.png', 'weather', 1],
  ['preview_weather_alerts.png', 'weather', 2],
  ['preview_calendar.png', 'calendar', 0],
  ['preview_calendar_personal.png', 'calendar', 1],
  ['preview_todo.png', 'todo', 0],
  ['preview_pomodoro.png', 'pomodoro', 0],
  ['preview_stocks.png', 'stocks', 0],
  ['preview_network.png', 'network', 0],
  ['preview_f1.png', 'f1', 0],
  ['preview_f1_teams.png', 'f1', 1],
  ['preview_f1_race.png', 'f1', 2],
  ['preview_f1_results.png', 'f1', 2, `window.deskHud.widget('f1')._races._select(18); window.deskHud.widget('f1')._races._setMode('Q')`],
  ['preview_sports.png', 'sports', 0, `window.deskHud.widget('sports')._screen.select('nfl', 0)`],
  ['preview_sports_live.png', 'sports', 0, `window.deskHud.widget('sports')._screen.select('nwsl', 0)`],
  ['preview_sports_nhl.png', 'sports', 0, `window.deskHud.widget('sports')._screen.select('nhl', 0)`],
  ['preview_accent.png', 'accent', 0],
]
// optional arguments limit the run to screenshots whose names contain them,
// e.g. `... capture-screenshots.mjs f1 rainbow`
const ONLY = process.argv.slice(2)
const wanted = (file) => !ONLY.length || ONLY.some(word => file.includes(word))

// static server for dist/demo
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.css': 'text/css' }
const server = createServer(async (req, res) => {
  const file = path.join(DEMO, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'))
  if(!file.startsWith(DEMO)) { res.writeHead(403); return res.end() }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404); res.end()
  }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${server.address().port}/#demo`

const profile = await mkdtemp(path.join(tmpdir(), 'deskhud-capture-'))
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--window-size=1480,320', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => {
  let buf = ''
  chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if(m) resolve(m[1]) })
  chrome.on('exit', () => reject(new Error('Chrome exited: ' + buf.slice(-500))))
})
const port = new URL(wsUrl).port
const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(r => ws.onopen = r)
let id = 0
const pending = {}
const errors = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if(d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id] }
  if(d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)
}
const send = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1480, height: 320, deviceScaleFactor: 1, mobile: false })
await send('Emulation.setTimezoneOverride', { timezoneId: TIMEZONE })
// shift Date to FAKE_NOW (time still runs); animations use performance.now
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const offset = new Date('${FAKE_NOW}').getTime() - Date.now()
  const RealDate = Date
  class FakeDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [RealDate.now() + offset])) }
    static now() { return RealDate.now() + offset }
  }
  window.Date = FakeDate
  // start from the default accent once; keep settings across later reloads
  try { if(!sessionStorage.getItem('captureStarted')) { localStorage.clear(); sessionStorage.setItem('captureStarted', '1') } } catch(e) {}
})()` })
await send('Page.navigate', { url })
await sleep(6000)

for(const [file, widgetId, tab, setup] of SHOTS.filter(([file]) => wanted(file))) {
  const ok = await evaluate(`window.deskHud && window.deskHud.show(${JSON.stringify(widgetId)}, ${tab})`)
  if(!ok) { console.log(`skip ${file}: widget ${widgetId} not found`); continue }
  if(setup) { await sleep(800); await evaluate(setup) } // e.g. pick a view inside the tab
  await sleep(2500) // let the widgets move and the panel draw in
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(path.join(OUT, file), Buffer.from(shot.result.data, 'base64'))
  console.log('wrote', path.relative(ROOT, path.join(OUT, file)))
}

// rainbow mode: one colour per widget
if(wanted('preview_rainbow.png')) {
  await evaluate(`localStorage.setItem('DeskHud_rainbow', '1'); location.reload()`)
  await sleep(6000)
  await evaluate(`window.deskHud.show('weather', 0)`)
  await sleep(2500)
  await writeFile(path.join(OUT, 'preview_rainbow.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'))
  console.log('wrote doc/img/preview_rainbow.png')
}

if(errors.length) console.log('page errors:', errors)
ws.close()
const exited = new Promise(r => chrome.once('exit', r))
chrome.kill()
await exited // Chrome writes to its profile until it exits
server.close()
await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
