import { ACCENT } from '../../frontend/theme.js'
import LineArt from "../../frontend/components/LineArt"
import TextField, { TEXT_GREY, TEXT_DIM } from "../../frontend/components/TextField"

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] // Monday first

const MONTH_WIDTH = 266
const COL = MONTH_WIDTH / 7
const ROW = 23
const TITLE_Y = -88
const HEADER_Y = -64
const GRID_Y = -40                       // centre of the first week row
const MONTH_X = [-148, 148]              // centres of the two months

const textStyle = (fontSize, extra={}) => ({
  fontFamily: 'ShareTechMono',
  fontSize,
  fill: '#ffffff',
  strokeThickness: 0,
  align: 'center',
  ...extra,
})

// DATE tab: this month and next as two large calendars. Today is
// highlighted in the accent colour; weekends and days already past are grey.
export default class DateScreen extends PIXI.Container {
  constructor() {
    super()
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    this.progress = 0
    this._shownDay = null
    this._texts = []

    const add = (x, y, s) => {
      const t = new TextField('', s)
      t.anchor.set(0.5)
      t.position.set(x, y)
      this.addChild(t)
      this._texts.push(t)
      return t
    }

    this._separator = new LineArt()
    this._separator.addLine(0, -96, 0, 84, 1, 0xffffff, 0.3)
    this.addChild(this._separator)

    this._today = new PIXI.Graphics()
    this.addChild(this._today)

    this._months = MONTH_X.map(cx => {
      const left = cx - MONTH_WIDTH/2
      const title = add(cx, TITLE_Y, textStyle(18, { strokeThickness: 1, stroke: '#ffffff' }))
      WEEKDAYS.forEach((d, i) => {
        add(left + (i + 0.5)*COL, HEADER_Y, textStyle(11, { fill: i >= 5 ? TEXT_DIM : TEXT_GREY })).text = d
      })
      const cells = []
      for(let r = 0; r < 6; r++) {
        for(let c = 0; c < 7; c++) {
          cells.push(add(left + (c + 0.5)*COL, GRID_Y + r*ROW, textStyle(15)))
        }
      }
      return { left, title, cells }
    })

    this._refresh()
  }

  _refresh() {
    const now = new Date()
    const dayKey = now.toDateString()
    if(dayKey === this._shownDay) return
    this._shownDay = dayKey

    const first = [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)]
    this._today.clear()
    first.forEach((start, m) => {
      const month = this._months[m]
      const year = start.getFullYear() !== now.getFullYear() ? ` ${start.getFullYear()}` : ''
      month.title.text = MONTHS[start.getMonth()] + year
      const offset = (start.getDay() + 6) % 7 // Monday-first column of the 1st
      const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
      month.cells.forEach((cell, i) => {
        const day = i - offset + 1
        if(day < 1 || day > days) {
          cell.text = ''
          return
        }
        cell.text = String(day)
        const weekend = i % 7 >= 5
        const past = m === 0 && day < now.getDate()
        const isToday = m === 0 && day === now.getDate()
        cell.style.fill = isToday ? '#000000' : (past ? TEXT_DIM : (weekend ? TEXT_GREY : '#ffffff'))
        if(isToday) {
          this._today.beginFill(this._accent)
          this._today.drawRoundedRect(cell.x - 16, cell.y - 10, 32, 20, 6)
          this._today.endFill()
        }
      })
    })
  }

  render(renderer) {
    this._refresh() // cheap unless the day has changed
    this._texts.forEach(t => t.progress = this.progress)
    this._today.alpha = this.progress
    this._separator.progress = this.progress
    super.render(renderer)
  }
}
