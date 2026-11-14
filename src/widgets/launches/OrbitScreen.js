import { ACCENT } from '../../frontend/theme.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField'
import { COLS, ROWS, LAT_TOP, LAT_BOTTOM, isLand, cellLonLat } from '../dateTime/worldMap.js'
import { subsolarPoint, sunElevationSin } from '../dateTime/sun.js'
import { satrec, position, inShadow, nextPass } from './orbit.js'
import { cut, clock } from './format.js'

// The ORBIT tab: where the ISS, Tiangong and recent launches' payloads are
// now, on the dot world map (lit by the sun as on the TIME tab). The list on
// the right picks one: it is drawn in the accent with its ground track (the
// next 100 minutes, and the last 20 faintly), and the lines under the map
// give its height, speed, whether it is in sunlight, and for a station its
// next pass over home. Positions come from CelesTrak's elements, worked out
// here (orbit.js); recent launches appear once they are catalogued.
// The page spans about x -295..295, y -105..98.

const DOT = 3.2
const WIDTH = COLS * DOT   // 416
const HEIGHT = ROWS * DOT  // 150
const LEFT = -290
const TOP = -100
const LIST_X = LEFT + WIDTH + 12
const LIST_RIGHT = 288
const ROW_HEIGHT = 18
const MAX_ROWS = 7
const MOVE_EVERY = 1000
const TRACK_EVERY = 30*1000
const MAP_EVERY = 60*1000
const PASS_EVERY = 5*60*1000

const toX = (lon) => LEFT + (lon + 180) / 360 * WIDTH
const toY = (lat) => TOP + (LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM) * HEIGHT
const onMap = (lat) => lat <= LAT_TOP + 2 && lat >= LAT_BOTTOM - 2
const hex = (c) => '#' + c.toString(16).padStart(6, '0')
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const latLon = (p) => `${Math.abs(p.lat).toFixed(1)}° ${p.lat >= 0 ? 'N' : 'S'}  ${Math.abs(p.lon).toFixed(1)}° ${p.lon >= 0 ? 'E' : 'W'}`
const thousands = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export default class OrbitScreen extends PIXI.Container {
  constructor() {
    super()
    this._accent = ACCENT
    this.progress = 0
    this._objects = []    // {key, label, rec, entry, station}
    this._selected = null // key
    this._home = null
    this._at = { move: 0, track: 0, map: 0, pass: 0 }

    this._cells = []
    for(let row = 0; row < ROWS; row++) {
      for(let col = 0; col < COLS; col++) {
        const [lon, lat] = cellLonLat(col, row)
        this._cells.push({ x: LEFT + col*DOT + DOT/2, y: TOP + row*DOT + DOT/2, lon, lat, land: isLand(col, row) })
      }
    }
    this._map = new PIXI.Graphics()
    this.addChild(this._map)
    this._track = new PIXI.Graphics()
    this.addChild(this._track)
    this._marks = new PIXI.Graphics()
    this.addChild(this._marks)

    this._fields = []
    const field = (fontSize, fill='#ffffff', anchorX=0) => {
      const f = new TextField('', { fontFamily: 'ShareTechMono', fontSize, fill, stroke: fill, strokeThickness: fill === '#ffffff' ? 0.5 : 0 })
      f.anchor.set(anchorX, 0.5)
      this.addChild(f)
      this._fields.push(f)
      return f
    }
    this._mapLabel = field(10)
    this._rows = Array.from({ length: MAX_ROWS }, (_, i) => {
      const y = TOP + 9 + i*ROW_HEIGHT
      const hit = new PIXI.Graphics()
      hit.beginFill(0x000000, 0.0001)
      hit.drawRect(LIST_X - 4, y - ROW_HEIGHT/2, LIST_RIGHT - LIST_X + 8, ROW_HEIGHT)
      hit.interactive = true
      hit.on('pointertap', () => { const o = this._objects[i]; if(o) this._select(o.key) })
      this.addChild(hit)
      const name = field(11, '#ffffff')
      name.position.set(LIST_X, y)
      const alt = field(10, TEXT_GREY, 1)
      alt.position.set(LIST_RIGHT, y)
      return { hit, name, alt }
    })
    this._info = field(12)
    this._info.position.set(LEFT, TOP + HEIGHT + 14)
    this._info2 = field(11, TEXT_GREY)
    this._info2.position.set(LEFT, TOP + HEIGHT + 31)
    this._empty = field(11, TEXT_GREY, 0.5)
    this._empty.position.set((LIST_X + LIST_RIGHT) / 2, 0)
    this._credit = field(10, TEXT_GREY, 1)
    this._credit.position.set(LIST_RIGHT, TOP + HEIGHT + 14)
    this._credit.text = 'CelesTrak - tap to pick'
  }

  // orbits: {stations, launches} from LaunchesService; home: {lat, lon} or null
  show(orbits, home) {
    if(orbits === this._orbits && home === this._home) return
    this._orbits = orbits
    this._home = home
    const objects = []
    for(const s of (orbits && orbits.stations) || []) {
      const rec = s.omm && satrec(s.omm)
      if(rec) objects.push({ key: 'station:' + s.name, label: s.name, rec, station: true, entry: s })
    }
    for(const l of (orbits && orbits.launches) || []) {
      const rec = l.omm && satrec(l.omm)
      if(rec) objects.push({ key: 'launch:' + l.launchId, label: l.mission || l.name, rec, entry: l })
    }
    this._objects = objects.slice(0, MAX_ROWS)
    if(!this._objects.some(o => o.key === this._selected)) this._selected = this._objects.length ? this._objects[0].key : null
    this._empty.text = this._objects.length ? '' : 'No orbits yet.'
    this._at = { move: 0, track: 0, map: this._at.map, pass: 0 }
    this._layoutRows()
  }

  // select the objects of a launch (from the NEXT tab), if it is tracked
  selectLaunch(launchId) {
    const key = 'launch:' + launchId
    if(!this._objects.some(o => o.key === key)) return false
    this._select(key)
    return true
  }

  hasLaunch(launchId) {
    return this._objects.some(o => o.key === 'launch:' + launchId)
  }

  _select(key) {
    this._selected = key
    this._at.move = this._at.track = this._at.pass = 0
    this._layoutRows()
  }

  _layoutRows() {
    this._rows.forEach((row, i) => {
      const o = this._objects[i]
      row.has = !!o
      row.name.text = o ? cut(o.label, 13) : ''
      row.name.style.fill = o && o.key === this._selected ? hex(this._accent) : '#ffffff'
      if(!o) row.alt.text = ''
    })
  }

  _drawMap(now) {
    const sun = subsolarPoint(now)
    const g = this._map
    g.cacheAsBitmap = false
    g.clear()
    for(const c of this._cells) {
      const light = Math.max(0, Math.min(1, (sunElevationSin(c.lat, c.lon, sun) + 0.1) / 0.15))
      if(c.land) g.beginFill(0xffffff, 0.25 + 0.35*light)
      else g.beginFill(0xffffff, 0.04 + 0.06*light)
      g.drawCircle(c.x, c.y, c.land ? 1.2 : 0.6)
    }
    g.endFill()
    g.cacheAsBitmap = true
  }

  _drawTrack(now) {
    const t = this._track
    t.clear()
    const o = this._objects.find(x => x.key === this._selected)
    if(!o) return
    const line = (from, to, alpha) => {
      let last = null
      for(let time = from; time <= to; time += 60*1000) {
        const p = position(o.rec, time)
        if(!p) { last = null; continue }
        const x = toX(p.lon), y = toY(Math.max(LAT_BOTTOM, Math.min(LAT_TOP, p.lat)))
        if(last && Math.abs(x - last.x) < WIDTH/2) {
          t.lineStyle({ width: 1.2, color: this._accent, alpha })
          t.moveTo(last.x, last.y)
          t.lineTo(x, y)
        }
        last = { x, y }
      }
    }
    line(now - 20*60*1000, now, 0.3)
    line(now, now + 100*60*1000, 0.85)
  }

  _move(now) {
    const m = this._marks
    m.clear()
    if(this._home) {
      m.lineStyle({ width: 1, color: 0xffffff, alpha: 0.8 })
      m.drawCircle(toX(this._home.lon), toY(this._home.lat), 3.5)
      m.lineStyle(0)
    }
    let selected = null
    this._objects.forEach((o, i) => {
      const p = position(o.rec, now)
      o.pos = p
      const row = this._rows[i]
      if(row) row.alt.text = !p ? '' : p.alt >= 10000 ? `${(p.alt / 1000).toFixed(1)}k km` : `${thousands(p.alt)} km`
      if(!p || !onMap(p.lat)) return
      const x = toX(p.lon), y = toY(Math.max(LAT_BOTTOM, Math.min(LAT_TOP, p.lat)))
      if(o.key === this._selected) { selected = { o, p, x, y }; return }
      m.beginFill(0xffffff, 0.9)
      m.drawCircle(x, y, o.station ? 2.6 : 1.8)
      m.endFill()
    })
    // the selected object on top: a ring and a dot in the accent, and its name
    if(selected) {
      m.lineStyle({ width: 1.5, color: this._accent })
      m.drawCircle(selected.x, selected.y, 6)
      m.lineStyle(0)
      m.beginFill(this._accent)
      m.drawCircle(selected.x, selected.y, 2.8)
      m.endFill()
      const right = selected.x < LEFT + WIDTH - 90
      this._mapLabel.anchor.set(right ? 0 : 1, 0.5)
      this._mapLabel.position.set(selected.x + (right ? 10 : -10), selected.y)
      this._mapLabel.text = cut(selected.o.label, 18)
    } else {
      this._mapLabel.text = ''
    }
    const o = this._objects.find(x => x.key === this._selected)
    const p = o && o.pos
    this._info.text = p
      ? `${cut(o.label, 22)}   ${thousands(p.alt)} km   ${p.speed ? thousands(p.speed) + ' km/h' : ''}`
      : o ? `${cut(o.label, 22)}: no position` : ''
    if(!p) { this._info2.text = ''; return }
    const light = inShadow(p, now) ? "in Earth's shadow" : 'in sunlight'
    if(o.station) {
      const pass = this._pass
      const when = pass ? `${DAYS[new Date(pass.start).getDay()]} ${clock(pass.start)}, ${Math.max(1, Math.round((pass.end - pass.start) / 60000))} min, up to ${Math.round(pass.maxElevation)}°` : 'none in 24 h'
      this._info2.text = `${latLon(p)}   ${light}` + (this._home ? `   over home: ${when}` : '')
    } else {
      const e = o.entry
      this._info2.text = `${latLon(p)}   ${light}   ${e.designator}, ${e.count} object${e.count === 1 ? '' : 's'}`
    }
  }

  render(renderer) {
    const now = Date.now()
    if(this.progress > 0) {
      if(now - this._at.map > MAP_EVERY) { this._at.map = now; this._drawMap(now) }
      if(now - this._at.pass > PASS_EVERY) {
        this._at.pass = now
        const o = this._objects.find(x => x.key === this._selected)
        this._pass = o && o.station ? nextPass(o.rec, this._home, now) : null
      }
      if(now - this._at.track > TRACK_EVERY) { this._at.track = now; this._drawTrack(now) }
      if(now - this._at.move > MOVE_EVERY) { this._at.move = now; this._move(now) }
    }
    for(const f of this._fields) f.progress = this.progress
    this._map.alpha = this._track.alpha = this._marks.alpha = this.progress
    this._rows.forEach(r => { r.hit.visible = !!r.has && this.progress > 0.5 })
    super.render(renderer)
  }
}
