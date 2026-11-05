import { ACCENT } from '../../frontend/theme.js'
import TextField from '../../frontend/components/TextField'
import LineArt from '../../frontend/components/LineArt'
import { ICONS, WEATHER_FONT } from './weatherIcons.js'

const style = (fontSize, extra={}) => ({
  fontFamily: 'ShareTechMono',
  fontSize,
  fill: '#ffffff',
  stroke: '#ffffff',
  strokeThickness: 0.5,
  align: 'left',
  ...extra,
})

const pad2 = (n) => String(n).padStart(2, '0')
const hhmm = (t) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
const HOUR_COLUMNS = 7 // now and every 2 hours to +12 h
const ALERT_BOX = { x: 105, y: -95, width: 180, height: 90 }

// NOW tab: current conditions (left), today's figures (middle), alert
// summary (right; tapping it emits 'showAlerts'), and the next 12 hours.
export default class WeatherNowScreen extends PIXI.Container {
  constructor() {
    super()
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    this.progress = 0
    this._data = null
    this._texts = []

    const add = (text, x, y, s, anchorX=0, anchorY=0.5) => {
      const t = new TextField(text, s)
      t.anchor.set(anchorX, anchorY)
      t.x = x
      t.y = y
      this.addChild(t)
      this._texts.push(t)
      return t
    }

    // current conditions
    this._icon = add('', -248, -60, style(44, { fontFamily: WEATHER_FONT, align: 'center' }), 0.5)
    this._temp = add('', -205, -60, style(40, { strokeThickness: 1 }))
    this._description = add('', -280, -16, style(13, { wordWrap: true, wordWrapWidth: 165 }))

    // today's figures
    this._figures = {}
    ;['24 h hi / lo', 'feels like', 'wind', 'humidity'].forEach((name, i) => {
      const y = -84 + i*22
      add(name, -85, y, style(11)).alpha = 0.7
      this._figures[name] = add('', 15, y, style(13))
    })

    // alert summary box
    this._alertBox = new PIXI.Graphics()
    this._alertBox.hitArea = new PIXI.Rectangle(ALERT_BOX.x, ALERT_BOX.y, ALERT_BOX.width, ALERT_BOX.height)
    this._alertBox.on('pointertap', () => this.emit('showAlerts'))
    this.addChild(this._alertBox)
    const wrap = { wordWrap: true, wordWrapWidth: (ALERT_BOX.width - 20) / 1.1 }
    this._alertTitle = add('', ALERT_BOX.x + 10, ALERT_BOX.y + 8, style(13, { strokeThickness: 0.8, ...wrap }), 0, 0)
    this._alertDetail = add('', ALERT_BOX.x + 10, ALERT_BOX.y + 52, style(11, wrap), 0, 0)

    // next hours
    this._separator = new LineArt()
    this._separator.addLine(-285, 0, 285, 0, 1, 0xffffff, 0.4)
    this.addChild(this._separator)
    this._columns = Array.from({ length: HOUR_COLUMNS }, (_, i) => {
      const x = -255 + i*85
      return {
        time: add('', x, 12, style(11, { align: 'center' }), 0.5),
        icon: add('', x - 17, 35, style(22, { fontFamily: WEATHER_FONT, align: 'center' }), 0.5),
        temp: add('', x + 2, 35, style(15)),
        pop: add('', x, 58, style(10, { align: 'center' }), 0.5),
      }
    })
  }

  set data(d) {
    if(d === this._data) return
    this._data = d
    if(!d || !d.current) return
    const deg = d.units === 'imperial' ? '°f' : '°c'
    const speed = d.units === 'imperial' ? 'mph' : 'km/h'
    const c = d.current

    this._icon.text = ICONS[c.icon] || ''
    this._temp.text = `${c.temp}${deg}`
    this._description.text = (c.description || '').substring(0, 40)

    const f = this._figures
    f['24 h hi / lo'].text = d.range ? `${d.range.high}° / ${d.range.low}°` : '--'
    f['feels like'].text = Number.isFinite(c.feelsLike) ? `${c.feelsLike}${deg}` : '--'
    f['wind'].text = c.wind === null || c.wind === undefined ? '--' : (c.wind === 0 ? 'calm' : `${c.wind} ${speed} ${c.windDir || ''}`)
    f['humidity'].text = Number.isFinite(c.humidity) ? `${c.humidity}%` : '--'

    this._drawAlertBox(d.alerts || [], d.alertsOk)

    const hours = (d.hourly || []).filter((_, i) => i % 2 === 0).slice(0, HOUR_COLUMNS)
    this._columns.forEach((col, i) => {
      const h = hours[i]
      col.time.text = h ? (i === 0 ? 'now' : hhmm(h.t)) : ''
      col.icon.text = h ? (ICONS[h.icon] || '') : ''
      col.temp.text = h ? `${Math.round(h.temp)}°` : ''
      col.pop.text = h ? `rain ${Math.round(h.pop)}%` : ''
      col.pop.alpha = h && h.pop >= 30 ? 1 : 0.6
    })
  }

  _drawAlertBox(alerts, alertsOk) {
    const { x, y, width, height } = ALERT_BOX
    const g = this._alertBox
    g.clear()
    if(alerts.length) {
      const a = alerts[0]
      g.beginFill(this._accent, 0.15)
      g.lineStyle({ width: 2, color: this._accent })
      g.drawRect(x, y, width, height)
      g.endFill()
      this._alertTitle.text = '! ' + a.event
      const until = a.ends ? 'until ' + this._when(a.ends) : ''
      const more = alerts.length > 1 ? ` (+${alerts.length - 1} more)` : ''
      this._alertDetail.text = `${until}${more}\ntap for details`
      g.interactive = true
      g.cursor = 'pointer'
    } else {
      g.lineStyle({ width: 1, color: 0xffffff, alpha: 0.3 })
      g.drawRect(x, y, width, height)
      this._alertTitle.text = alertsOk === false ? 'alerts unavailable' : 'no weather alerts'
      this._alertDetail.text = 'national weather service'
      g.interactive = false
    }
  }

  _when(t) {
    const d = new Date(t)
    const sameDay = d.toDateString() === new Date().toDateString()
    return sameDay ? hhmm(t) : `${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()]} ${hhmm(t)}`
  }

  render(renderer) {
    this._texts.forEach(t => t.progress = this.progress)
    this._icon.alpha = this.progress
    this._columns.forEach(c => c.icon.alpha = this.progress)
    this._separator.progress = this.progress
    this._alertBox.alpha = this.progress
    this._alertTitle.alpha = this.progress
    this._alertDetail.alpha = 0.8 * this.progress
    super.render(renderer)
  }
}
