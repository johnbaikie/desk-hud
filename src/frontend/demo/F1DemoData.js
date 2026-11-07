// A snapshot of the 2026 standings after round 19 (from Jolpica-F1); the next
// race is placed relative to the current time so the countdown runs.
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
const HOUR = 60*60*1000

export default class F1DemoData {
  constructor() {
    // race on Sunday afternoon, two days and a bit from now
    const start = Date.now() + 52*HOUR + 18*60*1000
    this._payload = {
      season: "2026",
      round: 19,
      drivers: DRIVERS,
      constructors: CONSTRUCTORS,
      calendarSeason: "2026",
      totalRounds: 23,
      nextRace: {
        round: 20,
        name: "Brazilian Grand Prix",
        circuit: "Autódromo José Carlos Pace",
        locality: "São Paulo",
        country: "Brazil",
        start,
        sprint: false,
        sessions: [
          { name: "Practice 1", t: start - 49.5*HOUR },
          { name: "Practice 2", t: start - 46*HOUR },
          { name: "Practice 3", t: start - 26.5*HOUR },
          { name: "Qualifying", t: start - 23*HOUR },
          { name: "Race", t: start },
        ],
      },
      updated: Date.now(),
      error: null,
    }
  }

  get data() {
    return { widgetId: "f1", payload: this._payload }
  }
}
