import { ACCENT } from '../../frontend/theme.js'
import TextField from '../../frontend/components/TextField'
import LineArt from '../../frontend/components/LineArt'

const CHART = { x: 30, y: -72, width: 240, height: 110, maxMs: 100 }

const textStyle = (fontSize, extra={}) => ({
  fontFamily: 'ShareTechMono',
  fontSize,
  fill: '#ffffff',
  stroke: '#ffffff',
  strokeThickness: 0.5,
  align: 'left',
  ...extra,
})

const pad2 = (n) => String(n).padStart(2, '0')
const clock = (t) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
const ms = (v) => Number.isFinite(v) ? `${v} ms` : '--'

// Main screen: current figures on the left, internet ping for the last
// 30 minutes on the right (a full-height accent bar = no response).
// Tapping "test speed" emits 'speedtest'.
export default class NetworkScreen extends PIXI.Container {
  constructor() {
    super()
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    this.progress = 0
    this.data = null
    this._drawnData = undefined

    this._labels = []
    const add = (text, x, y, fontSize, anchorX=0, extra={}) => {
      const label = new TextField(text, textStyle(fontSize, extra))
      label.anchor.set(anchorX, 0.5)
      label.x = x
      label.y = y
      this.addChild(label)
      this._labels.push(label)
      return label
    }

    this._values = {}
    ;['status', 'wi-fi', 'router ping', 'internet ping', 'dns lookup', 'dropouts', 'speed'].forEach((name, i) => {
      const y = -80 + i*25
      add(name, -270, y, 11).alpha = 0.7
      this._values[name] = add('', -145, y, 12)
    })

    // chart frame and scale
    this._grid = new LineArt()
    for(const v of [0, 50, 100]) {
      const y = CHART.y + CHART.height * (1 - v/CHART.maxMs)
      this._grid.addLine(CHART.x, y, CHART.x + CHART.width, y, 1, 0x666666)
      const label = add(String(v), CHART.x - 4, y, 10, 1)
      label.alpha = 0.7
    }
    this.addChild(this._grid)
    this._bars = new PIXI.Graphics()
    this.addChild(this._bars)
    add('internet ping, last 30 min (ms)', CHART.x + CHART.width/2, CHART.y + CHART.height + 14, 10, 0.5).alpha = 0.7

    // speed test button
    this._button = new PIXI.Container()
    this._button.x = CHART.x + CHART.width/2
    this._button.y = 82
    const frame = new PIXI.Graphics()
    frame.lineStyle({ width: 1, color: 0xffffff, alpha: 0.8 })
    frame.beginFill(0x000000, 0.01)
    frame.drawRect(-60, -12, 120, 24)
    this._button.addChild(frame)
    this._buttonLabel = new TextField('test speed', textStyle(11, { align: 'center' }))
    this._button.addChild(this._buttonLabel)
    this._button.hitArea = new PIXI.Rectangle(-70, -18, 140, 36)
    this._button.interactive = true
    this._button.cursor = 'pointer'
    this._button.on('pointertap', () => this.emit('speedtest'))
    this.addChild(this._button)
  }

  _updateTexts(d) {
    const n = d.now || {}
    const v = this._values
    v['status'].text = n.status || '--'
    v['wi-fi'].text = n.wifi ? `${n.wifi.dbm} dBm (${Math.round(100*n.wifi.quality)}%)` : 'wired / n/a'
    v['router ping'].text = n.gateway ? ms(n.gateway.ms) : '--'
    v['internet ping'].text = n.internet
      ? ms(n.internet.ms) + (n.internet.loss > 0 ? ` (${Math.round(100*n.internet.loss)}% lost)` : '')
      : '--'
    v['dns lookup'].text = n.dns ? (n.dns.ok ? ms(n.dns.ms) : 'failing') : '--'
    v['dropouts'].text = d.dropsToday
      ? `${d.dropsToday} in ${d.historyHours < 23.5 ? Math.max(1, Math.round(d.historyHours)) + ' h' : '24 h'}, last ${clock(d.lastDrop)}`
      : `none in ${d.historyHours < 23.5 ? Math.max(1, Math.round(d.historyHours)) + ' h' : '24 h'}`
    v['speed'].text = d.speedRunning ? 'testing...' : (d.speed ? `${d.speed.mbps} Mbps at ${clock(d.speed.t)}` : '--')
    this._buttonLabel.text = d.speedRunning ? 'testing...' : 'test speed'
  }

  _drawBars(chart) {
    this._bars.clear()
    if(!chart || !chart.length) return
    const step = CHART.width / 60
    // newest sample on the right
    const offset = 60 - chart.length
    chart.forEach((value, i) => {
      const x = CHART.x + (offset + i) * step + step*0.15
      if(value === null) {
        this._bars.beginFill(this._accent)
        this._bars.drawRect(x, CHART.y, step*0.7, CHART.height)
      } else {
        const h = CHART.height * Math.min(1, Math.max(0.02, value / CHART.maxMs))
        this._bars.beginFill(0xffffff, 0.75)
        this._bars.drawRect(x, CHART.y + CHART.height - h, step*0.7, h)
      }
    })
    this._bars.endFill()
  }

  render(renderer) {
    this._labels.forEach(l => l.progress = this.progress)
    this._values && Object.values(this._values).forEach(l => l.progress = this.progress)
    this._buttonLabel.progress = this.progress
    this._grid.progress = this.progress
    this._bars.alpha = this.progress
    this._button.alpha = this.progress
    this._button.visible = this.progress > 0.5

    if(this.data && this.data !== this._drawnData) {
      // only when new data arrives: changing text re-renders its texture
      this._drawnData = this.data
      this._updateTexts(this.data)
      this._drawBars(this.data.chart)
    }
    super.render(renderer)
  }
}
