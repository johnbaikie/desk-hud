import Widget from '../../frontend/Widget.js'
import TextField from '../../frontend/components/TextField.js'
import ProgressCircle from '../../frontend/circles/ProgressCircle.js'
import { DriversScreen, TeamsScreen, RaceScreen, countdown } from './F1Screens.js'
import { ACCENT } from '../../frontend/theme.js'

// Formula 1 championship standings from F1Service.
// Circle: the championship leader and their points, with the season's
// progress (rounds run of the calendar) as a gauge round the bottom.
// Main screen tabs: drivers, teams (constructors) and the next race.

// the gauge leaves the top of the circle free for the title (as on Network)
const GAUGE_START = 0.85 // rad
const GAUGE_SPAN = (2*Math.PI - 2*GAUGE_START) / (2*Math.PI)
const TAB_NAMES = ['drivers', 'teams', 'next race']

export default class F1Widget extends Widget {
  constructor() {
    super('f1', 'Formula 1')
    this.initState({
      season: null,
      round: 0,
      totalRounds: 0,
      drivers: [],
      constructors: [],
      nextRace: null,
    })

    this._season = new ProgressCircle()
    this._season.color = ACCENT
    this._season.lineWidth = 2
    this._season.rotation = GAUGE_START
    this.addChild(this._season)

    this._leader = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 26,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeThickness: 1,
      align: 'center',
    })
    this.addChild(this._leader)

    this._info = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 11,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeThickness: 0.5,
      align: 'center',
    })
    this.addChild(this._info)

    this.main.title = 'Formula 1'
    this._screens = [new DriversScreen(), new TeamsScreen(), new RaceScreen()]
    this._screens.forEach((screen, i) => {
      const tab = this.main.getTabButton(i)
      tab.text = TAB_NAMES[i]
      tab.visible = true
      this.main.getPage(i).addChild(screen)
    })
    this._shownNext = null
  }

  msg2state(msg) {
    if(msg.error) return { error: msg.error }
    if(!Array.isArray(msg.drivers) || !msg.drivers.length) return { error: 'No F1 standings' }
    const next = msg.nextRace
    return {
      season: msg.season || null,
      round: Number(msg.round) || 0,
      totalRounds: Number(msg.totalRounds) || 0,
      drivers: msg.drivers.filter(d => d && d.name),
      constructors: Array.isArray(msg.constructors) ? msg.constructors.filter(c => c && c.name) : [],
      nextRace: next && Number.isFinite(next.start) && Array.isArray(next.sessions) ? next : null,
      error: null,
    }
  }

  updateState(obj) {
    super.updateState(obj)
    const s = this.state
    if(!s.drivers.length) return
    const leader = s.drivers[0]
    this._leader.text = leader.code || leader.name.slice(0, 3)
    this._info.text = `${leader.points} pts`
    this._screens.forEach(screen => screen.data = s)
    this.main.statusLeftText = `${s.season} after round ${s.round}`
    this._shownNext = null
  }

  render(renderer) {
    const p = this.progress * this.dataLoadProgress
    const s = this.state

    this._season.progress = p
    this._season.size = this.size
    this._season.value = s.totalRounds ? GAUGE_SPAN * Math.min(1, s.round / s.totalRounds) : 0

    this._leader.progress = p
    this._leader.style.fontSize = 14 + 12*this.size
    this._leader.y = -8*this.size
    this._info.progress = p
    this._info.y = 26*this.size
    this._info.visible = this.size === 1

    // the next race's countdown in the header, updated once a minute
    const next = s.nextRace
    const status = next ? `${next.locality || next.country}: ${countdown(next.start - Date.now())}` : 'season complete'
    if(status !== this._shownNext) {
      this._shownNext = status
      this.main.statusRightText = status
    }

    this._screens.forEach(screen => screen.progress = this.main.progress * this.dataLoadProgress)
    super.render(renderer)
  }
}
