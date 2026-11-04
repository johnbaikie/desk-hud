export default class NetworkDemoData {
  constructor() {
    const now = Date.now()
    // 30 minutes of internet pings with one short dropout
    const chart = Array.from({ length: 60 }, (_, i) =>
      (i === 37 || i === 38) ? null : Math.round(14 + 8*Math.random() + (i % 17 === 0 ? 30 : 0)))
    this._payload = {
      now: {
        t: now,
        status: 'ok',
        wifi: { quality: 0.74, dbm: -58 },
        gateway: { ms: 3, loss: 0 },
        internet: { ms: 18, loss: 0 },
        dns: { ms: 24, ok: true, host: 'api.openweathermap.org' },
      },
      chart,
      dropsToday: 2,
      lastDrop: now - 11*60*1000,
      uptime: 0.997,
      historyHours: 24,
      speed: { mbps: 84.2, t: now - 50*60*1000 },
      speedRunning: false,
      speedFailedAt: null,
      error: null,
    }
  }

  get data() {
    return { widgetId: 'network', payload: this._payload }
  }

  // demo speed test: "runs" for two seconds
  onMessage(payload, publish) {
    if(!payload || payload.action !== 'speedtest' || this._payload.speedRunning) return
    this._payload = { ...this._payload, speedRunning: true }
    publish()
    setTimeout(() => {
      this._payload = { ...this._payload, speedRunning: false, speed: { mbps: Math.round(700 + 300*Math.random())/10, t: Date.now() } }
      publish()
    }, 2000)
  }
}
