import Widget from '../../frontend/Widget.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField.js'
import ProgressCircle from '../../frontend/circles/ProgressCircle.js'
import SportsScreen, { gameDay, gameTime, versus } from './SportsScreen.js'

// Favourite teams from SportsService (ESPN): NFL, MLB, NHL, MLS, NWSL.
// Circle: the game to watch, a live one first, otherwise the soonest next
// game, with a ring in that team's colour. Main screen: SportsScreen.
// When one of the teams' games starts the widget comes to the front with
// that league shown (games already live when the page loads don't count,
// so a reload doesn't pull it forward again).

const RING_START = 0.85 // rad from 12 o'clock, as on Network

export default class SportsWidget extends Widget {
  constructor() {
    super('sports', 'Sports')
    this.initState({ leagues: [] })

    // a ring in the team's colour, open at the top for the title
    this._ring = new ProgressCircle()
    this._ring.lineWidth = 2
    this._ring.rotation = RING_START
    this._ring.value = (2*Math.PI - 2*RING_START) / (2*Math.PI)
    this.addChild(this._ring)

    const label = (fontSize, fill='#ffffff') => {
      const field = new TextField('', {
        fontFamily: 'ShareTechMono',
        fontSize,
        fill,
        stroke: fill,
        strokeThickness: fill === '#ffffff' ? 0.5 : 0,
        align: 'center',
      })
      this.addChild(field)
      return field
    }
    this._top = label(14)
    this._middle = label(24)
    this._bottom = label(11, TEXT_GREY)

    this.main.title = 'Sports'
    this._screen = new SportsScreen()
    this.main.getPage(0).addChild(this._screen)
    this._seenLive = null
    this._featured = null
    this._shownMinute = null
  }

  msg2state(msg) {
    if(msg.error) return { error: msg.error }
    if(!Array.isArray(msg.leagues)) return { error: 'No sports data' }
    const leagues = msg.leagues
      .filter(l => l && l.id && l.name)
      .map(l => ({ ...l, teams: Array.isArray(l.teams) ? l.teams.filter(Boolean) : [] }))
    if(!leagues.length) return { error: 'No teams set' }
    return { leagues, error: null }
  }

  updateState(obj) {
    super.updateState(obj)
    this._screen.data = this.state
    this._checkStarted()
    this._updateCircle()
    this._shownMinute = Math.floor(Date.now() / 60000)
    // the main screen opens on the league of the game on the circle
    if(!this._screen._league && this._featured) {
      this._screen.select(this._featured.league.id, this._featured.league.teams.indexOf(this._featured.team))
    }
  }

  // a newly live game brings the widget forward with its league shown
  _checkStarted() {
    const live = []
    this.state.leagues.forEach(l => l.teams.forEach((t, i) => {
      if(t.live) live.push({ league: l.id, index: i, id: t.live.id })
    }))
    if(this._seenLive === null) {
      this._seenLive = new Set(live.map(g => g.id))
      return
    }
    const started = live.find(g => !this._seenLive.has(g.id))
    live.forEach(g => this._seenLive.add(g.id))
    if(!started) return
    this._screen.select(started.league, started.index)
    if(this.index !== 0) this.emit('activate') // activating the front widget would swap it away
  }

  // the game on the circle: live first, then the soonest
  _pickGame() {
    let best = null
    this.state.leagues.forEach(l => l.teams.forEach(t => {
      if(!t || t.error) return
      const game = t.live || t.next
      if(!game) return
      const score = t.live ? -Infinity : game.date
      if(!best || score < best.score) best = { score, league: l, team: t, game, live: !!t.live }
    }))
    return best
  }

  _updateCircle() {
    const f = this._pickGame()
    this._featured = f
    if(!f) {
      this._top.text = ''
      this._middle.text = this.state.leagues.length ? 'no games' : ''
      this._bottom.text = ''
      return
    }
    const g = f.game
    const vs = g.home ? 'v' : '@'
    if(f.live) {
      this._top.text = `${f.team.abbr} ${vs} ${g.opp}`
      this._middle.text = `${g.us ?? 0}-${g.them ?? 0}`
      this._bottom.text = g.detail
    } else {
      this._top.text = `${f.team.abbr} ${vs} ${g.opp}`
      const today = gameDay(Date.now()) === gameDay(g.date)
      this._middle.text = today ? gameTime(g) : gameDay(g.date).split(' ')[0]
      this._bottom.text = today ? `today, ${f.league.name}` : `${gameDay(g.date)} ${gameTime(g)}`
    }
    this._ring.color = f.team.color ? parseInt(f.team.color, 16) : 0xffffff
  }

  render(renderer) {
    const p = this.progress * this.dataLoadProgress
    // the circle's text only changes with new data or a new minute
    const minute = Math.floor(Date.now() / 60000)
    if(minute !== this._shownMinute) {
      this._shownMinute = minute
      this._updateCircle()
    }
    this._ring.progress = p
    this._ring.size = this.size
    this._ring.visible = !!this._featured

    const live = this._featured && this._featured.live
    this._top.progress = p
    this._top.style.fontSize = 9 + 6*this.size
    this._top.y = -30*this.size
    this._middle.progress = p
    this._middle.style.fontSize = 12 + 14*this.size
    this._middle.y = 0
    this._bottom.progress = p
    this._bottom.y = 30*this.size
    this._bottom.visible = this.size === 1 || live
    // a live game's clock pulses gently
    this._bottom.alpha = live ? 0.6 + 0.4*Math.sin(performance.now()*0.005) : 1

    this._screen.progress = this.main.progress * this.dataLoadProgress
    this.main.statusLeftText = this._featured ? this._featured.league.name : ''
    this.main.statusRightText = live ? 'live' : ''
    super.render(renderer)
  }
}
