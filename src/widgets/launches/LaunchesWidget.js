import Widget from '../../frontend/Widget.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField.js'
import ProgressCircle from '../../frontend/circles/ProgressCircle.js'
import { ACCENT } from '../../frontend/theme.js'
import Rocket, { ROCKET_LENGTH } from './Rocket.js'
import LaunchScreen from './LaunchScreen.js'
import ListsScreen from './ListsScreen.js'
import OrbitScreen from './OrbitScreen.js'
import { countdown, shortRocket, site, exact } from './format.js'

// Rocket launches worldwide from LaunchesService (Launch Library 2).
// Circle: a countdown to the next launch with its rocket and site. The ring
// (open at the top for the title) fills over the last 24 hours before
// launch, with a rocket riding its tip; the flame lights up in the last hour
// and while a launch is in flight.
// Main screen: NEXT (one launch in detail; swipe for the others), LAUNCHES
// (the upcoming or recent list; tap a row to see it on NEXT) and ORBIT (the
// ISS, Tiangong and recent payloads on a world map). After a while NEXT goes
// back to the next launch.

const RING_START = 0.85 // rad from 12 o'clock, as on Network, F1 and Sports
const RING_SPAN = (2*Math.PI - 2*RING_START) / (2*Math.PI)
const DAY = 24*60*60*1000
const BACK_TO_NEXT = 2*60*1000

export default class LaunchesWidget extends Widget {
  constructor() {
    super('launches', 'Launches')
    this._accent = ACCENT
    this.initState({ upcoming: [], recent: [], orbits: null, home: null })

    this._ring = new ProgressCircle()
    this._ring.color = ACCENT
    this._ring.lineWidth = 3
    this._ring.rotation = RING_START
    this.addChild(this._ring)
    this._rocket = new Rocket(ACCENT)
    this.addChild(this._rocket)

    const label = (fontSize, fill='#ffffff') => {
      const f = new TextField('', {
        fontFamily: 'ShareTechMono', fontSize, fill,
        stroke: fill, strokeThickness: fill === '#ffffff' ? 0.5 : 0, align: 'center',
      })
      this.addChild(f)
      return f
    }
    this._name = label(12)
    this._count = label(22)
    this._site = label(10, TEXT_GREY)
    this._lastCount = null

    this.main.title = 'Rocket Launches'
    const tabs = ['next', 'launches', 'orbit']
    tabs.forEach((name, i) => {
      const tab = this.main.getTabButton(i)
      tab.text = name
      tab.visible = true
    })
    this._detail = new LaunchScreen()
    this._detail.on('swipe', (step) => this._select(this._index + step))
    this.main.getPage(0).addChild(this._detail)
    this._lists = new ListsScreen()
    this._lists.on('select', (id) => this._show(id))
    this.main.getPage(1).addChild(this._lists)
    this._orbit = new OrbitScreen()
    this.main.getPage(2).addChild(this._orbit)
    this._index = 0 // into _all(): upcoming, then recent
    this._indexAt = 0
  }

  msg2state(msg) {
    if(!msg || typeof msg !== 'object') return null
    if(msg.error) return { error: msg.error }
    const valid = (list) => Array.isArray(list) ? list.filter(l => l && l.id && Number.isFinite(l.net)) : []
    const upcoming = valid(msg.upcoming)
    const recent = valid(msg.recent)
    if(!upcoming.length && !recent.length) return { error: 'No launch data' }
    const orbits = msg.orbits && Array.isArray(msg.orbits.stations) && Array.isArray(msg.orbits.launches) ? msg.orbits : null
    const home = msg.home && Number.isFinite(msg.home.lat) && Number.isFinite(msg.home.lon) ? msg.home : null
    return { upcoming, recent, orbits, home, error: null }
  }

  updateState(obj) {
    super.updateState(obj)
    if(!obj.upcoming) return
    // keep showing the same launch when the lists refresh
    const id = this._shown && this._shown.id
    const all = this._all()
    const found = id ? all.findIndex(l => l.id === id) : -1
    this._orbit.show(this.state.orbits, this.state.home)
    this._select(found >= 0 ? found : 0, false)
    this._lists.show(this.state.upcoming, this.state.recent)
    this._featured = this.state.upcoming[0] || null
    this._name.text = this._featured ? shortRocket(this._featured) : ''
    this._site.text = this._featured ? site(this._featured) : ''
    this._lastCount = null
  }

  _all() {
    return [...(this.state.upcoming || []), ...(this.state.recent || [])]
  }

  _select(index, byUser=true) {
    const all = this._all()
    if(!all.length) return this._detail.show(null, 0, 0)
    this._index = Math.max(0, Math.min(all.length - 1, index))
    if(byUser) this._indexAt = Date.now()
    this._shown = all[this._index]
    this._detail.show(this._shown, this._index, all.length, this._orbitNote(this._shown))
    this.main.statusLeftText = this._index < this.state.upcoming.length ? 'upcoming launch' : 'recent launch'
    this.main.statusRightText = 'all times local'
  }

  // for NEXT: where a recent launch's payload is, if CelesTrak tracks it
  _orbitNote(l) {
    const o = l && this.state.orbits && this.state.orbits.launches.find(x => x.launchId === l.id)
    if(!o) return ''
    const others = o.count - 1
    return `In orbit: ${o.name}${others > 0 ? ` and ${others} other object${others === 1 ? '' : 's'}` : ''} (${o.designator}). See it on the ORBIT tab.`
  }

  _show(id) {
    const index = this._all().findIndex(l => l.id === id)
    if(index < 0) return
    this._select(index)
    this.main.activateTab(0)
  }

  render(renderer) {
    const now = Date.now()
    if(this._index && now - this._indexAt > BACK_TO_NEXT) this._select(0, false)
    const p = this.progress * this.dataLoadProgress
    const l = this._featured

    // the ring fills over the last day before an exactly timed launch
    const left = l ? l.net - now : Infinity
    const filled = l && exact(l) ? Math.max(0, Math.min(1, 1 - left / DAY)) : 0
    this._ring.progress = p
    this._ring.size = this.size
    this._ring.value = RING_SPAN * filled

    // the rocket rides the inside of the ring at its tip, nose clockwise
    const angle = RING_START + 2*Math.PI * this._ring._presentedValue * p
    const scale = 0.6 + 0.4*this.size
    const r = 100*this.size - 9*scale
    this._rocket.x = r * Math.sin(angle)
    this._rocket.y = -r * Math.cos(angle)
    this._rocket.rotation = angle
    this._rocket.scale.set(scale)
    this._rocket.alpha = p
    this._rocket.visible = !!l
    this._rocket.flame = !!l && (l.status === 'In Flight' || (exact(l) && left < 60*60*1000))

    const count = l ? countdown(l, now) : ''
    if(count !== this._lastCount) {
      this._lastCount = count
      this._count.text = count
    }
    this._count.progress = p
    // 22 on a large circle, 13 on a small one, so T-1D 05:12 fits either
    this._count.style.fontSize = 4 + 18*this.size
    this._count.y = 14*(1 - this.size) // a little lower on a small circle, centring the pair
    this._name.progress = p
    this._name.style.fontSize = 9 + 3*this.size
    this._name.y = -26*this.size + 8*(1 - this.size)
    this._site.progress = p
    this._site.y = 24*this.size
    this._site.visible = this.size === 1

    const pages = this.main.progress * this.dataLoadProgress
    this._detail.progress = pages
    this._lists.progress = pages
    this._orbit.progress = pages
    super.render(renderer)
  }
}
