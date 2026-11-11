import { ACCENT } from '../../frontend/theme.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField'
import ProgressBar from '../../frontend/components/ProgressBar'
import LineArt from '../../frontend/components/LineArt'

const SWIPE_DISTANCE = 30 // px of vertical drag that counts as a swipe
const AMS = { x: 140, y: -66, dx: 38, dy: 44, perRow: 4, rows: 4, r: 11 }

const textStyle = (fontSize, extra={}) => ({
  fontFamily: 'ShareTechMono',
  fontSize,
  fill: '#ffffff',
  stroke: '#ffffff',
  strokeThickness: 0.5,
  align: 'left',
  ...extra,
})
const greyStyle = (fontSize, extra={}) => textStyle(fontSize, { fill: TEXT_GREY, strokeThickness: 0, ...extra })

const pad2 = (n) => String(n).padStart(2, '0')
export const clock = (t) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
export const duration = (min) => {
  if(!Number.isFinite(min)) return '--'
  const h = Math.floor(min/60), m = Math.round(min % 60)
  return h ? `${h}h ${pad2(m)}m` : `${m}m`
}
const temp = (t) => t ? `${Math.round(t.current)}°` + (t.target ? ` / ${Math.round(t.target)}°` : '') : '--'
const cut = (s, n) => s.length > n ? s.slice(0, n-1) + '…' : s

// One printer: the print on the left (file, progress, layers, time left),
// temperatures in the middle, AMS filament slots on the right (the slot in
// use has an accent ring). Swiping up or down emits 'swipe' with +1/-1.
export default class PrinterScreen extends PIXI.Container {
  constructor() {
    super()
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    this.progress = 0
    this.printer = null
    this.index = 0
    this.count = 0
    this._drawn = undefined

    this._labels = []
    const add = (text, x, y, style, anchorX=0) => {
      const label = new TextField(text, style)
      label.anchor.set(anchorX, 0.5)
      label.x = x
      label.y = y
      this.addChild(label)
      this._labels.push(label)
      return label
    }

    // left: the print
    this._name = add('', -270, -86, textStyle(13))
    this._status = add('', -270, -66, greyStyle(11))
    this._file = add('', -270, -46, textStyle(12))
    this._percent = add('', -270, -14, textStyle(30, { strokeThickness: 1 }))
    this._timeLeft = add('', -40, -20, textStyle(14), 1)
    this._doneAt = add('', -40, -4, greyStyle(11), 1)
    this._bar = new ProgressBar(23, 8)
    this._bar.x = -270
    this._bar.y = 12
    this.addChild(this._bar)
    this._layer = add('', -270, 38, greyStyle(11))
    this._extra = add('', -270, 56, greyStyle(11))

    // middle: temperatures
    this._sep = new LineArt()
    this._sep.addLine(-20, -88, -20, 72, 1, 0xffffff, 0.3)
    this._sep.addLine(120, -88, 120, 72, 1, 0xffffff, 0.3)
    this.addChild(this._sep)
    add('temps °C', -5, -86, greyStyle(11))
    this._tempNames = []
    this._tempValues = []
    for(let i = 0; i < 4; i++) {
      this._tempNames.push(add('', -5, -60 + i*36, greyStyle(10)))
      this._tempValues.push(add('', -5, -44 + i*36, textStyle(13)))
    }

    // right: AMS slots
    this._amsTitle = add('filament', AMS.x - 5, -86, greyStyle(11))
    this._slots = new PIXI.Graphics()
    this.addChild(this._slots)
    this._slotLabels = []
    for(let i = 0; i < AMS.perRow*AMS.rows; i++) {
      const l = add('', 0, 0, textStyle(10, { strokeThickness: 0 }), 0.5)
      l.scale.set(1) // small labels packed under each spool
      this._slotLabels.push(l)
    }

    this._hint = add('', 0, 90, greyStyle(10), 0.5)
    this._counter = add('', 270, 90, greyStyle(10), 1)

    // swipe area over the screen; the drag is tracked globally so a swipe
    // that ends outside the area (or is interrupted) never leaves it stuck
    this._swipeArea = new PIXI.Graphics()
    this._swipeArea.beginFill(0x000000, 0.0001)
    this._swipeArea.drawRect(-290, -100, 580, 205)
    this._swipeArea.interactive = true
    this.addChild(this._swipeArea)
    this._dragStartY = null
    this._swipeArea.on('pointerdown', (e) => { this._dragStartY = e.global.y })
    this._swipeArea.on('pointerup', (e) => this._endDrag(e.global.y))
    this._swipeArea.on('pointerupoutside', (e) => this._endDrag(e.global.y))
    this._swipeArea.on('pointercancel', () => { this._dragStartY = null })
    this.on('removed', () => { this._dragStartY = null })
  }

  _endDrag(y) {
    if(this._dragStartY === null) return
    const dy = y - this._dragStartY
    this._dragStartY = null
    if(Math.abs(dy) >= SWIPE_DISTANCE && this.count > 1) {
      this.emit('swipe', dy < 0 ? 1 : -1)
    }
  }

  _update(p) {
    const active = p.status === 'printing' || p.status === 'paused' || p.status === 'preparing'
    this._name.text = p.model && !p.name.toUpperCase().includes(p.model.toUpperCase()) ? `${p.name} · ${p.model}` : p.name
    this._counter.text = this.count > 1 ? `${this.index + 1} / ${this.count}` : ''
    this._status.text = p.status === 'offline' ? `offline: ${p.error || ''}`
      : (p.stage ? `${p.status}: ${p.stage}` : p.status)
    this._file.text = p.file ? cut(p.file, 30) : (p.status === 'offline' ? '' : 'no print')
    const showProgress = (active || p.status === 'finished' || p.status === 'failed') && Number.isFinite(p.percent)
    this._percent.text = showProgress ? `${p.percent}%` : ''
    this._bar.value = showProgress ? p.percent/100 : 0
    this._bar.visible = showProgress
    this._timeLeft.text = active && Number.isFinite(p.remainingMin) ? `${duration(p.remainingMin)} left` : ''
    this._doneAt.text = p.endTime ? `done at ${clock(p.endTime)}` : ''
    this._layer.text = showProgress && p.totalLayers ? `layer ${p.layer || 0} / ${p.totalLayers}` : ''
    const extra = []
    if(active && p.speed) extra.push(`speed: ${p.speed}`)
    if(p.startTime && active) extra.push(`started ${clock(p.startTime)}`)
    if(p.problems) extra.push(`${p.problems} warning${p.problems > 1 ? 's' : ''}`)
    this._extra.text = extra.join(' · ')

    // temperatures
    const t = p.temps || {}
    const rows = []
    const nozzles = Array.isArray(t.nozzles) ? t.nozzles : []
    nozzles.forEach((n, i) => rows.push([nozzles.length > 1 ? (i === 0 ? 'right nozzle' : 'left nozzle') : 'nozzle', n]))
    rows.push(['bed', t.bed])
    if(t.chamber) rows.push(['chamber', t.chamber])
    this._tempNames.forEach((l, i) => { l.text = rows[i] ? rows[i][0] : '' })
    this._tempValues.forEach((l, i) => { l.text = rows[i] ? temp(rows[i][1]) : '' })

    // AMS slots
    const ams = p.ams || {}
    const slots = (Array.isArray(ams.slots) ? ams.slots : []).slice(0, AMS.perRow*AMS.rows)
    this._amsTitle.text = ams.humidity && ams.humidity.length
      ? `filament · rh ${ams.humidity.join(' ')}` : 'filament'
    const g = this._slots
    g.clear()
    slots.forEach((s, i) => {
      const x = AMS.x + AMS.r + (i % AMS.perRow)*AMS.dx
      const y = AMS.y + Math.floor(i / AMS.perRow)*AMS.dy
      if(s.active) {
        g.lineStyle({ width: 2, color: this._accent, alpha: 1 })
        g.drawCircle(x, y, AMS.r + 4)
      }
      g.lineStyle({ width: 1, color: 0xffffff, alpha: s.empty ? 0.4 : 0.8 })
      if(s.empty || s.color === null) {
        g.beginFill(0x000000, 0.01)
      } else {
        g.beginFill(s.color, 1)
      }
      g.drawCircle(x, y, AMS.r)
      g.endFill()
      const label = this._slotLabels[i]
      label.x = x
      label.y = y + AMS.r + 9
      label.text = s.empty ? '--' : s.type.slice(0, 6)
    })
    this._slotLabels.forEach((l, i) => { if(i >= slots.length) l.text = '' })
    if(!slots.length) {
      const l = this._slotLabels[0]
      l.x = AMS.x + 70
      l.y = AMS.y
      l.text = p.status === 'offline' ? '' : 'no ams'
    }

    this._hint.text = this.count > 1 ? 'swipe up/down for next printer' : ''
  }

  render(renderer) {
    this._labels.forEach(l => l.progress = this.progress)
    this._bar.progress = this.progress
    this._sep.progress = this.progress
    this._slots.alpha = this.progress
    this._swipeArea.visible = this.progress > 0.5

    // only when new data arrives: changing text re-renders its texture
    if(this.printer && (this.printer !== this._drawn || this.count !== this._drawnCount)) {
      this._drawn = this.printer
      this._drawnCount = this.count
      this._update(this.printer)
    }
    super.render(renderer)
  }
}
