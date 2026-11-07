import { ACCENT } from '../../frontend/theme.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField'

// The Sports widget's main screen: one favourite team at a time. League
// buttons along the top (NFL, MLB, NHL, MLS, NWSL: only leagues with a
// team); swipe up or down for the next team in a league that has several.
// Left: record and standing, last game, next (or live) game and the games
// after it. Right: the team's division, conference or table, the team
// highlighted. Emits nothing; selection is internal (select()).

const SWIPE_DISTANCE = 30
const STANDING_ROWS = 10
const UPCOMING_ROWS = 4

const style = (fontSize, extra={}) => ({
  fontFamily: 'ShareTechMono',
  fontSize,
  fill: '#ffffff',
  stroke: '#ffffff',
  strokeThickness: 0.5,
  align: 'left',
  ...extra,
})
const greyStyle = (fontSize) => style(fontSize, { fill: TEXT_GREY, strokeThickness: 0 })

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad2 = (n) => String(n).padStart(2, '0')
export function gameDay(t) {
  const d = new Date(t)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
export function gameTime(game) {
  const d = new Date(game.date)
  return game.timeValid ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : 'tbd'
}
export const versus = (game) => `${game.home ? 'vs' : '@'} ${game.opp}`

export default class SportsScreen extends PIXI.Container {
  constructor() {
    super()
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    this.progress = 0
    this._data = null
    this._league = null // league id shown
    this._team = 0      // index within the league
    this._dirty = true
    this._minute = null
    this._fields = []

    // swipe area under everything else (up/down: next team in the league)
    const swipe = new PIXI.Graphics()
    swipe.beginFill(0x000000, 0.0001)
    swipe.drawRect(-290, -100, 580, 200)
    swipe.interactive = true
    swipe.on('pointerdown', (e) => { this._dragStartY = e.global.y })
    swipe.on('pointerup', (e) => this._endDrag(e.global.y))
    swipe.on('pointerupoutside', (e) => this._endDrag(e.global.y))
    swipe.on('pointercancel', () => { this._dragStartY = null })
    this.addChild(swipe)
    this._swipe = swipe

    this._graphics = new PIXI.Graphics()
    this.addChild(this._graphics)

    this._name = this._add(-272, -86, 14)
    this._pills = Array.from({ length: 5 }, () => {
      const pill = new PIXI.Container()
      pill.frame = new PIXI.Graphics()
      pill.addChild(pill.frame)
      pill.label = this._add(0, 0, 10, 0.5, style, pill)
      pill.interactive = true
      pill.cursor = 'pointer'
      pill.on('pointertap', () => this.select(pill.league, 0))
      this.addChild(pill)
      return pill
    })

    // left column
    this._record = this._add(-282, -62, 13)
    this._details = this._add(-282, -45, 10, 0, greyStyle)
    this._lastLabel = this._add(-282, -25, 10, 0, greyStyle)
    this._last = this._add(-236, -25, 12)
    this._nextLabel = this._add(-282, -7, 10, 0, greyStyle)
    this._next = this._add(-236, -7, 12)
    this._nextInfo = this._add(-236, 9, 10, 0, greyStyle)
    this._upcomingLabel = this._add(-282, 30, 10, 0, greyStyle)
    this._upcoming = Array.from({ length: UPCOMING_ROWS }, (_, i) => this._add(-282, 45 + i*14, 11))

    // right column: standings
    this._groupLabel = this._add(4, -62, 10, 0, greyStyle)
    this._groupExtra = this._add(282, -62, 10, 1, greyStyle)
    this._rows = Array.from({ length: STANDING_ROWS }, (_, i) => {
      const y = -46 + i*14
      return {
        y,
        rank: this._add(22, y, 11, 1),
        abbr: this._add(32, y, 11),
        record: this._add(190, y, 11, 1),
        extra: this._add(282, y, 10, 1, greyStyle),
      }
    })
    this._message = this._add(0, 10, 12, 0.5, greyStyle)
  }

  _add(x, y, fontSize, anchorX=0, styleFn=style, parent=this) {
    const field = new TextField('', styleFn(fontSize))
    field.anchor.set(anchorX, 0.5)
    field.x = x
    field.y = y
    parent.addChild(field)
    this._fields.push(field)
    return field
  }

  _endDrag(y) {
    if(this._dragStartY === null || this._dragStartY === undefined) return
    const dy = y - this._dragStartY
    this._dragStartY = null
    if(Math.abs(dy) >= SWIPE_DISTANCE) this.select(this._league, this._team + (dy < 0 ? 1 : -1))
  }

  get _leagues() {
    return this._data && Array.isArray(this._data.leagues) ? this._data.leagues : []
  }

  set data(v) {
    this._data = v
    this._dirty = true
  }

  // shows a league (and a team in it); wraps round the league's teams
  select(leagueId, teamIndex=0) {
    const league = this._leagues.find(l => l.id === leagueId)
    if(!league) return
    const count = Math.max(1, league.teams.length)
    this._league = leagueId
    this._team = ((teamIndex % count) + count) % count
    this._dirty = true
  }

  _layoutPills(leagues) {
    let right = 282
    this._pills.forEach((pill, i) => {
      const league = leagues[leagues.length - 1 - i]
      pill.visible = !!league
      if(!league) return
      const width = league.name.length > 3 ? 44 : 36
      pill.league = league.id
      pill.x = right - width/2
      pill.y = -86
      right -= width + 5
      pill.label.text = league.name
      const selected = league.id === this._league
      const live = league.teams.some(t => t && t.live)
      pill.frame.clear()
      pill.frame.lineStyle({ width: 1, color: selected || live ? this._accent : 0xffffff, alpha: selected ? 1 : 0.6 })
      pill.frame.beginFill(selected ? this._accent : 0x000000, selected ? 0.35 : 0.01)
      pill.frame.drawRoundedRect(-width/2, -9, width, 18, 9)
      pill.frame.endFill()
      pill.hitArea = new PIXI.Rectangle(-width/2 - 2, -14, width + 4, 28)
    })
  }

  _redraw() {
    this._graphics.clear()
    const leagues = this._leagues
    if(!leagues.some(l => l.id === this._league) && leagues.length) this.select(leagues[0].id, 0)
    this._layoutPills(leagues)
    const league = leagues.find(l => l.id === this._league)
    const team = league ? league.teams[this._team] : null
    const blank = !team || team.error || !team.name
    this._fields.forEach(f => { if(!this._pills.some(p => p.label === f)) f.text = '' })
    if(!league) return
    if(blank) {
      this._name.text = team ? team.abbr || '' : league.name
      this._message.text = (team && team.error) || league.error || `No ${league.name} team`
      return
    }

    // name with a stripe in the team's colour
    const count = league.teams.length
    this._name.text = team.name + (count > 1 ? `  (${this._team + 1}/${count})` : '')
    if(team.color) {
      this._graphics.beginFill(parseInt(team.color, 16))
      this._graphics.drawRect(-282, -94, 4, 16)
      this._graphics.endFill()
    }

    const s = team.standing
    const record = league.soccer ? `${team.record} w-d-l` : team.record
    this._record.text = [record, s ? s.summary : ''].filter(Boolean).join(', ')
    this._details.text = [
      team.home && `home ${team.home}`,
      team.road && `road ${team.road}`,
      s && s.points && `${s.points} pts`,
      s && s.diff && `diff ${s.diff}`,
      s && s.streak && `streak ${s.streak}`,
    ].filter(Boolean).join('   ')

    const last = team.last
    this._lastLabel.text = 'last'
    this._last.text = last
      ? `${last.result || ''} ${last.us ?? ''}-${last.them ?? ''} ${versus(last)}   ${gameDay(last.date)}`.trim()
      : 'none yet'

    if(team.live) {
      const g = team.live
      this._nextLabel.text = 'live'
      this._nextLabel.style.fill = '#' + this._accent.toString(16).padStart(6, '0')
      this._next.text = `${g.us ?? 0}-${g.them ?? 0} ${versus(g)}   ${g.detail}`
      this._nextInfo.text = [g.situation, g.tv].filter(Boolean).join('   ')
      this._graphics.beginFill(this._accent)
      this._graphics.drawCircle(-290, -7, 3)
      this._graphics.endFill()
    } else {
      this._nextLabel.text = 'next'
      this._nextLabel.style.fill = TEXT_GREY
      const g = team.next
      this._next.text = g ? `${versus(g)}   ${gameDay(g.date)} ${gameTime(g)}` : 'nothing scheduled'
      this._nextInfo.text = g ? [g.oppName, g.tv].filter(Boolean).join('   ') : ''
    }

    const upcoming = team.upcoming || []
    this._upcomingLabel.text = upcoming.length ? 'then' : ''
    this._upcoming.forEach((field, i) => {
      const g = upcoming[i]
      field.text = g ? `${gameDay(g.date).padEnd(10)} ${gameTime(g)}  ${versus(g)}` : ''
    })

    // standings: the whole group, or 10 rows round the team
    const rows = s ? s.rows : []
    const me = rows.findIndex(r => r.me)
    const start = Math.max(0, Math.min(rows.length - STANDING_ROWS, me - 4))
    this._groupLabel.text = s ? s.group : ''
    this._groupExtra.text = s ? (league.soccer || league.id === 'nhl' ? 'pts' : 'gb') : ''
    this._rows.forEach((row, i) => {
      const r = rows[start + i]
      row.rank.text = r ? String(r.rank) : ''
      row.abbr.text = r ? r.abbr : ''
      row.record.text = r ? r.record : ''
      row.extra.text = r ? r.extra.replace(/ pts$/, '') : ''
      if(r && r.me) {
        this._graphics.beginFill(this._accent, 0.3)
        this._graphics.drawRoundedRect(0, row.y - 7, 286, 14, 4)
        this._graphics.endFill()
      }
    })
  }

  render(renderer) {
    this._fields.forEach(f => f.progress = this.progress)
    this._graphics.alpha = this.progress
    this._pills.forEach(p => p.frame.alpha = this.progress)
    this._swipe.visible = this.progress > 0.5
    const minute = Math.floor(Date.now() / 60000)
    if(this._dirty || minute !== this._minute) {
      this._dirty = false
      this._minute = minute
      this._redraw()
    }
    super.render(renderer)
  }
}
