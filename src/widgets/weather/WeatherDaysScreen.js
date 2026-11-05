import TextField from '../../frontend/components/TextField'
import LineArt from '../../frontend/components/LineArt'
import { ICONS, WEATHER_FONT } from './weatherIcons.js'

const style = (fontSize, extra={}) => ({
  fontFamily: 'ShareTechMono',
  fontSize,
  fill: '#ffffff',
  stroke: '#ffffff',
  strokeThickness: 0.5,
  align: 'center',
  ...extra,
})

const COLUMNS = 6
const COL_WIDTH = 95

// DAYS tab: one column per day with high, low, rain chance and a short
// forecast, laid out on a fixed grid so the rows always line up.
export default class WeatherDaysScreen extends PIXI.Container {
  constructor() {
    super()
    this.progress = 0
    this._data = null
    this._texts = []

    const add = (x, y, s, anchorY=0.5) => {
      const t = new TextField('', s)
      t.anchor.set(0.5, anchorY)
      t.x = x
      t.y = y
      this.addChild(t)
      this._texts.push(t)
      return t
    }

    this._lines = new LineArt()
    for(let i = 1; i < COLUMNS; i++) {
      const x = -COL_WIDTH*COLUMNS/2 + i*COL_WIDTH
      this._lines.addLine(x, -95, x, 62, 1, 0xffffff, 0.25)
    }
    this.addChild(this._lines)

    this._columns = Array.from({ length: COLUMNS }, (_, i) => {
      const x = -COL_WIDTH*COLUMNS/2 + (i + 0.5)*COL_WIDTH
      return {
        name: add(x, -86, style(13, { strokeThickness: 0.8 })),
        icon: add(x, -56, style(30, { fontFamily: WEATHER_FONT })),
        high: add(x, -22, style(20, { strokeThickness: 1 })),
        low: add(x, 0, style(14)),
        pop: add(x, 20, style(11)),
        short: add(x, 32, style(10, { wordWrap: true, wordWrapWidth: (COL_WIDTH - 8) / 1.1 }), 0),
      }
    })
  }

  set data(d) {
    if(d === this._data) return
    this._data = d
    const days = (d && d.daily) || []
    this._columns.forEach((col, i) => {
      const day = days[i]
      col.name.text = day ? day.name : ''
      col.icon.text = day ? (ICONS[day.icon] || '') : ''
      col.high.text = day && day.high !== null ? `${day.high}°` : (day ? '--' : '')
      col.low.text = day && day.low !== null ? `${day.low}°` : ''
      col.pop.text = day ? `rain ${Math.round(day.pop)}%` : ''
      col.pop.alpha = day && day.pop >= 30 ? 1 : 0.6
      col.short.text = day ? this._shorten(day.short) : ''
    })
  }

  // fits two lines of the column: drop whole words, not letters
  _shorten(text) {
    const words = (text || '').replace(/ then .*/i, '').split(' ')
    let t = words.join(' ')
    while(t.length > 26 && words.length > 1) {
      words.pop()
      t = words.join(' ') + '…'
    }
    return t
  }

  render(renderer) {
    this._texts.forEach(t => t.progress = this.progress)
    this._columns.forEach(c => {
      c.icon.alpha = this.progress
      c.low.alpha = 0.7 * this.progress
      c.short.alpha = 0.8 * this.progress
    })
    this._lines.progress = this.progress
    super.render(renderer)
  }
}
