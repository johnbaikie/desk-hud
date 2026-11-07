import { ACCENT } from '../../frontend/theme.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField'

// The F1 widget's drivers and teams tabs (the races tab is RacesScreen). Each redraws only when new data
// arrives (changing text re-renders its texture). The panel's page spans
// about x -295..295, y -105..98.

export const style = (fontSize, extra={}) => ({
  fontFamily: 'ShareTechMono',
  fontSize,
  fill: '#ffffff',
  stroke: '#ffffff',
  strokeThickness: 0.5,
  align: 'left',
  ...extra,
})
export const greyStyle = (fontSize, extra={}) => style(fontSize, { fill: TEXT_GREY, strokeThickness: 0, ...extra })

export class Screen extends PIXI.Container {
  constructor() {
    super()
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    this.progress = 0
    this.data = null
    this._drawn = undefined
    this._fields = []
    this._bars = new PIXI.Graphics()
    this.addChild(this._bars)
  }

  _add(x, y, fontSize, anchorX=0, styleFn=style) {
    const field = new TextField('', styleFn(fontSize))
    field.anchor.set(anchorX, 0.5)
    field.x = x
    field.y = y
    this.addChild(field)
    this._fields.push(field)
    return field
  }

  _bar(x, y, width) {
    this._bars.beginFill(this._accent, 0.85)
    this._bars.drawRoundedRect(x, y - 2, Math.max(2, width), 4, 2)
    this._bars.endFill()
  }

  update() {}

  render(renderer) {
    this._fields.forEach(f => f.progress = this.progress)
    this._bars.alpha = this.progress
    if(this.data && this.data !== this._drawn) {
      this._drawn = this.data
      this._bars.clear()
      this.update(this.data)
    }
    super.render(renderer)
  }
}

// Drivers: two columns of 12 (position, name, team, points bar, points)
const DRIVER_ROWS = 12
export class DriversScreen extends Screen {
  constructor() {
    super()
    this._rows = []
    for(let i = 0; i < 2*DRIVER_ROWS; i++) {
      const x = i < DRIVER_ROWS ? -282 : 10
      const y = -86 + (i % DRIVER_ROWS)*15.5
      this._rows.push({
        x, y,
        name: this._add(x, y, 11),
        team: this._add(x + 108, y, 10, 0, greyStyle),
        points: this._add(x + 272, y, 11, 1),
      })
    }
  }

  update(d) {
    const drivers = d.drivers || []
    const top = Math.max(1, ...drivers.map(r => r.points))
    this._rows.forEach((row, i) => {
      const r = drivers[i]
      row.name.text = r ? `${String(r.pos || '').padStart(2)} ${r.name}` : ''
      row.team.text = r ? r.team : ''
      row.points.text = r ? String(r.points) : ''
      if(r) this._bar(row.x + 186, row.y, 58 * r.points/top)
    })
  }
}

// Constructors: one row per team with a long points bar
export class TeamsScreen extends Screen {
  constructor() {
    super()
    this._rows = Array.from({ length: 11 }, (_, i) => {
      const y = -86 + i*16.8
      return {
        y,
        name: this._add(-282, y, 12),
        points: this._add(212, y, 12, 1),
        wins: this._add(282, y, 10, 1, greyStyle),
      }
    })
    this._more = this._add(282, 98, 10, 1, greyStyle)
  }

  update(d) {
    const teams = d.constructors || []
    const top = Math.max(1, ...teams.map(r => r.points))
    this._rows.forEach((row, i) => {
      const r = teams[i]
      row.name.text = r ? `${String(r.pos || '').padStart(2)} ${r.name}` : ''
      row.points.text = r ? String(r.points) : ''
      row.wins.text = r && r.wins ? `${r.wins} ${r.wins === 1 ? 'win' : 'wins'}` : ''
      if(r) this._bar(-130, row.y, 300 * r.points/top)
    })
    this._more.text = teams.length > this._rows.length ? `+${teams.length - this._rows.length} more` : ''
  }
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
export const pad2 = (n) => String(n).padStart(2, '0')
export function when(t) {
  const d = new Date(t)
  return `${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2)} ${MONTHS[d.getMonth()]}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
export function countdown(ms) {
  if(ms <= 0) return 'racing now'
  const m = Math.floor(ms / 60000)
  const days = Math.floor(m / 1440)
  const h = Math.floor(m / 60) % 24
  return days ? `${days}d ${pad2(h)}h ${pad2(m % 60)}m` : `${h}h ${pad2(m % 60)}m`
}
