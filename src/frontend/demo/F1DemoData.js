// A snapshot of the 2026 standings after round 19 (from Jolpica-F1) and the
// 2026 calendar. The calendar is moved so that the Brazilian GP (round 20)
// starts two days from now and the countdown runs; session results are made
// up on request.
const DRIVERS = [
  { pos: 1, code: "ANT", name: "Antonelli", team: "Mercedes", points: 380, wins: 9 },
  { pos: 2, code: "VER", name: "Verstappen", team: "Red Bull", points: 261, wins: 3 },
  { pos: 3, code: "HAM", name: "Hamilton", team: "Ferrari", points: 259, wins: 1 },
  { pos: 4, code: "RUS", name: "Russell", team: "Mercedes", points: 250, wins: 3 },
  { pos: 5, code: "LEC", name: "Leclerc", team: "Ferrari", points: 245, wins: 1 },
  { pos: 6, code: "NOR", name: "Norris", team: "McLaren", points: 221, wins: 2 },
  { pos: 7, code: "PIA", name: "Piastri", team: "McLaren", points: 144, wins: 0 },
  { pos: 8, code: "HAD", name: "Hadjar", team: "Red Bull", points: 107, wins: 0 },
  { pos: 9, code: "LAW", name: "Lawson", team: "Red Bull", points: 83, wins: 0 },
  { pos: 10, code: "GAS", name: "Gasly", team: "Alpine", points: 42, wins: 0 },
  { pos: 11, code: "LIN", name: "Lindblad", team: "Racing Bulls", points: 38, wins: 0 },
  { pos: 12, code: "COL", name: "Colapinto", team: "Alpine", points: 27, wins: 0 },
  { pos: 13, code: "BEA", name: "Bearman", team: "Haas", points: 23, wins: 0 },
  { pos: 14, code: "BOR", name: "Bortoleto", team: "Audi", points: 14, wins: 0 },
  { pos: 15, code: "HUL", name: "Hülkenberg", team: "Audi", points: 13, wins: 0 },
  { pos: 16, code: "OCO", name: "Ocon", team: "Haas", points: 7, wins: 0 },
  { pos: 17, code: "ALO", name: "Alonso", team: "Aston Martin", points: 7, wins: 0 },
  { pos: 18, code: "SAI", name: "Sainz", team: "Williams", points: 7, wins: 0 },
  { pos: 19, code: "ALB", name: "Albon", team: "Williams", points: 5, wins: 0 },
  { pos: 20, code: "TSU", name: "Tsunoda", team: "Racing Bulls", points: 1, wins: 0 },
  { pos: 21, code: "HIR", name: "Hirakawa", team: "Haas", points: 1, wins: 0 },
  { pos: 22, code: "STR", name: "Stroll", team: "Aston Martin", points: 0, wins: 0 },
  { pos: 23, code: "BOT", name: "Bottas", team: "Cadillac", points: 0, wins: 0 },
  { pos: 24, code: "PER", name: "Pérez", team: "Cadillac", points: 0, wins: 0 },
]
const CONSTRUCTORS = [
  { pos: 1, name: "Mercedes", points: 630, wins: 12 },
  { pos: 2, name: "Ferrari", points: 504, wins: 2 },
  { pos: 3, name: "Red Bull", points: 382, wins: 3 },
  { pos: 4, name: "McLaren", points: 365, wins: 2 },
  { pos: 5, name: "Racing Bulls", points: 108, wins: 0 },
  { pos: 6, name: "Alpine", points: 69, wins: 0 },
  { pos: 7, name: "Haas", points: 31, wins: 0 },
  { pos: 8, name: "Audi", points: 27, wins: 0 },
  { pos: 9, name: "Williams", points: 12, wins: 0 },
  { pos: 10, name: "Aston Martin", points: 7, wins: 0 },
  { pos: 11, name: "Cadillac", points: 0, wins: 0 },
]
// round, name, circuit, locality, country, sessions as code:minutes from
// the start of round 20's race
const CALENDAR = [
  [1, "Australian Grand Prix", "Albert Park Grand Prix Circuit", "Melbourne", "Australia", "P1:-356610 P2:-356400 P3:-355170 Q:-354960 GP:-353580"],
  [2, "Chinese Grand Prix", "Shanghai International Circuit", "Shanghai", "China", "P1:-346410 SQ:-346170 SP:-345000 Q:-344760 GP:-343320"],
  [3, "Japanese Grand Prix", "Suzuka Circuit", "Suzuka", "Japan", "P1:-326310 P2:-326100 P3:-324870 Q:-324660 GP:-323280"],
  [4, "Miami Grand Prix", "Miami International Autodrome", "Miami", "USA", "P1:-275100 SQ:-274830 SP:-273660 Q:-273420 GP:-271980"],
  [5, "Canadian Grand Prix", "Circuit Gilles Villeneuve", "Montreal", "Canada", "P1:-244830 SQ:-244590 SP:-243420 Q:-243180 GP:-241740"],
  [6, "Monaco Grand Prix", "Circuit de Monaco", "Monte Carlo", "Monaco", "P1:-224970 P2:-224760 P3:-223590 Q:-223380 GP:-222000"],
  [7, "Barcelona Grand Prix", "Circuit de Barcelona-Catalunya", "Barcelona", "Spain", "P1:-214890 P2:-214680 P3:-213510 Q:-213300 GP:-211920"],
  [8, "Austrian Grand Prix", "Red Bull Ring", "Spielberg", "Austria", "P1:-194730 P2:-194520 P3:-193350 Q:-193140 GP:-191760"],
  [9, "British Grand Prix", "Silverstone Circuit", "Silverstone", "UK", "P1:-184650 SQ:-184410 SP:-183240 Q:-183000 GP:-181620"],
  [10, "Belgian Grand Prix", "Circuit de Spa-Francorchamps", "Spa", "Belgium", "P1:-164490 P2:-164280 P3:-163110 Q:-162900 GP:-161520"],
  [11, "Hungarian Grand Prix", "Hungaroring", "Budapest", "Hungary", "P1:-154410 P2:-154200 P3:-153030 Q:-152820 GP:-151440"],
  [12, "Dutch Grand Prix", "Circuit Park Zandvoort", "Zandvoort", "Netherlands", "P1:-114150 SQ:-113910 SP:-112740 Q:-112500 GP:-111120"],
  [13, "Italian Grand Prix", "Autodromo Nazionale di Monza", "Monza", "Italy", "P1:-93990 P2:-93780 P3:-92550 Q:-92340 GP:-90960"],
  [14, "Spanish Grand Prix", "Madring", "Madrid", "Spain", "P1:-83850 P2:-83640 P3:-82470 Q:-82260 GP:-80880"],
  [15, "Azerbaijan Grand Prix", "Baku City Circuit", "Baku", "Azerbaijan", "P1:-65310 P2:-65100 P3:-63870 Q:-63660 GP:-62280"],
  [16, "Bahrain Grand Prix in Malaysia", "Sepang International Circuit", "Kuala Lumpur", "Malaysia", "P1:-54030 P2:-53820 P3:-52590 Q:-52380 GP:-51000"],
  [17, "Singapore Grand Prix", "Marina Bay Street Circuit", "Marina Bay", "Singapore", "P1:-43710 SQ:-43470 SP:-42240 Q:-42000 GP:-40620"],
  [18, "United States Grand Prix", "Circuit of the Americas", "Austin", "USA", "P1:-23010 P2:-22800 P3:-21570 Q:-21360 GP:-19980"],
  [19, "Mexico City Grand Prix", "Autódromo Hermanos Rodríguez", "Mexico City", "Mexico", "P1:-12870 P2:-12660 P3:-11490 Q:-11280 GP:-9900"],
  [20, "Brazilian Grand Prix", "Autódromo José Carlos Pace", "São Paulo", "Brazil", "P1:-2970 P2:-2760 P3:-1590 Q:-1380 GP:0"],
  [21, "Las Vegas Grand Prix", "Las Vegas Strip Street Circuit", "Las Vegas", "USA", "P1:16290 P2:16500 P3:17730 Q:17940 GP:19380"],
  [22, "Qatar Grand Prix", "Lusail International Circuit", "Lusail", "Qatar", "P1:27150 P2:27360 P3:28650 Q:28860 GP:30180"],
  [23, "Abu Dhabi Grand Prix", "Yas Marina Circuit", "Abu Dhabi", "UAE", "P1:36990 P2:37200 P3:38490 Q:38700 GP:40080"],
]
const NAMES = {
  P1: 'Practice 1', P2: 'Practice 2', P3: 'Practice 3', SQ: 'Sprint Quali',
  SP: 'Sprint', Q: 'Qualifying', GP: 'Race',
}
const TEAM_COLOURS = {
  'Mercedes': '00D7B6', 'Ferrari': 'ED1131', 'Red Bull': '4781D7', 'McLaren': 'F47600',
  'Racing Bulls': '6C98FF', 'Alpine': '00A1E8', 'Haas': '9C9FA2', 'Audi': 'F50537',
  'Williams': '1868DB', 'Aston Martin': '229971', 'Cadillac': '909090',
}
const HOUR = 60*60*1000
const MINUTE = 60*1000

// small seeded random numbers, so a session's made-up results stay the same
function random(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default class F1DemoData {
  constructor() {
    // round 20's race starts two days and a bit from now
    const start = Date.now() + 52*HOUR + 18*MINUTE
    this._sessions = new Map()
    const weekends = CALENDAR.map(([round, name, circuit, locality, country, times]) => {
      const sessions = times.split(' ').map((item, i) => {
        const [code, minutes] = item.split(':')
        const t = start + Number(minutes)*MINUTE
        const session = { code, name: NAMES[code], t, end: t + (code === 'GP' ? 2*HOUR : HOUR), key: round*10 + i, id: `${round}:${code}` }
        this._sessions.set(session.id, session)
        return session
      })
      const race = sessions[sessions.length - 1]
      return { round, name, circuit, locality, country, start: race.t, sprint: sessions.some(s => s.code === 'SP'), sessions }
    })
    const next = weekends.find(w => w.round === 20)
    this._payload = {
      season: "2026",
      round: 19,
      drivers: DRIVERS,
      constructors: CONSTRUCTORS,
      calendarSeason: "2026",
      totalRounds: weekends.length,
      nextRace: { ...next, sessions: next.sessions.map(s => ({ name: s.name, t: s.t })) },
      weekends,
      updated: Date.now(),
      error: null,
    }
  }

  get data() {
    return { widgetId: "f1", payload: this._payload }
  }

  // the made-up classification of a session, as F1Service sends it
  results(id) {
    const session = this._sessions.get(id)
    if(!session || session.end > Date.now()) return { widgetId: "f1", payload: { results: { id, rows: [] } } }
    const rand = random(session.key)
    // the championship order, shuffled a little
    const order = DRIVERS.slice(0, 22)
      .map((d, i) => ({ d, score: i + 9*rand() }))
      .sort((a, b) => a.score - b.score)
      .map(x => x.d)
    const race = session.code === 'GP' || session.code === 'SP'
    const quali = session.code === 'Q' || session.code === 'SQ'
    const points = session.code === 'GP' ? [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] : [8, 7, 6, 5, 4, 3, 2, 1]
    const raceLaps = session.code === 'GP' ? 57 : 19
    const dnfs = race ? [20, 21] : []
    let gap = 0
    const rows = order.map((d, i) => {
      const row = {
        pos: i + 1, number: 0, code: d.code, name: d.name, team: d.team,
        colour: TEAM_COLOURS[d.team] || null, laps: 20 + Math.floor(15*rand()),
        time: null, gap: null, part: null, points: null, status: null,
      }
      if(race) {
        gap += i ? 0.4 + (i < 10 ? 6 : 3)*rand() : 0
        row.laps = raceLaps
        row.time = (session.code === 'GP' ? 5450 : 1820) + gap
        row.gap = i ? Number(gap.toFixed(3)) : 0
        row.points = points[i] || 0
        if(dnfs.includes(i)) {
          Object.assign(row, { pos: null, laps: Math.floor(raceLaps*rand()), time: null, gap: null, status: 'DNF' })
        }
      } else {
        gap += i ? 0.02 + 0.2*rand() : 0
        // qualifying: the gap is within the last part the driver reached
        const part = quali ? (i < 10 ? 3 : i < 16 ? 2 : 1) : null
        row.time = 77.3 + gap + (quali ? 0.25*(3 - part) : 0.6)
        row.part = part ? 'Q' + part : null
      }
      row.time = row.time === null ? null : Number(row.time.toFixed(3))
      return row
    })
    if(!race) {
      // the gap is to the fastest in the same part (all of practice, or Q1/Q2/Q3)
      rows.forEach(row => {
        const best = Math.min(...rows.filter(r => r.part === row.part).map(r => r.time))
        row.gap = Number((row.time - best).toFixed(3))
      })
    }
    return { widgetId: "f1", payload: { results: { id, rows } } }
  }
}
