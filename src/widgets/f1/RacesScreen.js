import { ACCENT } from '../../frontend/theme.js'
import TextField from '../../frontend/components/TextField'
import F1Car from './F1Car.js'
import { style, greyStyle, when, countdown, pad2 } from './F1Screens.js'

// The F1 widget's RACES tab: one race weekend of the season at a time.
// Swipe left/right for the next/previous weekend. The buttons along the top
// pick a view: INFO (circuit, countdown and the session times) or a
// session's classification (P1, P2, P3, SQ, SP, Q, GP). Results come from the
// service on request: emits 'request' with an OpenF1 session key, and the
// widget hands the answer to setResult().

const SWIPE_DISTANCE = 30
const HOUR = 60*60*1000
const RETRY_AFTER = 60*1000          // ask again for missing or failed results
const REFRESH_RECENT = 2*60*1000     // results of a session that just ended may still change
const RESULT_ROWS = 11               // per column
const RACES = ['SP', 'GP']
const QUALIS = ['SQ', 'Q']

const lapTime = (t) => {
  const m = Math.floor(t / 60)
  return `${m}:${(t - 60*m).toFixed(3).padStart(6, '0')}`
}
const totalTime = (t) => {
  const h = Math.floor(t / 3600)
  const m = Math.floor(t / 60) % 60
  const s = (t % 60).toFixed(3).padStart(6, '0')
  return h ? `${h}:${pad2(m)}:${s}` : `${m}:${s}`
}
const plus = (gap) => typeof gap === 'string' ? gap : (gap === null ? '' : `+${gap.toFixed(3)}`)

// the two right-hand columns of a result row
function columns(row, code, leader) {
  if(RACES.includes(code)) {
    if(row.status) return [row.laps !== null ? `lap ${row.laps}` : '', row.status]
    const time = row === leader && row.time !== null ? totalTime(row.time) : plus(row.gap)
    return [time, row.points ? `${row.points} pts` : '']
  }
  if(row.status) return ['', row.status]
  const time = row.time !== null ? lapTime(row.time) : 'no time'
  if(QUALIS.includes(code)) {
    // the gap is to the fastest in the part the driver reached
    const part = code === 'SQ' && row.part ? 'S' + row.part : row.part
    if(row === leader) return [time, 'pole']
    return [time, row.part === leader.part && row.time !== null ? plus(row.gap) : (part || '')]
  }
  return [time, row === leader ? `${row.laps || 0} laps` : plus(row.gap)]
}

// the view a weekend opens on: INFO before it starts, the race once it's
// over, otherwise the latest session that has finished
function defaultMode(w, now) {
  const done = w.sessions.filter(s => s.end < now)
  if(!done.length) return 'INFO'
  return done[done.length - 1].code
}

export default class RacesScreen extends PIXI.Container {
  constructor() {
    super()
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    this.progress = 0
    this._data = null
    this._results = new Map()   // session key -> {rows, error, at}
    this._requested = new Map() // session key -> time asked
    this._index = null          // weekend shown
    this._mode = 'INFO'
    this._dirty = true
    this._minute = null
    this._fields = []

    // swipe area under everything else
    const swipe = new PIXI.Graphics()
    swipe.beginFill(0x000000, 0.0001)
    swipe.drawRect(-290, -100, 580, 200)
    swipe.interactive = true
    swipe.on('pointerdown', (e) => { this._dragStartX = e.global.x })
    swipe.on('pointerup', (e) => this._endDrag(e.global.x))
    swipe.on('pointerupoutside', (e) => this._endDrag(e.global.x))
    swipe.on('pointercancel', () => { this._dragStartX = null })
    this.addChild(swipe)
    this._swipe = swipe

    this._graphics = new PIXI.Graphics() // row markers, team colours
    this.addChild(this._graphics)

    this._title = this._add(this, -280, -86, 13)

    // view buttons, laid out from the right in _redraw
    this._pills = Array.from({ length: 8 }, () => {
      const pill = new PIXI.Container()
      pill.frame = new PIXI.Graphics()
      pill.addChild(pill.frame)
      pill.label = this._add(pill, 0, 0, 10, 0.5)
      pill.interactive = true
      pill.cursor = 'pointer'
      pill.on('pointertap', () => this._setMode(pill.code))
      this.addChild(pill)
      return pill
    })

    // INFO view
    this._info = new PIXI.Container()
    this.addChild(this._info)
    this._circuit = this._add(this._info, -280, -60, 11, 0, greyStyle)
    this._place = this._add(this._info, -280, -44, 11, 0, greyStyle)
    this._round = this._add(this._info, -280, -22, 12)
    this._countdown = this._add(this._info, -280, 18, 28)
    this._countdownLabel = this._add(this._info, -280, 46, 11, 0, greyStyle)
    this._car = new F1Car(this._accent)
    this._car.scale.set(2.2)
    this._car.x = -30
    this._car.y = 38
    this._info.addChild(this._car)
    this._sessions = Array.from({ length: 7 }, (_, i) => {
      const y = -58 + i*21
      const row = new PIXI.Container()
      row.y = y
      row.code = this._add(row, 36, 0, 12)
      row.when = this._add(row, 70, 0, 12)
      row.name = this._add(row, 282, 0, 10, 1, greyStyle)
      row.hitArea = new PIXI.Rectangle(14, -10, 272, 20)
      row.interactive = true
      row.cursor = 'pointer'
      row.on('pointertap', () => row.session && this._setMode(row.session.code))
      this._info.addChild(row)
      return row
    })

    // results view: two columns of 11
    this._resultsView = new PIXI.Container()
    this.addChild(this._resultsView)
    this._rows = Array.from({ length: 2*RESULT_ROWS }, (_, i) => {
      const x = i < RESULT_ROWS ? -282 : 10
      const y = -62 + (i % RESULT_ROWS)*14.6
      const v = this._resultsView
      return {
        x, y,
        pos: this._add(v, x + 16, y, 11, 1),
        code: this._add(v, x + 30, y, 11),
        name: this._add(v, x + 64, y, 10, 0, greyStyle),
        time: this._add(v, x + 208, y, 11, 1),
        extra: this._add(v, x + 274, y, 10, 1, greyStyle),
      }
    })
    this._message = this._add(this._resultsView, 0, 10, 12, 0.5, greyStyle)
  }

  _add(parent, x, y, fontSize, anchorX=0, styleFn=style) {
    const field = new TextField('', styleFn(fontSize))
    field.anchor.set(anchorX, 0.5)
    field.x = x
    field.y = y
    parent.addChild(field)
    this._fields.push(field)
    return field
  }

  _endDrag(x) {
    if(this._dragStartX === null || this._dragStartX === undefined) return
    const dx = x - this._dragStartX
    this._dragStartX = null
    if(Math.abs(dx) >= SWIPE_DISTANCE) this._select(this._index + (dx < 0 ? 1 : -1))
  }

  get _weekends() {
    return this._data && Array.isArray(this._data.weekends) ? this._data.weekends : []
  }

  set data(v) {
    this._data = v
    const weekends = this._weekends
    if(this._index === null && weekends.length) {
      // open on the next weekend that isn't over, or the last one
      const now = Date.now()
      const next = weekends.findIndex(w => w.sessions.length && w.sessions[w.sessions.length-1].end > now)
      this._select(next >= 0 ? next : weekends.length - 1)
    }
    this._dirty = true
  }

  get data() {
    return this._data
  }

  _select(index) {
    const weekends = this._weekends
    if(!weekends.length) return
    this._index = Math.max(0, Math.min(weekends.length - 1, index))
    this._mode = defaultMode(weekends[this._index], Date.now())
    this._dirty = true
  }

  _setMode(mode) {
    if(!mode) return
    this._mode = mode
    this._dirty = true
  }

  setResult(key, result) {
    this._results.set(key, { ...result, at: Date.now() })
    this._dirty = true
  }

  // asks the service for a session's results when it has none worth keeping
  _request(session, now) {
    const res = this._results.get(session.key)
    const stale = !res || res.error || !res.rows || !res.rows.length
      || (session.end + HOUR > now && now - res.at > REFRESH_RECENT)
    const asked = this._requested.get(session.key)
    if(stale && (!asked || now - asked > RETRY_AFTER)) {
      this._requested.set(session.key, now)
      this.emit('request', session.key)
    }
  }

  _layoutPills(w, now) {
    const codes = ['INFO', ...w.sessions.map(s => s.code)]
    let right = 282
    this._pills.forEach((pill, i) => {
      // from the right: last session first
      const code = codes[codes.length - 1 - i]
      pill.visible = !!code
      if(!code) return
      const width = code === 'INFO' ? 40 : 30
      pill.code = code
      pill.x = right - width/2
      pill.y = -86
      right -= width + 5
      pill.label.text = code
      const selected = code === this._mode
      const session = w.sessions.find(s => s.code === code)
      const future = session && session.t > now
      pill.frame.clear()
      pill.frame.lineStyle({ width: 1, color: selected ? this._accent : 0xffffff, alpha: selected ? 1 : 0.6 })
      pill.frame.beginFill(selected ? this._accent : 0x000000, selected ? 0.35 : 0.01)
      pill.frame.drawRoundedRect(-width/2, -9, width, 18, 9)
      pill.frame.endFill()
      pill.label.alpha = future ? 0.5 : 1
      pill.hitArea = new PIXI.Rectangle(-width/2 - 2, -14, width + 4, 28)
    })
  }

  _drawInfo(w, now) {
    this._circuit.text = w.circuit
    this._place.text = [w.locality, w.country].filter(Boolean).join(', ')
    const total = this._data.totalRounds || this._weekends.length
    this._round.text = `Round ${w.round} of ${total}${w.sprint ? ', sprint weekend' : ''}`
    const raceEnd = w.sessions.length ? w.sessions[w.sessions.length-1].end : w.start
    const upcoming = raceEnd > now
    this._countdown.text = upcoming ? countdown(w.start - now) : ''
    this._countdownLabel.text = upcoming ? 'until lights out' : 'finished: tap a session for results'
    this._car.visible = upcoming
    let marked = false
    this._sessions.forEach(row => {
      const s = w.sessions[this._sessions.indexOf(row)]
      row.session = s || null
      row.visible = !!s
      if(!s) return
      row.code.text = s.code
      row.when.text = when(s.t)
      row.name.text = s.name
      const over = s.end < now
      row.alpha = over ? 0.55 : 1
      if(!over && !marked) {
        // the next (or running) session
        marked = true
        this._graphics.beginFill(this._accent)
        this._graphics.drawCircle(22, row.y, 4)
        this._graphics.endFill()
      }
    })
  }

  _drawResults(w, now) {
    const session = w.sessions.find(s => s.code === this._mode)
    let message = ''
    let rows = []
    if(!session) {
      message = 'no such session'
    } else if(session.t > now) {
      message = `${session.name} starts ${when(session.t)}`
    } else if(!session.key) {
      message = 'no timing data for this session'
    } else {
      this._request(session, now)
      const res = this._results.get(session.key)
      if(!res) message = 'loading...'
      else if(res.error || !res.rows) message = 'timing unavailable, retrying'
      else if(!res.rows.length) message = session.end > now ? 'session in progress' : 'no results yet'
      else rows = res.rows
    }
    this._message.text = message
    const leader = rows[0]
    this._rows.forEach((row, i) => {
      const r = rows[i]
      const [time, extra] = r ? columns(r, this._mode, leader) : ['', '']
      row.pos.text = r ? (r.pos !== null ? String(r.pos) : '--') : ''
      row.code.text = r ? r.code : ''
      row.name.text = r ? r.name.slice(0, 10) : ''
      row.time.text = time
      row.extra.text = extra
      if(r && r.colour) {
        this._graphics.beginFill(parseInt(r.colour, 16))
        this._graphics.drawRect(row.x + 21, row.y - 5, 3, 10)
        this._graphics.endFill()
      }
    })
  }

  _redraw(now) {
    this._graphics.clear()
    const w = this._weekends[this._index]
    this._info.visible = false
    this._resultsView.visible = false
    this._pills.forEach(p => p.visible = false)
    if(!w) {
      this._title.text = this._data ? 'No race calendar' : ''
      return
    }
    this._title.text = `R${w.round} ${w.name}`
    this._layoutPills(w, now)
    if(this._mode === 'INFO') {
      this._info.visible = true
      this._drawInfo(w, now)
    } else {
      this._resultsView.visible = true
      this._drawResults(w, now)
    }
  }

  render(renderer) {
    this._fields.forEach(f => f.progress = this.progress)
    this._graphics.alpha = this.progress
    this._car.alpha = this.progress
    this._pills.forEach(p => p.frame.alpha = this.progress)
    this._swipe.visible = this.progress > 0.5
    // redraw on new data, a tap, new results or a new minute (countdown,
    // sessions finishing, retries)
    const now = Date.now()
    const minute = Math.floor(now / 60000)
    if(this._dirty || minute !== this._minute) {
      this._dirty = false
      this._minute = minute
      this._redraw(now)
    }
    super.render(renderer)
  }
}
