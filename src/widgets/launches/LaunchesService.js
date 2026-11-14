const Service = require('../../backend/services/Service.js')
const storage = require('node-persist')

// Rocket launches worldwide from The Space Devs' Launch Library 2
// (ll.thespacedevs.com, no key). Anonymous use allows 15 requests an hour,
// so this keeps its own budget of 12: the upcoming list every 20 minutes
// (every 5 while a launch is due within the hour), recent launches every
// hour. The last good lists are kept in node-persist, so a restart or a
// failing request doesn't blank the widget.
//
// Orbits (the ORBIT tab): CelesTrak's orbital elements (OMM JSON; new
// objects have six-digit catalogue numbers that the old TLE format can't
// hold) for the ISS and Tiangong, and for the payloads of recent launches.
// A launch is matched to its objects by its international designator when
// LL2 has one, else by CelesTrak's satellite catalogue: the launch date
// (UTC) and, if several launches share it, the launch site. Objects are
// only catalogued hours to a day after launch. CelesTrak updates every two
// hours and asks not to be polled faster, so this reads it every two hours
// (three requests). The browser works out positions from the elements.

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
const CELESTRAK = 'https://celestrak.org'
const ORBITS_EVERY = 2*60*60*1000
const ORBITS_RETRY = 30*60*1000
const STATIONS = [{ id: 25544, name: 'ISS' }, { id: 48274, name: 'Tiangong' }]
// CelesTrak SATCAT launch site codes -> words in LL2's location names
const SITES = {
  AFWTR: ['vandenberg'], AFETR: ['cape canaveral', 'kennedy'], WLPIS: ['wallops'],
  JSC: ['jiuquan'], TSC: ['taiyuan'], XSC: ['xichang'], XICLF: ['xichang'], WSC: ['wenchang'],
  YSLA: ['yellow sea', 'sea launch'], HNSPC: ['hainan'], PLMSC: ['plesetsk'], TTMTR: ['baikonur'],
  VOSTO: ['vostochny'], RLLB: ['mahia', 'rocket lab'], FRGUI: ['guiana', 'kourou'],
  SRILR: ['satish dhawan', 'sriharikota'], TNSTA: ['tanegashima'], KYMSC: ['uchinoura'],
}
// statuses of a launch that has happened (LL2 status abbreviations)
const DONE = ['Success', 'Failure', 'Partial Failure', 'Deployed'] // Deployed: payload deployed

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
    designator: str(l.launch_designator), // e.g. "2026-254"; LL2 adds it days after launch
    statusDescription: str(status.description),
    programs: Array.isArray(l.program) ? l.program.map(p => str(p && p.name)).filter(Boolean) : [],
    providerType: str(provider.type && provider.type.name),
    // this launch's number in its calendar year: for the provider, worldwide (orbital), from the pad and the site
    countYear: {
      provider: Number.isFinite(l.agency_launch_attempt_count_year) ? l.agency_launch_attempt_count_year : null,
      orbital: Number.isFinite(l.orbital_launch_attempt_count_year) ? l.orbital_launch_attempt_count_year : null,
      pad: Number.isFinite(l.pad_launch_attempt_count_year) ? l.pad_launch_attempt_count_year : null,
      location: Number.isFinite(l.location_launch_attempt_count_year) ? l.location_launch_attempt_count_year : null,
    },
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
    this._orbits = null // {stations, launches, fetched}
    this._home = null
    this._timer = null
  }

  async start() {
    // home, for "next ISS pass" on the ORBIT tab: the weather location (optional)
    try {
      const lat = Number(this.config.getProp('weather.lat'))
      const lon = Number(this.config.getProp('weather.lon'))
      if(Number.isFinite(lat) && Number.isFinite(lon)) this._home = { lat, lon }
    } catch(err) {
      this._home = null
    }
    try {
      const saved = await storage.getItem('launches.lists')
      if(saved && typeof saved === 'object') {
        const valid = (list) => Array.isArray(list) ? list.filter(l => l && l.id && Number.isFinite(l.net)) : []
        this._upcoming = valid(saved.upcoming)
        this._recent = valid(saved.recent)
        if(saved.orbits && Array.isArray(saved.orbits.stations) && Array.isArray(saved.orbits.launches)) {
          this._orbits = saved.orbits
          // don't ask CelesTrak again after a restart if its data is still fresh
          if(Number.isFinite(saved.orbits.fetched)) this._nextAt.orbits = saved.orbits.fetched + ORBITS_EVERY
        }
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
    // a launch stays in "upcoming" until LL2 marks it done or lists it as previous
    const recentIds = new Set(this._recent.map(l => l.id))
    const upcoming = this._upcoming.filter(l => !DONE.includes(l.status) && !recentIds.has(l.id))
    const justDone = this._upcoming.filter(l => DONE.includes(l.status) && !recentIds.has(l.id))
    const recent = [...justDone, ...this._recent].sort((a, b) => b.net - a.net).slice(0, COUNT)
    const error = !upcoming.length && !recent.length
      ? (this._errors.upcoming || this._errors.recent || 'No launch data') : null
    return { upcoming: upcoming.slice(0, COUNT), recent, orbits: this._orbits, home: this._home, errors: this._errors, updated: now, error }
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

  async _getJson(url) {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    if(!response.ok) throw new Error(`CelesTrak: HTTP ${response.status}`)
    const json = await response.json()
    if(!Array.isArray(json)) throw new Error('CelesTrak: unexpected response')
    return json
  }

  // CelesTrak elements for the stations and recent launches' payloads
  async _loadOrbits() {
    const [stationsGp, recentGp, satcat] = await Promise.all([
      this._getJson(`${CELESTRAK}/NORAD/elements/gp.php?GROUP=stations&FORMAT=json`),
      this._getJson(`${CELESTRAK}/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=json`),
      this._getJson(`${CELESTRAK}/satcat/records.php?GROUP=last-30-days&FORMAT=json`),
    ])
    const omm = (o) => o && typeof o === 'object' && Number.isFinite(o.MEAN_MOTION) && typeof o.EPOCH === 'string'
    const gpById = new Map()
    for(const o of [...stationsGp, ...recentGp]) if(omm(o)) gpById.set(o.NORAD_CAT_ID, o)
    const stations = STATIONS.filter(s => gpById.has(s.id)).map(s => ({ name: s.name, omm: gpById.get(s.id) }))

    // SATCAT objects by launch ("2026-254"), and launches by UTC date
    const byLaunch = new Map()
    for(const o of satcat) {
      if(!o || typeof o.OBJECT_ID !== 'string' || !/^\d{4}-\d{3}/.test(o.OBJECT_ID)) continue
      const key = o.OBJECT_ID.slice(0, 8)
      if(!byLaunch.has(key)) byLaunch.set(key, { key, date: o.LAUNCH_DATE, site: o.LAUNCH_SITE, objects: [] })
      byLaunch.get(key).objects.push(o)
    }
    const now = Date.now()
    const launches = []
    const done = [...this._upcoming.filter(l => DONE.includes(l.status)), ...this._recent]
    const seen = new Set()
    for(const l of done) {
      if(seen.has(l.id) || l.net > now - 60*60*1000) continue
      seen.add(l.id)
      let entry = l.designator ? byLaunch.get(l.designator) : null
      if(!entry) {
        const date = new Date(l.net).toISOString().slice(0, 10)
        let candidates = [...byLaunch.values()].filter(e => e.date === date)
        // a known site must match; an unknown site code is allowed only if it is the only launch that day
        const where = (l.location || '').toLowerCase()
        const matches = (e) => SITES[e.site] ? SITES[e.site].some(word => where.includes(word)) : null
        const bySite = candidates.filter(e => matches(e) === true)
        candidates = bySite.length ? bySite : candidates.filter(e => matches(e) === null)
        if(candidates.length === 1) entry = candidates[0]
      }
      if(!entry) continue
      const tracked = entry.objects.filter(o => gpById.has(o.NORAD_CAT_ID))
      const main = tracked.find(o => o.OBJECT_TYPE === 'PAY') || tracked[0]
      if(!main) continue
      launches.push({
        launchId: l.id,
        mission: l.mission,
        rocket: l.rocket,
        net: l.net,
        designator: entry.key,
        name: str(main.OBJECT_NAME),
        count: entry.objects.length,
        omm: gpById.get(main.NORAD_CAT_ID),
      })
    }
    if(!stations.length && !launches.length) throw new Error('CelesTrak: no orbits found')
    return { stations, launches, fetched: now }
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
    if(!this._nextAt.orbits || now >= this._nextAt.orbits) {
      try {
        this._orbits = await this._loadOrbits()
        delete this._errors.orbits
        this._nextAt.orbits = now + ORBITS_EVERY
      } catch(err) {
        this.logger.error('Launches orbits:', err.message || err)
        this._errors.orbits = String(err.message || err)
        this._nextAt.orbits = now + ORBITS_RETRY
      }
      changed = true
    }
    // a launch due soon: look again sooner, within the budget
    if(near && !this._errors.upcoming && this._nextAt.upcoming - now > UPCOMING_NEAR) this._nextAt.upcoming = now + UPCOMING_NEAR
    if(changed) {
      try {
        await storage.setItem('launches.lists', { upcoming: this._upcoming, recent: this._recent, orbits: this._orbits })
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
