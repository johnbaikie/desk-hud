import { ACCENT } from '../../frontend/theme.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField'

// The TODAY tab. A FreeAstroAPI reading has the forecast on the left (mixed
// case, sized to fit) and on the right the overall, love, career, money and
// health scores as bars, the lucky colour, number and time, and the Moon.
// A FreeHoroscopeAPI reading (no key set, or FreeAstroAPI failing) is text
// only, across the whole panel.

const TOP = -80
const BOTTOM = 76
const FULL_WIDTH = 560
const TEXT_WIDTH = 330
const RIGHT = 74 // left edge of the right column
const SCORES = ['overall', 'love', 'career', 'money', 'health']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const pad2 = (n) => String(n).padStart(2, '0')
const clock = (t) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
function dayLabel(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '')
  if(!m) return date || ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
const field = (fontSize, fill='#ffffff', anchorX=0) => {
  const f = new TextField('', {
    fontFamily: 'ShareTechMono', fontSize, fill,
    stroke: fill, strokeThickness: fill === '#ffffff' ? 0.5 : 0,
  })
  f.anchor.set(anchorX, 0.5)
  return f
}

export default class DailyScreen extends PIXI.Container {
  constructor() {
    super()
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    this.progress = 0
    this._reading = undefined
    this._error = null
    this._fields = []
    const add = (f, x, y) => { f.x = x; f.y = y; this.addChild(f); this._fields.push(f); return f }

    this._date = add(field(11, TEXT_GREY), -FULL_WIDTH/2, TOP - 4)

    this._text = new PIXI.Text('', {
      fontFamily: 'ShareTechMono', fontSize: 14, fill: '#ffffff', wordWrap: true, wordWrapWidth: TEXT_WIDTH, lineHeight: 19,
    })
    this._text.resolution = window.devicePixelRatio || 1
    this._text.roundPixels = true
    this._text.x = -FULL_WIDTH/2
    this._text.y = TOP + 8
    this.addChild(this._text)

    // right column: score bars, then lucky things and the Moon
    this._bars = new PIXI.Graphics()
    this.addChild(this._bars)
    this._scores = SCORES.map((name, i) => {
      const y = TOP + 10 + i*17
      return {
        y,
        label: add(field(10, TEXT_GREY), RIGHT, y),
        value: add(field(11, '#ffffff', 1), 280, y),
      }
    })
    this._info = [0, 1, 2].map(i => add(field(11), RIGHT, TOP + 108 + i*17))
    this._credit = add(field(10, TEXT_GREY, 1), FULL_WIDTH/2, BOTTOM + 13)
  }

  // reading: from HoroscopeService (or null); error: why it is missing or stale
  show(reading, error) {
    if(reading === this._reading && error === this._error) return
    this._reading = reading
    this._error = error
    this._bars.clear()
    const rich = !!(reading && reading.scores && Object.keys(reading.scores).length)
    this._credit.text = !reading || reading.source !== 'freeastroapi' ? 'Powered by FreeHoroscopeAPI'
      : reading.textSource === 'freehoroscopeapi' ? 'Powered by FreeHoroscopeAPI and FreeAstroAPI'
      : 'Powered by FreeAstroAPI'

    if(!reading) {
      this._date.text = ''
      this._layout(false)
      this._fit(error ? `No reading yet: ${error}` : 'Loading...', FULL_WIDTH)
      return
    }
    const header = [dayLabel(reading.date), reading.theme, (reading.keywords || []).join(', ')].filter(Boolean)
    this._date.text = header.join('  -  ') + (error ? '  (could not update)' : '')
    this._layout(rich)
    this._fit(reading.text, rich ? TEXT_WIDTH : FULL_WIDTH)
    if(!rich) return

    // scores: label, bar out of 100, value
    SCORES.forEach((name, i) => {
      const row = this._scores[i]
      const v = reading.scores[name]
      row.label.text = name
      row.value.text = Number.isFinite(v) ? String(Math.round(v)) : '--'
      this._bars.beginFill(0xffffff, 0.15)
      this._bars.drawRoundedRect(RIGHT + 58, row.y - 3, 120, 6, 3)
      this._bars.endFill()
      if(Number.isFinite(v)) {
        this._bars.beginFill(this._accent, name === 'overall' ? 1 : 0.75)
        this._bars.drawRoundedRect(RIGHT + 58, row.y - 3, Math.max(6, 1.2*v), 6, 3)
        this._bars.endFill()
      }
    })
    const lucky = reading.lucky || {}
    const moon = reading.moon || {}
    const lines = [
      (lucky.color || Number.isFinite(lucky.number)) && `lucky  ${[lucky.color, lucky.number].filter(v => v || v === 0).join(', ')}`,
      Number.isFinite(lucky.start) && Number.isFinite(lucky.end) && `time   ${clock(lucky.start)} - ${clock(lucky.end)}`,
      (moon.sign || moon.phase) && `moon   ${[moon.phase, moon.sign && 'in ' + moon.sign].filter(Boolean).join(' ')}`,
    ].filter(Boolean)
    this._info.forEach((f, i) => { f.text = lines[i] || '' })
  }

  _layout(rich) {
    this._scores.forEach(r => { r.label.visible = rich; r.value.visible = rich })
    this._info.forEach(f => { f.visible = rich })
    this._bars.visible = rich
  }

  // the largest font size (14 down to 10) at which the text fits
  _fit(text, width) {
    const style = this._text.style
    style.wordWrapWidth = width
    for(let size = 14; size >= 10; size--) {
      style.fontSize = size
      style.lineHeight = Math.round(size * 1.35)
      if(PIXI.TextMetrics.measureText(text, style).height <= BOTTOM - (TOP + 8)) break
    }
    this._text.text = text
  }

  render(renderer) {
    this._fields.forEach(f => f.progress = this.progress)
    this._text.alpha = this.progress
    this._bars.alpha = this.progress
    super.render(renderer)
  }
}
