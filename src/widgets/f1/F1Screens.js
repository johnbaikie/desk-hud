import { ACCENT } from '../../frontend/theme.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField'
import F1Car from './F1Car.js'

// The F1 widget's three main-screen tabs. Each redraws only when new data
// arrives (changing text re-renders its texture). The panel's page spans
// about x -295..295, y -105..98.

const style = (fontSize, extra={}) => ({
  fontFamily: 'ShareTechMono',
  fontSize,
  fill: '#ffffff',
  stroke: '#ffffff',
  strokeThickness: 0.5,
  align: 'left',
  ...extra,
})
const greyStyle = (fontSize, extra={}) => style(fontSize, { fill: TEXT_GREY, strokeThickness: 0, ...extra })

class Screen extends PIXI.Container {
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
const pad2 = (n) => String(n).padStart(2, '0')
function when(t) {
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

// Next race: name, place and round on the left with a countdown to the
// start; the weekend's sessions in local time on the right
const SESSION_ROWS = 6
export class RaceScreen extends Screen {
  constructor() {
    super()
    this._name = this._add(-280, -82, 18)
    this._circuit = this._add(-280, -56, 11, 0, greyStyle)
    this._place = this._add(-280, -39, 11, 0, greyStyle)
    this._round = this._add(-280, -14, 12)
    this._countdown = this._add(-280, 34, 28)
    this._countdownLabel = this._add(-280, 62, 11, 0, greyStyle)
    this._car = new F1Car(this._accent)
    this._car.scale.set(2.2)
    this._car.x = -55
    this._car.y = 52
    this.addChild(this._car)
    this._sessions = Array.from({ length: SESSION_ROWS }, (_, i) => {
      const y = -70 + i*24
      return { y, when: this._add(40, y, 12), name: this._add(282, y, 12, 1) }
    })
    this._shownCountdown = null
  }

  update(d) {
    const r = d.nextRace
    this._name.text = r ? r.name : 'Season complete'
    this._circuit.text = r ? r.circuit : ''
    this._place.text = r ? [r.locality, r.country].filter(Boolean).join(', ') : ''
    this._round.text = r ? `Round ${r.round} of ${d.totalRounds}${r.sprint ? ', sprint weekend' : ''}` : ''
    this._countdownLabel.text = r ? 'until lights out' : ''
    this._sessions.forEach((row, i) => {
      const s = r && r.sessions[i]
      row.when.text = s ? when(s.t) : ''
      row.name.text = s ? s.name : ''
      row.t = s ? s.t : null
    })
    if(!r && d.drivers && d.drivers.length) {
      const champ = d.drivers[0]
      this._circuit.text = `${d.season} champion: ${champ.name}`
    }
    this._shownCountdown = null
  }

  render(renderer) {
    super.render(renderer)
    const r = this.data && this.data.nextRace
    this._car.alpha = this.progress
    this._car.visible = !!r
    if(!r) {
      this._countdown.text = ''
      return
    }
    const now = Date.now()
    const text = countdown(r.start - now)
    if(text !== this._shownCountdown) {
      // once a minute: dim the sessions that are over, mark the next one
      this._shownCountdown = text
      this._countdown.text = text
      this._bars.clear()
      let marked = false
      this._sessions.forEach(row => {
        if(row.t === null) return
        const over = row.t + 60*60*1000 < now
        row.when.alpha = row.name.alpha = over ? 0.4 : 1
        if(!over && !marked) {
          marked = true
          this._bars.beginFill(this._accent)
          this._bars.drawCircle(26, row.y, 4)
          this._bars.endFill()
        }
      })
    }
  }
}
