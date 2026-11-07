const Service = require('../../backend/services/Service.js')

// Formula 1 drivers' and constructors' championship standings and the race
// calendar from Jolpica-F1 (api.jolpi.ca), the free successor of the Ergast
// API. No key; its limits (4 requests/s, 500/hour) are far above the three
// requests this makes every hour. Standings only change after a race.

const USER_AGENT = 'desk-hud (https://github.com/johnbaikie/desk-hud)'
const API = 'https://api.jolpi.ca/ergast/f1'
const TICK = 60*60*1000
const RETRY = 5*60*1000 // after a failure
const REQUEST_TIMEOUT = 20*1000

// API session keys -> labels, in weekend order
const SESSIONS = [
  ['FirstPractice', 'Practice 1'],
  ['SecondPractice', 'Practice 2'],
  ['ThirdPractice', 'Practice 3'],
  ['SprintQualifying', 'Sprint Quali'],
  ['SprintShootout', 'Sprint Quali'],
  ['Sprint', 'Sprint'],
  ['Qualifying', 'Qualifying'],
]

const sessionTime = (s) => s && s.date ? Date.parse(`${s.date}T${s.time || '00:00:00Z'}`) : NaN

// "Haas F1 Team" -> "Haas", "RB F1 Team" -> "Racing Bulls"
function teamName(name) {
  if(name === 'RB F1 Team') return 'Racing Bulls'
  return String(name || '').replace(/ F1 Team$/, '')
}

class F1Service extends Service {
  constructor(config, io, webApp) {
    super(config, io, webApp, 'f1')
    this._timer = null
    this._last = null
  }

  async start() {
    this.update() // not awaited: start() must resolve even if the API hangs
  }

  async welcomeClient(socket) {
    if(this._last) this.emit(this._last, socket)
  }

  async onMessage() {}

  async _get(path) {
    const response = await fetch(`${API}/${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    if(!response.ok) throw new Error(`F1 API: HTTP ${response.status}`)
    const json = await response.json()
    if(!json || !json.MRData) throw new Error('F1 API: unexpected response')
    return json.MRData
  }

  async _standings(season) {
    const [d, c] = await Promise.all([
      this._get(`${season}/driverStandings.json?limit=100`),
      this._get(`${season}/constructorStandings.json?limit=100`),
    ])
    const dl = (d.StandingsTable && d.StandingsTable.StandingsLists || [])[0]
    const cl = (c.StandingsTable && c.StandingsTable.StandingsLists || [])[0]
    if(!dl || !Array.isArray(dl.DriverStandings) || !dl.DriverStandings.length) return null
    return {
      season: String(dl.season),
      round: Number(dl.round),
      drivers: dl.DriverStandings.map(s => ({
        pos: Number(s.position) || null,
        code: s.Driver && (s.Driver.code || String(s.Driver.familyName || '').slice(0, 3).toUpperCase()),
        name: s.Driver ? s.Driver.familyName : '?',
        team: teamName(s.Constructors && s.Constructors.length ? s.Constructors[s.Constructors.length-1].name : ''),
        points: Number(s.points) || 0,
        wins: Number(s.wins) || 0,
      })),
      constructors: (cl && Array.isArray(cl.ConstructorStandings) ? cl.ConstructorStandings : []).map(s => ({
        pos: Number(s.position) || null,
        name: teamName(s.Constructor && s.Constructor.name),
        points: Number(s.points) || 0,
        wins: Number(s.wins) || 0,
      })),
    }
  }

  async _fetchAll() {
    const races = await this._get('current.json?limit=100')
    const list = races.RaceTable && Array.isArray(races.RaceTable.Races) ? races.RaceTable.Races : []
    const season = races.RaceTable && races.RaceTable.season
    if(!season) throw new Error('F1 API: no season in the race calendar')

    // before the first race of a season, show last season's final standings
    let standings = await this._standings('current')
    if(!standings) standings = await this._standings(Number(season) - 1)
    if(!standings) throw new Error('No F1 standings available')

    const now = Date.now()
    // the next race is the first one that hasn't finished (about 2 h after its start)
    const next = list.find(r => sessionTime(r) + 2*60*60*1000 > now)
    const nextRace = next ? {
      round: Number(next.round),
      name: next.raceName,
      circuit: next.Circuit ? next.Circuit.circuitName : '',
      locality: next.Circuit && next.Circuit.Location ? next.Circuit.Location.locality : '',
      country: next.Circuit && next.Circuit.Location ? next.Circuit.Location.country : '',
      start: sessionTime(next),
      sprint: !!next.Sprint,
      sessions: SESSIONS
        .filter(([key]) => next[key])
        .map(([key, label]) => ({ name: label, t: sessionTime(next[key]) }))
        .concat([{ name: 'Race', t: sessionTime(next) }])
        .filter(s => Number.isFinite(s.t))
        .sort((a, b) => a.t - b.t),
    } : null

    return {
      ...standings,
      calendarSeason: String(season),
      totalRounds: list.length,
      nextRace,
      updated: now,
      error: null,
    }
  }

  async update() {
    clearTimeout(this._timer)
    let wait = TICK
    try {
      this._last = await this._fetchAll()
      this.emit(this._last)
    } catch(err) {
      this.logger.error(err)
      wait = RETRY
      // keep showing the last good standings; only fail without any
      if(!this._last) this.emit({error: String(err.message || err)})
    }
    this._timer = setTimeout(() => this.update(), wait)
  }
}

module.exports = F1Service
