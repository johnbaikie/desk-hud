import { ACCENT } from '../../frontend/theme.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField'
import { COLS, ROWS, LAT_TOP, LAT_BOTTOM, isLand, cellLonLat } from './worldMap.js'
import { zoneCoords } from './places.js'
import { subsolarPoint, sunElevationSin, terminatorLat, sunTimes } from './sun.js'

const DOT = 4                       // px between dot centres
const WIDTH = COLS * DOT            // 520
const HEIGHT = ROWS * DOT           // 188
const LEFT = -WIDTH / 2
const TOP = -101
const REDRAW_EVERY = 60 * 1000
const SUN_COLOR = 0xffd54f
const NIGHT_COLOR = 0x5a6c9a

const pad2 = (n) => String(n).padStart(2, '0')
const toX = (lon) => LEFT + (lon + 180) / 360 * WIDTH
const toY = (lat) => TOP + (LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM) * HEIGHT

function mix(a, b, t) {
  const ch = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

function timeIn(timeZone, time) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(time)
    const get = (type) => (parts.find(p => p.type === type) || {}).value
    return { hhmm: `${get('hour')}:${get('minute')}`, weekday: get('weekday') }
  } catch(e) {
    return null // unknown zone id
  }
}

// TIME tab: a dot-matrix world map lit by the sun. Land dots are bright in
// daylight and dim blue at night, a line marks where day meets night, a
// yellow disc marks where the sun is overhead, and markers show home and the
// configured time zones with their local times. Redrawn once a minute.
export default class WorldMapScreen extends PIXI.Container {
  constructor(timezones, home, accent = ACCENT) {
    super()
    this.progress = 0
    this._accent = accent
    this._drawnAt = 0

    // cells and their land flags never change: precompute once
    this._cells = []
    for(let row = 0; row < ROWS; row++) {
      for(let col = 0; col < COLS; col++) {
        const [lon, lat] = cellLonLat(col, row)
        this._cells.push({ x: LEFT + col*DOT + DOT/2, y: TOP + row*DOT + DOT/2, lon, lat, land: isLand(col, row) })
      }
    }

    this._dots = new PIXI.Graphics()
    this.addChild(this._dots)
    this._terminator = new PIXI.Graphics()
    this.addChild(this._terminator)
    this._sun = new PIXI.Graphics()
    this._sun.beginFill(SUN_COLOR, 0.25)
    this._sun.drawCircle(0, 0, 10)
    this._sun.beginFill(SUN_COLOR)
    this._sun.drawCircle(0, 0, 5)
    this._sun.endFill()
    this.addChild(this._sun)

    // home first, then each configured zone (except the one home is in)
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    this._places = []
    // home: the configured location, else the main city of this browser's zone
    const localCoords = zoneCoords({ id: localZone })
    if(home && Number.isFinite(home.lat) && Number.isFinite(home.lon)) {
      this._places.push({ name: 'home', zone: localZone, lat: home.lat, lon: home.lon, home: true })
    } else if(localCoords) {
      this._places.push({ name: 'home', zone: localZone, lat: localCoords[0], lon: localCoords[1], home: true })
    }
    for(const z of timezones || []) {
      if(this._places.length && String(z.id).toLowerCase() === localZone.toLowerCase()) continue
      const coords = zoneCoords(z)
      if(coords) this._places.push({ name: z.name, zone: z.id, lat: coords[0], lon: coords[1] })
    }
    this._markers = new PIXI.Container()
    this.addChild(this._markers)
    this._places.forEach(p => {
      const color = p.home ? this._accent : 0xffffff
      const marker = new PIXI.Graphics()
      marker.lineStyle({ width: 1.5, color })
      marker.drawCircle(0, 0, 5)
      marker.lineStyle(0)
      marker.beginFill(color)
      marker.drawCircle(0, 0, 2)
      marker.endFill()
      marker.position.set(Math.round(toX(p.lon)), Math.round(toY(p.lat)))
      this._markers.addChild(marker)

      p.labelBg = new PIXI.Graphics()
      this._markers.addChild(p.labelBg)
      p.label = new TextField('', {
        fontFamily: 'ShareTechMono',
        fontSize: 10,
        fill: '#ffffff',
        strokeThickness: 0,
        align: 'left',
      })
      p.label.anchor.set(0, 0.5)
      this._markers.addChild(p.label)
      p.marker = marker
    })

    // sunrise and sunset at home, in the open ocean at the bottom left
    this._sunInfo = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 10,
      fill: TEXT_GREY,
      strokeThickness: 0,
      align: 'left',
      lineHeight: 14,
    })
    this._sunInfo.anchor.set(0, 1)
    this._sunInfo.position.set(LEFT + 4, TOP + HEIGHT - 2)
    this.addChild(this._sunInfo)
    this._home = this._places.find(p => p.home) || null
  }

  _redraw(now) {
    const sun = subsolarPoint(now)

    // dots, bucketed by colour so the Graphics changes fill rarely
    const buckets = new Map()
    for(const c of this._cells) {
      const s = sunElevationSin(c.lat, c.lon, sun)
      // 0 = night, 1 = day, with ~6° of twilight in between
      const light = Math.max(0, Math.min(1, (s + 0.1) / 0.15))
      const level = Math.round(light * 6) / 6
      const key = `${c.land ? 'l' : 's'}${level}`
      if(!buckets.has(key)) buckets.set(key, { land: c.land, level, cells: [] })
      buckets.get(key).cells.push(c)
    }
    const g = this._dots
    g.cacheAsBitmap = false
    g.clear()
    for(const { land, level, cells } of buckets.values()) {
      if(land) {
        g.beginFill(mix(NIGHT_COLOR, 0xffffff, level), 0.55 + 0.4 * level)
      } else {
        g.beginFill(0xffffff, 0.05 + 0.1 * level)
      }
      const r = land ? 1.5 : 0.8
      for(const c of cells) g.drawCircle(c.x, c.y, r)
    }
    g.endFill()
    // thousands of dots: render them to a texture once per redraw
    g.cacheAsBitmap = true

    // day/night line
    const t = this._terminator
    t.clear()
    t.lineStyle({ width: 1.5, color: this._accent, alpha: 0.8 })
    let started = false
    for(let lon = -180; lon <= 180; lon += 3) {
      const lat = terminatorLat(lon, sun)
      if(lat === null || lat > LAT_TOP || lat < LAT_BOTTOM) { started = false; continue }
      const x = toX(lon), y = toY(lat)
      if(started) t.lineTo(x, y)
      else t.moveTo(x, y)
      started = true
    }

    this._sun.position.set(Math.round(toX(sun.lon)), Math.round(toY(sun.lat)))

    // place labels: try right of the marker, then left, then nudged up or
    // down, avoiding other labels, other markers and the map edges
    const boxes = this._places.map(p => ({ x: p.marker.x - 6, y: p.marker.y - 6, w: 12, h: 12, owner: p }))
    const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    const localDay = timeIn(Intl.DateTimeFormat().resolvedOptions().timeZone, now)
    for(const p of this._places) {
      const local = timeIn(p.zone, now)
      const otherDay = local && localDay && local.weekday !== localDay.weekday ? ' ' + local.weekday : ''
      p.label.text = local ? `${p.name} ${local.hhmm}${otherDay}` : p.name
      const w = PIXI.TextMetrics.measureText(p.label.text.toUpperCase(), p.label.style).width * p.label.scale.x
      const h = 14
      const mx = p.marker.x, my = p.marker.y
      const candidates = []
      for(const dy of [0, -14, 14, -28, 28]) {
        candidates.push({ x: mx + 9, y: my + dy - h/2 }, { x: mx - 9 - w, y: my + dy - h/2 })
      }
      const fits = (c) => c.x >= LEFT && c.x + w <= LEFT + WIDTH && c.y >= TOP && c.y + h <= TOP + HEIGHT
      const free = (c) => !boxes.some(b => b.owner !== p && overlaps({ ...c, w, h }, b))
      const spot = candidates.find(c => fits(c) && free(c)) || candidates.find(fits) || candidates[0]
      boxes.push({ x: spot.x - 3, y: spot.y, w: w + 6, h, owner: p })
      p.label.position.set(Math.round(spot.x), Math.round(spot.y + h/2))
      p.labelBg.clear()
      p.labelBg.beginFill(0x000000, 0.75)
      p.labelBg.drawRoundedRect(spot.x - 3, spot.y, w + 6, h, 4)
      p.labelBg.endFill()
    }

    if(this._home) {
      const st = sunTimes(this._home.lat, this._home.lon, now)
      if(st) {
        const fmt = (t) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
        const len = Math.round((st.sunset - st.sunrise) / 60000)
        this._sunInfo.text = `sunrise ${fmt(st.sunrise)}\nsunset  ${fmt(st.sunset)}\ndaylight ${Math.floor(len/60)}h ${pad2(len % 60)}m`
      } else {
        this._sunInfo.text = ''
      }
    }
  }

  render(renderer) {
    const now = Date.now()
    if(now - this._drawnAt > REDRAW_EVERY) {
      this._drawnAt = now
      this._redraw(now)
    }
    this._dots.alpha = this.progress
    this._terminator.alpha = this.progress
    this._sun.alpha = this.progress
    this._markers.alpha = this.progress
    this._places.forEach(p => p.label.progress = this.progress)
    this._sunInfo.progress = this.progress
    super.render(renderer)
  }
}
