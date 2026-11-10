const Service = require('../../backend/services/Service.js')
const storage = require('node-persist')

// Formula 1 for the F1 widget, from two free APIs without keys:
// - Jolpica-F1 (api.jolpi.ca), the successor of the Ergast API: drivers' and
//   constructors' standings and the season calendar (rounds, session times).
//   Limits: 4 requests/s, 500/hour; this makes three requests an hour.
// - OpenF1 (api.openf1.org): every session's classification, practice
//   included, which Jolpica doesn't have. Historical data is free (live
//   timing needs a paid account), but while any F1 session is live it turns
//   away free users for everything, past sessions included (HTTP 401). Its
//   session list is read hourly and matched to the calendar by type and start
//   time.
// Results are fetched when the widget asks for a session, and finished
// sessions of the last two weekends are fetched ahead, in the gaps between
// sessions, so they are there during the next one. Finished sessions are kept
// in node-persist, as is OpenF1's session list. Qualifying, sprint and race
// results fall back to Jolpica when OpenF1 is closed.

const USER_AGENT = 'desk-hud (https://github.com/johnbaikie/desk-hud)'
const API = 'https://api.jolpi.ca/ergast/f1'
const OPENF1 = 'https://api.openf1.org/v1'
const TICK = 60*60*1000
const RETRY = 5*60*1000 // after a failure
const REQUEST_TIMEOUT = 20*1000
const HOUR = 60*60*1000
const OPENF1_SPACING = 400 // ms between OpenF1 requests
const OPENF1_RETRY = 10*60*1000 // while OpenF1 is closed or failing
const LOCKED = 'OpenF1 is closed to free users while a session is live; results return when it ends'
// sessions Jolpica has results for, and its endpoint and list for them
const JOLPICA_RESULTS = {
  Q: ['qualifying', 'QualifyingResults'],
  SP: ['sprint', 'SprintResults'],
  GP: ['results', 'Results'],
}
// team colours for Jolpica results (OpenF1 gives its own), by constructorId
const TEAM_COLOURS = {
  mercedes: '00D7B6', ferrari: 'ED1131', red_bull: '4781D7', mclaren: 'F47600',
  rb: '6C98FF', alpine: '00A1E8', haas: '9C9FA2', audi: 'F50537', sauber: '01C00E',
  williams: '1868DB', aston_martin: '229971', cadillac: '909090',
}

// Jolpica session keys -> short code and label, in weekend order
const SESSIONS = [
  ['FirstPractice', 'P1', 'Practice 1'],
  ['SecondPractice', 'P2', 'Practice 2'],
  ['ThirdPractice', 'P3', 'Practice 3'],
  ['SprintQualifying', 'SQ', 'Sprint Quali'],
  ['SprintShootout', 'SQ', 'Sprint Quali'],
  ['Sprint', 'SP', 'Sprint'],
  ['Qualifying', 'Q', 'Qualifying'],
]
// OpenF1 session names -> the same codes
const OPENF1_CODES = {
  'Practice 1': 'P1', 'Practice 2': 'P2', 'Practice 3': 'P3',
  'Sprint Qualifying': 'SQ', 'Sprint Shootout': 'SQ',
  'Sprint': 'SP', 'Qualifying': 'Q', 'Race': 'GP',
}
// session lengths when OpenF1 hasn't given an end time
const LENGTH = { P1: HOUR, P2: HOUR, P3: HOUR, SQ: HOUR, SP: HOUR, Q: HOUR, GP: 2*HOUR }

const sessionTime = (s) => s && s.date ? Date.parse(`${s.date}T${s.time || '00:00:00Z'}`) : NaN

// "Haas F1 Team" -> "Haas", "RB F1 Team" -> "Racing Bulls"
function teamName(name) {
  if(name === 'RB F1 Team') return 'Racing Bulls'
  return String(name || '').replace(/ F1 Team$/, '')
}

const num = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null
// "1:16.514" -> 76.514
const lapSeconds = (text) => {
  const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(String(text || '').trim())
  return m ? 60*Number(m[1] || 0) + Number(m[2]) : null
}
const friendly = (err) => /HTTP 401/.test(String(err && err.message || err)) ? LOCKED : 'OpenF1 unavailable: ' + String(err && err.message || err)

class F1Service extends Service {
  constructor(config, io, webApp) {
    super(config, io, webApp, 'f1')
    this._timer = null
    this._last = null
    this._openf1Sessions = [] // last good OpenF1 session list
    this._openf1Status = null // why OpenF1 can't be used now, or null
    this._results = {} // session id ("19:Q") -> finished session's rows
    this._queue = Promise.resolve() // one results request at a time
    this._openf1Next = 0
  }

  async start() {
    // what earlier runs saved (checked: a bad entry is dropped)
    try {
      const sessions = await storage.getItem('f1.openf1Sessions')
      if(Array.isArray(sessions)) {
        this._openf1Sessions = sessions.filter(s => s && Number.isFinite(s.key) && Number.isFinite(s.start) && s.code)
      }
      const results = await storage.getItem('f1.results')
      if(results && typeof results === 'object') {
        for(const [id, rows] of Object.entries(results)) {
          if(/^\d+:[A-Z0-9]+$/.test(id) && Array.isArray(rows) && rows.length) this._results[id] = rows
        }
      }
    } catch(err) {
      this.logger.error('F1 saved data:', err.message || err)
    }
    this.update() // not awaited: start() must resolve even if the API hangs
  }

  async welcomeClient(socket) {
    if(this._last) this.emit(this._last, socket)
  }

  async onMessage(payload) {
    if(payload && payload.action === 'results' && typeof payload.id === 'string') {
      this._queue = this._queue.then(() => this._sendResults(payload.id))
    }
  }

  async _getJson(url, accept='application/json') {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: accept },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    if(!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).host}`)
    return response.json()
  }

  // OpenF1 allows 3 requests a second: space them out and retry when it
  // answers 429 (too many requests)
  async _openf1(path) {
    for(let attempt = 0; ; attempt++) {
      const wait = this._openf1Next - Date.now()
      if(wait > 0) await new Promise(r => setTimeout(r, wait))
      this._openf1Next = Date.now() + OPENF1_SPACING
      try {
        return await this._getJson(`${OPENF1}/${path}`)
      } catch(err) {
        if(attempt >= 2 || !/HTTP 429/.test(err.message)) throw err
        this._openf1Next = Date.now() + 1500*(attempt + 1)
      }
    }
  }

  async _get(path) {
    const json = await this._getJson(`${API}/${path}`)
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

  // OpenF1's sessions for the season; on failure the last good list is kept
  async _fetchOpenF1Sessions(season) {
    try {
      const list = await this._openf1(`sessions?year=${season}`)
      if(!Array.isArray(list)) throw new Error('OpenF1: unexpected session list')
      this._openf1Sessions = list
        .filter(s => s && OPENF1_CODES[s.session_name] && !s.is_cancelled)
        .map(s => ({
          key: s.session_key,
          code: OPENF1_CODES[s.session_name],
          start: Date.parse(s.date_start),
          end: Date.parse(s.date_end),
        }))
        .filter(s => Number.isFinite(s.key) && Number.isFinite(s.start))
      this._openf1Status = null
      await storage.setItem('f1.openf1Sessions', this._openf1Sessions)
    } catch(err) {
      this.logger.error('OpenF1 sessions:', err.message || err)
      this._openf1Status = friendly(err)
    }
    return this._openf1Sessions
  }

  // the calendar as weekends, each session with its OpenF1 key when known
  _weekends(races, openf1) {
    return races.map(race => {
      const sessions = SESSIONS
        .filter(([key]) => race[key])
        .map(([key, code, name]) => ({ code, name, t: sessionTime(race[key]) }))
        .concat([{ code: 'GP', name: 'Race', t: sessionTime(race) }])
        .filter(s => Number.isFinite(s.t))
        .sort((a, b) => a.t - b.t)
        .map(s => {
          const match = openf1.find(o => o.code === s.code && Math.abs(o.start - s.t) < 3*HOUR)
          return {
            ...s,
            id: `${race.round}:${s.code}`,
            end: match && Number.isFinite(match.end) ? match.end : s.t + LENGTH[s.code],
            key: match ? match.key : null,
          }
        })
      return {
        round: Number(race.round),
        name: race.raceName,
        circuit: race.Circuit ? race.Circuit.circuitName : '',
        locality: race.Circuit && race.Circuit.Location ? race.Circuit.Location.locality : '',
        country: race.Circuit && race.Circuit.Location ? race.Circuit.Location.country : '',
        start: sessionTime(race),
        sprint: !!race.Sprint,
        sessions,
      }
    })
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

    const weekends = this._weekends(list, await this._fetchOpenF1Sessions(season))
    const now = Date.now()
    // the next race is the first one that hasn't finished
    const next = weekends.find(w => w.sessions[w.sessions.length-1].end > now) || null
    const nextRace = next ? {
      ...next,
      sessions: next.sessions.map(s => ({ name: s.name, t: s.t })),
    } : null

    return {
      ...standings,
      calendarSeason: String(season),
      totalRounds: list.length,
      nextRace,
      weekends,
      openf1: this._openf1Status,
      updated: now,
      error: null,
    }
  }

  _session(id) {
    const weekends = this._last && this._last.weekends || []
    for(const w of weekends) {
      const session = w.sessions.find(s => s.id === id)
      if(session) return { ...session, round: w.round }
    }
    return null
  }

  // one session's classification, sent as {results: {id, rows | error}}
  async _sendResults(id) {
    try {
      const rows = await this._fetchResults(id)
      this.emit({ results: { id, rows } })
    } catch(err) {
      this.emit({ results: { id, rows: null, error: String(err.message || err) } })
    }
  }

  // from the saved results, OpenF1, or Jolpica (qualifying, sprint, race)
  async _fetchResults(id) {
    if(this._results[id]) return this._results[id]
    const session = this._session(id)
    if(!session) throw new Error('Unknown session')
    let rows = null
    let error = null
    if(session.key) {
      try {
        const results = await this._openf1(`session_result?session_key=${session.key}`)
        const drivers = await this._openf1(`drivers?session_key=${session.key}`)
        if(!Array.isArray(results) || !Array.isArray(drivers)) throw new Error('unexpected results')
        rows = this._rows(results, drivers)
      } catch(err) {
        this.logger.error(`OpenF1 results ${id}:`, err.message || err)
        error = friendly(err)
        if(error === LOCKED) this._openf1Status = LOCKED
      }
    } else {
      error = this._openf1Status || 'No timing data for this session'
    }
    if((!rows || !rows.length) && JOLPICA_RESULTS[session.code]) {
      try {
        const fallback = await this._jolpicaRows(session.round, session.code)
        if(fallback.length) { rows = fallback; error = null }
      } catch(err) {
        this.logger.error(`Jolpica results ${id}:`, err.message || err)
      }
    }
    if(!rows) throw new Error(error || 'No results')
    // keep finished sessions; results can still change for a while after
    if(rows.length && session.end + HOUR < Date.now()) {
      this._results[id] = rows
      await storage.setItem('f1.results', this._results)
    }
    return rows
  }

  // Jolpica's qualifying, sprint or race classification, as rows
  async _jolpicaRows(round, code) {
    const [endpoint, listName] = JOLPICA_RESULTS[code]
    const season = this._last ? this._last.calendarSeason : 'current'
    const data = await this._get(`${season}/${round}/${endpoint}.json?limit=100`)
    const race = (data.RaceTable && data.RaceTable.Races || [])[0]
    const list = race && Array.isArray(race[listName]) ? race[listName] : []
    const base = (r) => ({
      number: Number(r.number) || 0,
      code: r.Driver && (r.Driver.code || String(r.Driver.familyName || '').slice(0, 3).toUpperCase()),
      name: r.Driver ? r.Driver.familyName : '',
      team: teamName(r.Constructor && r.Constructor.name),
      colour: r.Constructor ? TEAM_COLOURS[r.Constructor.constructorId] || null : null,
      points: null,
      status: null,
    })
    if(code === 'Q') {
      const rows = list.map(r => {
        const parts = [r.Q1, r.Q2, r.Q3].map(lapSeconds)
        const i = parts.reduce((last, t, j) => t !== null ? j : last, -1)
        return { ...base(r), pos: Number(r.position) || null, laps: null, time: i >= 0 ? parts[i] : null, gap: null, part: i >= 0 ? `Q${i+1}` : null }
      })
      // the gap is to the fastest in the same part
      rows.forEach(row => {
        const best = Math.min(...rows.filter(r => r.part === row.part && r.time !== null).map(r => r.time))
        row.gap = row.time !== null && Number.isFinite(best) ? Number((row.time - best).toFixed(3)) : null
      })
      return rows
    }
    const leader = list.find(r => r.Time && r.Time.millis)
    const leaderMs = leader ? Number(leader.Time.millis) : null
    return list.map(r => {
      const classified = /^\d+$/.test(r.positionText || '')
      const ms = r.Time && r.Time.millis ? Number(r.Time.millis) : null
      const lapped = /^\+\d+ Laps?$/i.test(r.status || '')
      return {
        ...base(r),
        pos: classified ? Number(r.positionText) : null,
        laps: Number(r.laps) || 0,
        time: ms !== null ? ms/1000 : null,
        gap: ms !== null && leaderMs !== null ? Number(((ms - leaderMs)/1000).toFixed(3)) : (lapped ? r.status : null),
        part: null,
        points: Number(r.points) || 0,
        status: classified ? null : ({ D: 'DSQ', W: 'DNS', E: 'DSQ', F: 'DNQ' }[r.positionText] || 'DNF'),
      }
    })
  }

  // fetch the finished sessions of the last two weekends that aren't saved
  // yet, so they're there when a later session closes OpenF1
  _prefetch() {
    const now = Date.now()
    const weekends = (this._last && this._last.weekends || []).filter(w => w.sessions.some(s => s.end + HOUR < now))
    const ids = weekends.slice(-2)
      .flatMap(w => w.sessions)
      .filter(s => s.end + HOUR < now && !this._results[s.id])
      .filter(s => (s.key && !this._openf1Status) || JOLPICA_RESULTS[s.code])
      .map(s => s.id)
    for(const id of ids) {
      this._queue = this._queue.then(() => this._fetchResults(id).catch(() => {}))
    }
  }

  _rows(results, drivers) {
    const byNumber = new Map(drivers.map(d => [d.driver_number, d]))
    return results
      .filter(r => r && Number.isFinite(r.driver_number))
      .map(r => {
        const d = byNumber.get(r.driver_number) || {}
        // qualifying gives [Q1, Q2, Q3]: use the last part the driver set a time in
        let time = r.duration
        let gap = r.gap_to_leader
        let part = null
        if(Array.isArray(time)) {
          const i = time.reduce((last, t, j) => num(t) !== null ? j : last, -1)
          part = i >= 0 ? `Q${i+1}` : null
          time = i >= 0 ? time[i] : null
          gap = Array.isArray(gap) && i >= 0 ? gap[i] : null
        }
        return {
          pos: Number.isFinite(r.position) ? r.position : null,
          number: r.driver_number,
          code: d.name_acronym || String(r.driver_number),
          name: d.last_name || '',
          team: teamName(d.team_name),
          colour: /^[0-9a-f]{6}$/i.test(d.team_colour || '') ? d.team_colour : null,
          laps: Number.isFinite(r.number_of_laps) ? r.number_of_laps : null,
          time: num(time),
          gap: typeof gap === 'string' ? gap : num(gap),
          part,
          points: num(r.points),
          status: r.dsq ? 'DSQ' : r.dns ? 'DNS' : r.dnf ? 'DNF' : null,
        }
      })
      .sort((a, b) => (a.pos || 999) - (b.pos || 999) || (b.laps || 0) - (a.laps || 0))
  }

  async update() {
    clearTimeout(this._timer)
    let wait = TICK
    try {
      this._last = await this._fetchAll()
      this.emit(this._last)
      this._prefetch()
      // try OpenF1 again sooner while it is closed or failing
      if(this._openf1Status) wait = OPENF1_RETRY
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
