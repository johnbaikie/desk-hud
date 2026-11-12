import { ACCENT } from '../../frontend/theme.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField'
import { when, site, cut, shortRocket, GOOD } from './format.js'

// The UPCOMING and RECENT tabs: up to 10 launches, one a row, with time,
// countdown or result, rocket, mission and site. Tapping a row emits
// 'select' with the launch's id (the widget shows it on the NEXT tab).
// The page spans about x -295..295, y -105..98.

const ROWS = 10
const ROW_TOP = -86
const ROW_HEIGHT = 17.5
const COLUMNS = { when: -282, status: -165, rocket: -100, mission: 25, site: 282 }

const hex = (c) => '#' + c.toString(16).padStart(6, '0')

// "45M", "5H 12M", "2D 5H"; "LATE" once the time has passed
function shortCountdown(l, now) {
  const ms = l.net - now
  if(ms < 0) return 'late'
  const days = Math.floor(ms / 86400000)
  const h = Math.floor(ms / 3600000) % 24
  const m = Math.floor(ms / 60000) % 60
  if(days) return `${days}D ${h}H`
  if(h) return `${h}H ${m}M`
  return `${m}M`
}

export default class ListScreen extends PIXI.Container {
  constructor(mode) {
    super()
    this._mode = mode // 'upcoming' or 'recent'
    this._accent = ACCENT
    this.progress = 0
    this._launches = undefined
    this._fields = []
    this._rows = []
    const add = (fontSize, x, y, fill='#ffffff', anchorX=0) => {
      const f = new TextField('', {
        fontFamily: 'ShareTechMono', fontSize, fill,
        stroke: fill, strokeThickness: fill === '#ffffff' ? 0.5 : 0,
      })
      f.anchor.set(anchorX, 0.5)
      f.x = x
      f.y = y
      this.addChild(f)
      this._fields.push(f)
      return f
    }
    for(let i = 0; i < ROWS; i++) {
      const y = ROW_TOP + i*ROW_HEIGHT
      const hit = new PIXI.Graphics()
      hit.beginFill(0x000000, 0.0001)
      hit.drawRect(-290, y - ROW_HEIGHT/2, 580, ROW_HEIGHT)
      hit.interactive = true
      hit.on('pointertap', () => {
        const l = this._launches && this._launches[i]
        if(l) this.emit('select', l.id)
      })
      this.addChild(hit)
      this._rows.push({
        hit,
        when: add(11, COLUMNS.when, y, TEXT_GREY),
        status: add(11, COLUMNS.status, y, hex(this._accent)),
        rocket: add(11, COLUMNS.rocket, y),
        mission: add(11, COLUMNS.mission, y),
        site: add(10, COLUMNS.site, y, TEXT_GREY, 1),
      })
    }
    this._empty = add(12, 0, 0, TEXT_GREY, 0.5)
    this._credit = add(10, 282, 89, TEXT_GREY, 1)
    this._credit.text = 'Launch Library 2 - tap a launch for details'
    this._lastMinute = null
  }

  show(launches) {
    if(launches === this._launches) return
    this._launches = launches
    this._draw()
  }

  _draw() {
    const now = Date.now()
    const list = this._launches || []
    this._empty.text = list.length ? '' : (this._mode === 'upcoming' ? 'No upcoming launches yet.' : 'No recent launches yet.')
    this._rows.forEach((row, i) => {
      const l = list[i]
      row.has = !!l
      if(!l) {
        for(const k of ['when', 'status', 'rocket', 'mission', 'site']) row[k].text = ''
        return
      }
      row.when.text = when(l)
      if(this._mode === 'upcoming') {
        row.status.text = shortCountdown(l, now)
        row.status.style.fill = l.status === 'Go' ? hex(this._accent) : '#ffffff'
      } else {
        row.status.text = l.status === 'Success' ? 'success' : l.status === 'Failure' ? 'failure' : l.status === 'Partial Failure' ? 'partial' : l.status
        row.status.style.fill = GOOD.includes(l.status) ? hex(this._accent) : '#ffffff'
      }
      row.rocket.text = cut(shortRocket(l), 16)
      row.mission.text = cut(l.mission, this._mode === 'upcoming' && l.status !== 'Go' ? 14 : 20) + (this._mode === 'upcoming' && l.status !== 'Go' ? ` (${l.status})` : '')
      row.site.text = cut(site(l), 14)
    })
  }

  render(renderer) {
    // upcoming countdowns move on by the minute
    const minute = Math.floor(Date.now() / 60000)
    if(this._mode === 'upcoming' && this._launches && minute !== this._lastMinute) {
      this._lastMinute = minute
      this._draw()
    }
    this._fields.forEach(f => f.progress = this.progress)
    this._rows.forEach(r => { r.hit.visible = !!r.has && this.progress > 0.5 })
    super.render(renderer)
  }
}
