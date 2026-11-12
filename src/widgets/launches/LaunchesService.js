const Service = require('../../backend/services/Service.js')
const storage = require('node-persist')

// Rocket launches worldwide from The Space Devs' Launch Library 2
// (ll.thespacedevs.com, no key). Anonymous use allows 15 requests an hour,
// so this keeps its own budget of 12: the upcoming list every 20 minutes
// (every 5 while a launch is due within the hour), recent launches every
// hour. The last good lists are kept in node-persist, so a restart or a
// failing request doesn't blank the widget.

const USER_AGENT = 'desk-hud (https://github.com/johnbaikie/desk-hud)'
const API = 'https://ll.thespacedevs.com/2.3.0/launches'
const TICK = 60*1000
const UPCOMING_EVERY = 20*60*1000
const UPCOMING_NEAR = 5*60*1000   // while a launch is due within NEAR
const NEAR = 60*60*1000
const RECENT_EVERY = 60*60*1000
const RETRY = 10*60*1000
const BACKOFF = 30*60*1000        // after a 429
const BUDGET = 12                 // requests an hour (the API allows 15)
const REQUEST_TIMEOUT = 20*1000
const COUNT = 10
// statuses of a launch that has happened (LL2 status abbreviations)
const DONE = ['Success', 'Failure', 'Partial Failure']

const str = (v) => typeof v === 'string' ? v.trim() : ''
const time = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : null }

// one LL2 launch -> the fields the widget shows
function simplify(l) {
  if(!l || typeof l !== 'object') return null
  const net = time(l.net)
  if(!str(l.id) || net === null) return null
  const rocket = (l.rocket && l.rocket.configuration) || {}
  const mission = l.mission || {}
  const pad = l.pad || {}
  const status = l.status || {}
  const provider = l.launch_service_provider || {}
  return {
    id: str(l.id),
    name: str(l.name),
    net,
    precision: str(l.net_precision && l.net_precision.abbrev), // SEC, MIN, HR, DAY, MON...
    windowStart: time(l.window_start),
    windowEnd: time(l.window_end),
    status: str(status.abbrev) || 'TBD',
    statusName: str(status.name),
    rocket: str(rocket.full_name) || str(rocket.name),
    provider: str(provider.name),
    providerAbbrev: str(provider.abbrev),
    mission: str(mission.name) || str(l.name).split('|').pop().trim(),
    missionType: str(mission.type),
    orbit: str(mission.orbit && mission.orbit.abbrev),
    description: str(mission.description),
    pad: str(pad.name),
    location: str(pad.location && pad.location.name),
    probability: Number.isFinite(l.probability) ? l.probability : null,
    weather: str(l.weather_concerns),
    webcastLive: l.webcast_live === true,
    failReason: str(l.failreason),
  }
}

class LaunchesService extends Service {
  constructor(config, io, webApp) {
    super(config, io, webApp, 'launches')
    this._upcoming = []
    this._recent = []
    this._errors = {}   // list -> message, while it fails
    this._nextAt = {}   // list -> time of the next request
    this._requests = [] // times of requests in the last hour
    this._timer = null
  }

  async start() {
    try {
      const saved = await storage.getItem('launches.lists')
      if(saved && typeof saved === 'object') {
        const valid = (list) => Array.isArray(list) ? list.filter(l => l && l.id && Number.isFinite(l.net)) : []
        this._upcoming = valid(saved.upcoming)
        this._recent = valid(saved.recent)
      }
    } catch(err) {
      this.logger.error('Saved launches:', err.message || err)
    }
    this._tick() // not awaited: start() must resolve even if the API hangs
  }

  async welcomeClient(socket) {
    if(this._upcoming.length || this._recent.length || Object.keys(this._errors).length) {
      this.emit(this._payload(), socket)
    }
  }

  async onMessage() {}

  _payload() {
    const now = Date.now()
    // a launch stays in "upcoming" until LL2 marks it done, then moves to recent
    const upcoming = this._upcoming.filter(l => !DONE.includes(l.status))
    const recentIds = new Set(this._recent.map(l => l.id))
    const justDone = this._upcoming.filter(l => DONE.includes(l.status) && !recentIds.has(l.id))
    const recent = [...justDone, ...this._recent].sort((a, b) => b.net - a.net).slice(0, COUNT)
    const error = !upcoming.length && !recent.length
      ? (this._errors.upcoming || this._errors.recent || 'No launch data') : null
    return { upcoming: upcoming.slice(0, COUNT), recent, errors: this._errors, updated: now, error }
  }

  async _get(path) {
    const hourAgo = Date.now() - 60*60*1000
    this._requests = this._requests.filter(t => t > hourAgo)
    if(this._requests.length >= BUDGET) throw Object.assign(new Error('waiting for the hourly request limit'), { budget: true })
    this._requests.push(Date.now())
    const response = await fetch(`${API}/${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    if(response.status === 429) throw Object.assign(new Error('Launch Library: too many requests'), { throttled: true })
    if(!response.ok) throw new Error(`Launch Library: HTTP ${response.status}`)
    const json = await response.json()
    if(!json || !Array.isArray(json.results)) throw new Error('Launch Library: unexpected response')
    const list = json.results.map(simplify).filter(Boolean)
    if(json.results.length && !list.length) throw new Error('Launch Library: unexpected response')
    return list
  }

  async _tick() {
    clearTimeout(this._timer)
    const now = Date.now()
    const next = this._upcoming.find(l => !DONE.includes(l.status) && l.net > now - NEAR)
    const near = next && next.net - now < NEAR
    const lists = {
      upcoming: () => this._get(`upcoming/?limit=${COUNT + 2}&mode=normal`),
      recent: () => this._get(`previous/?limit=${COUNT}&mode=normal`),
    }
    let changed = false
    for(const [name, load] of Object.entries(lists)) {
      if(this._nextAt[name] && now < this._nextAt[name]) continue
      try {
        const list = await load()
        if(name === 'upcoming') this._upcoming = list.sort((a, b) => a.net - b.net)
        else this._recent = list.sort((a, b) => b.net - a.net)
        delete this._errors[name]
        this._nextAt[name] = now + (name === 'upcoming' ? (near ? UPCOMING_NEAR : UPCOMING_EVERY) : RECENT_EVERY)
        changed = true
      } catch(err) {
        if(err.budget) { this._nextAt[name] = now + 5*60*1000; continue }
        this.logger.error(`Launches ${name}:`, err.message || err)
        this._errors[name] = String(err.message || err)
        this._nextAt[name] = now + (err.throttled ? BACKOFF : RETRY)
        changed = true
      }
    }
    // a launch due soon: look again sooner, within the budget
    if(near && !this._errors.upcoming && this._nextAt.upcoming - now > UPCOMING_NEAR) this._nextAt.upcoming = now + UPCOMING_NEAR
    if(changed) {
      try {
        await storage.setItem('launches.lists', { upcoming: this._upcoming, recent: this._recent })
      } catch(err) {
        this.logger.error('Saving launches:', err.message || err)
      }
      this.emit(this._payload())
    }
    this._timer = setTimeout(() => this._tick(), TICK)
  }
}

module.exports = LaunchesService
module.exports.simplify = simplify
