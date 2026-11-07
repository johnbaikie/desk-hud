const Service = require('../../backend/services/Service.js')

// Favourite teams' records, standings, results and schedules for NFL, MLB,
// NHL, MLS and NWSL from ESPN's public site API (site.api.espn.com). It has
// no key and no documentation: it is what espn.com itself uses, so it may
// change without notice. Every request is validated and each team keeps its
// last good data.
//
// Everything is refreshed hourly. Every 30 s the service checks whether one
// of the teams has a game starting or running, and if so reads that league's
// scoreboard for the live score; a finished game triggers a refresh of the
// league (record, standings) a few minutes later.

const USER_AGENT = 'desk-hud (https://github.com/johnbaikie/desk-hud)'
const SITE = 'https://site.api.espn.com/apis/site/v2/sports'
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports'
const REFRESH = 60*60*1000
const LIVE_TICK = 30*1000
const AFTER_GAME = 5*60*1000 // refresh a league this long after its game ends
const REQUEST_TIMEOUT = 20*1000
const UPCOMING = 5

const LEAGUES = [
  { id: 'nfl', name: 'NFL', path: 'football/nfl' },
  { id: 'mlb', name: 'MLB', path: 'baseball/mlb' },
  { id: 'nhl', name: 'NHL', path: 'hockey/nhl' },
  { id: 'mls', name: 'MLS', path: 'soccer/usa.1', soccer: true },
  { id: 'nwsl', name: 'NWSL', path: 'soccer/usa.nwsl', soccer: true },
]

const stat = (entry, name) => {
  const s = (entry && entry.stats || []).find(s => s.name === name)
  return s ? s : null
}
const statValue = (entry, name) => { const s = stat(entry, name); return s && Number.isFinite(s.value) ? s.value : null }
const statText = (entry, name) => { const s = stat(entry, name); return s ? (s.displayValue ?? String(s.value ?? '')) : '' }
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const score = (c) => {
  const s = c && c.score
  const v = s && typeof s === 'object' ? (s.displayValue ?? s.value) : s
  return v === undefined || v === null || v === '' ? null : String(v)
}
// "American League Central" -> "AL Central"
const groupName = (name) => String(name || '')
  .replace('American League', 'AL').replace('National League', 'NL')
  .replace(' Division', '').replace('NWSL Regular Season', 'NWSL').replace(' Conference', ' Conf.')

class SportsService extends Service {
  constructor(config, io, webApp) {
    super(config, io, webApp, 'sports')
    this._favourites = {}
    this._leagues = {} // league id -> {teams: [...], error}
    this._refreshAt = {} // league id -> time of the next refresh
    this._timer = null
    this._busy = false
  }

  async start() {
    try {
      this._favourites = this.config.getProp('sports.teams') || {}
    } catch(err) {
      this._favourites = {}
    }
    const any = LEAGUES.some(l => this._teamList(l).length)
    if(!any) {
      this.emit({ error: 'No teams set in sports.teams' })
      return
    }
    this._tick()
  }

  _teamList(league) {
    const v = this._favourites[league.id]
    return (Array.isArray(v) ? v : (v ? [v] : [])).map(t => String(t).trim()).filter(Boolean)
  }

  async welcomeClient(socket) {
    if(this._payload) this.emit(this._payload, socket)
  }

  async onMessage() {}

  async _get(url) {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    if(!response.ok) throw new Error(`ESPN: HTTP ${response.status}`)
    const json = await response.json()
    if(!json || typeof json !== 'object') throw new Error('ESPN: unexpected response')
    return json
  }

  // one loop: hourly league refreshes, live scores every 30 s
  async _tick() {
    clearTimeout(this._timer)
    if(!this._busy) {
      this._busy = true
      try {
        const now = Date.now()
        let changed = false
        for(const league of LEAGUES) {
          if(!this._teamList(league).length) continue
          if(!this._refreshAt[league.id] || now >= this._refreshAt[league.id]) {
            this._refreshAt[league.id] = now + REFRESH
            await this._refreshLeague(league)
            changed = true
          }
          if(await this._checkLive(league)) changed = true
        }
        if(changed || !this._payload) this._publish()
      } catch(err) {
        this.logger.error(err)
      }
      this._busy = false
    }
    this._timer = setTimeout(() => this._tick(), LIVE_TICK)
  }

  _publish() {
    this._payload = {
      leagues: LEAGUES
        .filter(l => this._teamList(l).length)
        .map(l => ({ id: l.id, name: l.name, soccer: !!l.soccer, ...(this._leagues[l.id] || { teams: [], error: 'Loading' }) })),
      updated: Date.now(),
      error: null,
    }
    this.emit(this._payload)
  }

  async _refreshLeague(league) {
    const old = this._leagues[league.id] || { teams: [] }
    try {
      const list = await this._get(`${SITE}/${league.path}/teams`)
      const all = (((list.sports || [])[0] || {}).leagues || [])[0]
      const teams = (all && all.teams || []).map(t => t.team).filter(Boolean)
      if(!teams.length) throw new Error(`ESPN: no ${league.name} teams`)
      let standings = null
      try {
        standings = await this._get(`${STANDINGS}/${league.path}/standings?level=3`)
      } catch(err) {
        this.logger.error(`${league.name} standings:`, err.message || err)
      }
      const result = []
      for(const wanted of this._teamList(league)) {
        const team = teams.find(t => t.abbreviation.toLowerCase() === wanted.toLowerCase() || String(t.id) === wanted)
        if(!team) {
          result.push({ abbr: wanted.toUpperCase(), error: `No ${league.name} team "${wanted}"` })
          continue
        }
        const previous = old.teams.find(t => t.id === team.id)
        try {
          result.push(await this._team(league, team, standings, previous))
        } catch(err) {
          this.logger.error(`${league.name} ${team.abbreviation}:`, err.message || err)
          result.push(previous || { id: team.id, abbr: team.abbreviation, name: team.displayName, error: String(err.message || err) })
        }
      }
      this._leagues[league.id] = { teams: result, error: null }
    } catch(err) {
      this.logger.error(`${league.name}:`, err.message || err)
      this._leagues[league.id] = { ...old, error: old.teams.length ? null : String(err.message || err) }
      this._refreshAt[league.id] = Date.now() + 5*60*1000
    }
  }

  async _team(league, team, standings, previous) {
    const info = (await this._get(`${SITE}/${league.path}/teams/${team.id}`)).team
    if(!info) throw new Error('ESPN: no team info')
    const items = info.record && Array.isArray(info.record.items) ? info.record.items : []
    const record = (type) => { const i = items.find(i => i.type === type); return i ? i.summary : '' }

    // this season's games; in the off-season (none played yet) last season's
    let events = await this._schedule(league, team.id, '')
    if(!events.some(e => e.completed)) {
      const year = new Date().getFullYear()
      for(const season of [year, year - 1]) {
        const older = await this._schedule(league, team.id, `?season=${season}&seasontype=2`)
        if(older.some(e => e.completed)) { events = older.concat(events); break }
      }
    }
    // the next game: from the schedule, or the team's nextEvent (play-offs,
    // next season's opener)
    const nextEvents = (Array.isArray(info.nextEvent) ? info.nextEvent : []).map(e => this._event(e, team.id)).filter(Boolean)
    const byId = new Map()
    events.concat(nextEvents).forEach(e => byId.set(e.id, { ...byId.get(e.id), ...e }))
    events = [...byId.values()].sort((a, b) => a.date - b.date)

    // postponed or cancelled games stay in the schedule unplayed: only games
    // still to come (or running) count as coming
    const now = Date.now()
    const played = events.filter(e => e.completed)
    const coming = events.filter(e => !e.completed && e.state !== 'post' && e.date > now - 6*60*60*1000)
    const standing = this._standing(league, team.id, standings)
    const live = previous && previous.live && coming.some(e => e.id === previous.live.id) ? previous.live : null
    return {
      id: team.id,
      abbr: info.abbreviation,
      name: info.displayName,
      short: info.shortDisplayName || info.name,
      color: /^[0-9a-f]{6}$/i.test(info.color || '') ? info.color : null,
      record: record('total'),
      home: record('home'),
      road: record('road'),
      standing,
      last: played.length ? played[played.length - 1] : null,
      next: coming[0] || null,
      upcoming: coming.slice(1, 1 + UPCOMING),
      live,
      error: null,
    }
  }

  async _schedule(league, id, query) {
    const json = await this._get(`${SITE}/${league.path}/teams/${id}/schedule${query}`)
    return (Array.isArray(json.events) ? json.events : []).map(e => this._event(e, id)).filter(Boolean)
  }

  // an ESPN event from this team's side
  _event(e, teamId) {
    const c = e && Array.isArray(e.competitions) ? e.competitions[0] : null
    if(!c || !Array.isArray(c.competitors)) return null
    const us = c.competitors.find(x => String(x.id) === String(teamId) || (x.team && String(x.team.id) === String(teamId)))
    const them = c.competitors.find(x => x !== us)
    if(!us || !them) return null
    const status = c.status && c.status.type || {}
    const date = Date.parse(e.date || c.date)
    if(!Number.isFinite(date)) return null
    const ourScore = score(us)
    const theirScore = score(them)
    const completed = !!status.completed
    return {
      id: String(e.id),
      date,
      timeValid: e.timeValid !== false && c.timeValid !== false && !/TBD/i.test(status.shortDetail || ''),
      home: us.homeAway === 'home',
      opp: them.team ? them.team.abbreviation : '?',
      oppName: them.team ? (them.team.shortDisplayName || them.team.displayName) : '',
      us: ourScore,
      them: theirScore,
      result: completed ? (us.winner ? 'W' : them.winner ? 'L' : (ourScore !== null && ourScore === theirScore ? 'D' : '')) : null,
      completed,
      state: status.state || null, // pre, in, post
      detail: status.shortDetail || '',
      tv: (Array.isArray(c.broadcasts) ? c.broadcasts : [])
        .map(b => b.media ? b.media.shortName : (Array.isArray(b.names) ? b.names[0] : null))
        .filter(Boolean).slice(0, 2).join(', '),
      season: e.seasonType && e.seasonType.name ? e.seasonType.name : '',
    }
  }

  // the team's group (division, conference or table), ranked, and its place
  _standing(league, teamId, standings) {
    const groups = []
    const walk = (node) => {
      if(!node) return
      if(node.standings && Array.isArray(node.standings.entries)) groups.push(node)
      ;(node.children || []).forEach(walk)
    }
    walk(standings)
    const group = groups.find(g => g.standings.entries.some(e => e.team && String(e.team.id) === String(teamId)))
    if(!group) return null
    const entries = group.standings.entries.slice().sort((a, b) => {
      const ra = statValue(a, 'rank'), rb = statValue(b, 'rank')
      if(ra !== null && rb !== null) return ra - rb
      if(league.id === 'nhl') {
        return (statValue(b, 'points') || 0) - (statValue(a, 'points') || 0)
          || (statValue(a, 'gamesPlayed') || 0) - (statValue(b, 'gamesPlayed') || 0)
      }
      return (statValue(b, 'winPercent') || 0) - (statValue(a, 'winPercent') || 0)
    })
    const rows = entries.map((e, i) => ({
      rank: i + 1,
      abbr: e.team.abbreviation,
      me: String(e.team.id) === String(teamId),
      record: statText(e, 'overall').replace(/, \d+ PTS$/i, ''),
      // games behind (NFL, MLB) or points (NHL, soccer)
      extra: league.soccer || league.id === 'nhl' ? `${statText(e, 'points')} pts` : (statText(e, 'gamesBehind') || '-'),
    }))
    const me = entries.findIndex(e => String(e.team.id) === String(teamId))
    const mine = entries[me]
    return {
      group: groupName(group.name),
      rank: me + 1,
      summary: `${ordinal(me + 1)} in ${groupName(group.name)}`,
      streak: statText(mine, 'streak'),
      diff: statText(mine, 'pointDifferential') || statText(mine, 'differential'),
      points: league.soccer || league.id === 'nhl' ? statText(mine, 'points') : '',
      seed: statText(mine, 'playoffSeed'),
      rows,
    }
  }

  // live scores: when one of the league's teams has a game starting (or
  // running), read the scoreboard of that game's day
  async _checkLive(league) {
    const data = this._leagues[league.id]
    if(!data || !data.teams.length) return false
    const now = Date.now()
    const due = data.teams.filter(t => t.next && t.next.timeValid && t.next.date <= now + 2*60*1000
      && now - t.next.date < 8*60*60*1000)
    const wasLive = data.teams.filter(t => t.live)
    if(!due.length && !wasLive.length) return false

    const days = new Set(due.concat(wasLive).map(t => this._espnDay((t.live || t.next).date)))
    let changed = false
    for(const day of days) {
      let board
      try {
        board = await this._get(`${SITE}/${league.path}/scoreboard?dates=${day}`)
      } catch(err) {
        this.logger.error(`${league.name} scoreboard:`, err.message || err)
        continue
      }
      const events = Array.isArray(board.events) ? board.events : []
      for(const team of data.teams) {
        const game = team.live || team.next
        if(!game) continue
        const e = events.find(e => String(e.id) === game.id)
        if(!e) continue
        const ev = this._event(e, team.id)
        if(!ev) continue
        const c = e.competitions[0]
        if(ev.state === 'in') {
          team.live = { ...ev, situation: this._situation(league, c, team.id) }
          changed = true
        } else if(ev.state === 'post' || ev.completed) {
          // over: show it as the last game until the league refresh
          team.live = null
          team.last = ev
          team.next = team.upcoming[0] || null
          team.upcoming = team.upcoming.slice(1)
          this._refreshAt[league.id] = Math.min(this._refreshAt[league.id] || Infinity, now + AFTER_GAME)
          changed = true
        }
      }
    }
    return changed
  }

  // ESPN's scoreboard days are US Eastern dates
  _espnDay(time) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(time))
    const get = (type) => parts.find(p => p.type === type).value
    return `${get('year')}${get('month')}${get('day')}`
  }

  // down and distance, outs and runners, or nothing
  _situation(league, c, teamId) {
    const s = c.situation
    if(!s) return ''
    if(league.id === 'nfl') {
      const ball = s.possession && String(s.possession) === String(teamId) ? 'our ball' : (s.possession ? 'their ball' : '')
      return [s.downDistanceText || s.shortDownDistanceText, ball].filter(Boolean).join(', ')
    }
    if(league.id === 'mlb') {
      const bases = [s.onFirst && '1st', s.onSecond && '2nd', s.onThird && '3rd'].filter(Boolean)
      const outs = Number.isFinite(s.outs) ? `${s.outs} out` : ''
      return [outs, bases.length ? `on ${bases.join(', ')}` : ''].filter(Boolean).join(', ')
    }
    return ''
  }
}

module.exports = SportsService
