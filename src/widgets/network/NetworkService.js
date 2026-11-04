const Service = require('../../backend/services/Service.js')
const storage = require('node-persist')
const { execFile } = require('child_process')
const dns = require('dns').promises
const fs = require('fs').promises

// Network health of the Pi: Wi-Fi signal, ping to the router and to the
// internet, DNS lookup time, dropouts over the last day and an occasional
// download speed test. Everything is measured locally; no API key needed.

const SAMPLE_INTERVAL = 30*1000
const HISTORY_SPAN = 24*60*60*1000
const CHART_SAMPLES = 60 // last 30 minutes on the main screen
const PERSIST_EVERY = 10 // samples between history saves
const INTERNET_HOST = '1.1.1.1'
// hosts the HUD's own services look up; a failing lookup here is what broke
// weather, Google and stocks during the last outage (EAI_AGAIN)
const DNS_HOSTS = ['api.openweathermap.org', 'www.googleapis.com', 'outlook.office365.com', 'api.stockdata.org']
const DNS_TIMEOUT = 5000
const SPEED_URL = 'https://speed.cloudflare.com/__down?bytes=10000000' // 10 MB
const SPEED_INTERVAL = 3*60*60*1000
const SPEED_TIMEOUT = 60*1000
const WIFI_INTERFACE = 'wlan0'

function run(cmd, args, timeout) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout }, (err, stdout) => resolve({ err, stdout: String(stdout || '') }))
  })
}

// ping three times; {ms: average round trip or null, loss: 0..1}
async function ping(host) {
  const timeoutArgs = process.platform === 'darwin' ? ['-W', '2000'] : ['-W', '2']
  const { stdout } = await run('ping', ['-c', '3', '-i', '0.3', ...timeoutArgs, host], 10000)
  const lossMatch = stdout.match(/([\d.]+)% packet loss/)
  const rttMatch = stdout.match(/= [\d.]+\/([\d.]+)\//) // min/avg/max
  return {
    ms: rttMatch ? Math.round(parseFloat(rttMatch[1])) : null,
    loss: lossMatch ? parseFloat(lossMatch[1]) / 100 : 1,
  }
}

async function defaultGateway() {
  if(process.platform === 'darwin') { // local development
    const { stdout } = await run('route', ['-n', 'get', 'default'], 3000)
    const m = stdout.match(/gateway: (\S+)/)
    return m ? m[1] : null
  }
  const { stdout } = await run('ip', ['route', 'show', 'default'], 3000)
  const m = stdout.match(/default via (\S+)/)
  return m ? m[1] : null
}

// /proc/net/wireless: "wlan0: 0000   52.  -58.  -256 ..." (quality of 70, dBm)
async function wifiSignal() {
  try {
    const text = await fs.readFile('/proc/net/wireless', 'utf8')
    const line = text.split('\n').find(l => l.trim().startsWith(WIFI_INTERFACE + ':'))
    if(!line) return null
    const parts = line.trim().split(/\s+/)
    const quality = parseFloat(parts[2])
    const dbm = parseFloat(parts[3])
    if(!Number.isFinite(quality) || !Number.isFinite(dbm)) return null
    return { quality: Math.max(0, Math.min(1, quality / 70)), dbm: Math.round(dbm) }
  } catch(e) {
    return null // not Linux, or no wireless interface
  }
}

async function dnsLookup(host) {
  const started = Date.now()
  let timer
  try {
    await Promise.race([
      dns.lookup(host),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), DNS_TIMEOUT) }),
    ])
    return { ms: Date.now() - started, ok: true, host }
  } catch(err) {
    return { ms: null, ok: false, host, error: err.code || err.message }
  } finally {
    clearTimeout(timer)
  }
}

class NetworkService extends Service {
  constructor(config, io, webApp) {
    super(config, io, webApp, 'network')
    this._loop = null
    this._history = []
    this._now = null
    this._speed = null
    this._speedRunning = false
    this._sampling = false
    this._samplesSinceSave = 0
    this._dnsIndex = 0
  }

  async start() {
    try {
      const saved = await storage.getItem('network.history')
      if(Array.isArray(saved)) {
        const cutoff = Date.now() - HISTORY_SPAN
        this._history = saved.filter(s => s && Number.isFinite(s.t) && s.t > cutoff)
      }
      const speed = await storage.getItem('network.speed')
      if(speed && Number.isFinite(speed.mbps) && Number.isFinite(speed.t)) {
        this._speed = speed
      }
    } catch(err) {
      this.logger.error('Could not restore network history: ' + err.message)
    }

    if(this._loop) clearInterval(this._loop)
    this._loop = setInterval(() => this.sample(), SAMPLE_INTERVAL)
    this.sample()
  }

  async welcomeClient(socket) {
    if(this._now) this.emit(this.payload(), socket)
  }

  async onMessage(payload) {
    if(payload && payload.action === 'speedtest') {
      this.speedTest()
    }
  }

  async sample() {
    if(this._sampling) return
    this._sampling = true
    try {
      const gatewayIp = await defaultGateway()
      const dnsHost = DNS_HOSTS[this._dnsIndex++ % DNS_HOSTS.length]
      const [wifi, gateway, internet, dnsResult] = await Promise.all([
        wifiSignal(),
        gatewayIp ? ping(gatewayIp) : Promise.resolve({ ms: null, loss: 1 }),
        ping(INTERNET_HOST),
        dnsLookup(dnsHost),
      ])

      let status = 'ok'
      if(internet.loss === 1) {
        // can't reach the internet: is it the Wi-Fi/router or further out?
        status = (!gatewayIp || gateway.loss === 1) ? 'no router' : 'offline'
      }
      else if(!dnsResult.ok) status = 'dns failing'
      else if(internet.loss > 0 || internet.ms > 150 || dnsResult.ms > 1000) status = 'slow'

      const previous = this._now
      this._now = { t: Date.now(), status, wifi, gateway, internet, dns: dnsResult }
      if(previous && (previous.status === 'ok') !== (status === 'ok')) {
        this.logger.log(`Network status ${previous.status} -> ${status}` +
          (dnsResult.ok ? '' : ` (DNS ${dnsResult.host}: ${dnsResult.error})`))
      }

      this._history.push({
        t: this._now.t,
        ms: internet.ms,
        loss: internet.loss,
        dns: dnsResult.ms,
        ok: status === 'ok' || status === 'slow',
        dbm: wifi ? wifi.dbm : null,
      })
      const cutoff = Date.now() - HISTORY_SPAN
      while(this._history.length && this._history[0].t < cutoff) this._history.shift()
      if(++this._samplesSinceSave >= PERSIST_EVERY) {
        this._samplesSinceSave = 0
        await storage.setItem('network.history', this._history)
      }

      this.emit(this.payload())

      if(status === 'ok' && !this._speedRunning && (!this._speed || Date.now() - this._speed.t > SPEED_INTERVAL)) {
        this.speedTest()
      }
    } catch(err) {
      this.logger.error('Network check failed: ' + err.message)
      this.emit({ error: 'Network check failed' })
    } finally {
      this._sampling = false
    }
  }

  async speedTest() {
    if(this._speedRunning) return
    this._speedRunning = true
    if(this._now) this.emit(this.payload())
    try {
      const started = Date.now()
      const response = await fetch(SPEED_URL, { signal: AbortSignal.timeout(SPEED_TIMEOUT) })
      if(!response.ok) throw new Error(`HTTP ${response.status}`)
      let bytes = 0
      for await (const chunk of response.body) bytes += chunk.length
      const seconds = (Date.now() - started) / 1000
      if(bytes < 1e6 || seconds <= 0) throw new Error(`only ${bytes} bytes received`)
      this._speed = { mbps: Math.round(bytes * 8 / seconds / 1e5) / 10, t: Date.now() }
      await storage.setItem('network.speed', this._speed)
    } catch(err) {
      const cause = err.cause && (err.cause.code || err.cause.message)
      this.logger.error('Speed test failed: ' + err.message + (cause ? ` (${cause})` : ''))
      this._speedFailedAt = Date.now()
    } finally {
      this._speedRunning = false
      if(this._now) this.emit(this.payload())
    }
  }

  payload() {
    // a dropout = a run of samples with no internet connection
    const drops = []
    let inDrop = false
    for(const s of this._history) {
      if(!s.ok && !inDrop) drops.push(s.t)
      inDrop = !s.ok
    }
    const recent = this._history.slice(-CHART_SAMPLES)
    const okCount = this._history.filter(s => s.ok).length
    return {
      now: this._now,
      chart: recent.map(s => s.ok ? s.ms : null),
      dropsToday: drops.length,
      lastDrop: drops.length ? drops[drops.length - 1] : null,
      uptime: this._history.length ? okCount / this._history.length : null,
      historyHours: this._history.length ? (Date.now() - this._history[0].t) / 3600000 : 0,
      speed: this._speed,
      speedRunning: this._speedRunning,
      speedFailedAt: this._speedFailedAt || null,
      error: null,
    }
  }
}

module.exports = NetworkService
