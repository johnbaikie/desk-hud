// A snapshot of real ESPN data for the demo teams (Chiefs, Royals, Stars,
// Sporting KC, KC Current); game times are hours from now, and the KC Current
// game is live so the demo shows a live score.
const HOUR = 60*60*1000

export default class SportsDemoData {
  constructor() {
    const now = Date.now()
    // hours from now, on a quarter hour like real kick-off times
    const at = (hours) => Math.round((now + hours*HOUR) / (15*60*1000)) * 15*60*1000
    this._payload = {
      leagues: [
        {
          id: "nfl",
          name: "NFL",
          soccer: false,
          teams: [
            {
              id: "12",
              abbr: "KC",
              name: "Kansas City Chiefs",
              short: "Chiefs",
              color: "e31837",
              record: "5-2",
              home: "3-0",
              road: "2-2",
              standing: {
                group: "AFC West",
                rank: 2,
                summary: "2nd in AFC West",
                streak: "L2",
                diff: "+36",
                points: "",
                seed: "5",
                rows: [
                  {
                    rank: 1,
                    abbr: "DEN",
                    me: false,
                    record: "6-2",
                    extra: "-"
                  },
                  {
                    rank: 2,
                    abbr: "KC",
                    me: true,
                    record: "5-2",
                    extra: "0.5"
                  },
                  {
                    rank: 3,
                    abbr: "LV",
                    me: false,
                    record: "4-4",
                    extra: "2"
                  },
                  {
                    rank: 4,
                    abbr: "LAC",
                    me: false,
                    record: "0-7",
                    extra: "5.5"
                  }
                ]
              },
              last: {
                id: "401873033",
                date: at(-136.83),
                timeValid: true,
                home: false,
                opp: "DEN",
                oppName: "Broncos",
                us: "24",
                them: "28",
                result: "L",
                completed: true,
                state: "post",
                detail: "Final",
                tv: "CBS",
                season: "Regular Season"
              },
              next: {
                id: "401873045",
                date: at(27.76),
                timeValid: true,
                home: true,
                opp: "NYJ",
                oppName: "Jets",
                us: null,
                them: null,
                result: null,
                completed: false,
                state: "pre",
                detail: "11/8 - 1:00 PM EST",
                tv: "CBS",
                season: "Regular Season"
              },
              upcoming: [
                {
                  id: "401873058",
                  date: at(195.76),
                  timeValid: true,
                  home: false,
                  opp: "ATL",
                  oppName: "Falcons",
                  us: null,
                  them: null,
                  result: null,
                  completed: false,
                  state: "pre",
                  detail: "11/15 - 1:00 PM EST",
                  tv: "CBS",
                  season: "Regular Season"
                },
                {
                  id: "401873067",
                  date: at(363.76),
                  timeValid: true,
                  home: true,
                  opp: "ARI",
                  oppName: "Cardinals",
                  us: null,
                  them: null,
                  result: null,
                  completed: false,
                  state: "pre",
                  detail: "11/22 - 1:00 PM EST",
                  tv: "CBS",
                  season: "Regular Season"
                },
                {
                  id: "401873082",
                  date: at(467.09),
                  timeValid: true,
                  home: false,
                  opp: "BUF",
                  oppName: "Bills",
                  us: null,
                  them: null,
                  result: null,
                  completed: false,
                  state: "pre",
                  detail: "11/26 - 8:20 PM EST",
                  tv: "NBC",
                  season: "Regular Season"
                },
                {
                  id: "401873096",
                  date: at(635.01),
                  timeValid: true,
                  home: false,
                  opp: "LAR",
                  oppName: "Rams",
                  us: null,
                  them: null,
                  result: null,
                  completed: false,
                  state: "pre",
                  detail: "12/3 - 8:15 PM EST",
                  tv: "Prime Video",
                  season: "Regular Season"
                },
                {
                  id: "401873119",
                  date: at(871.17),
                  timeValid: true,
                  home: false,
                  opp: "CIN",
                  oppName: "Bengals",
                  us: null,
                  them: null,
                  result: null,
                  completed: false,
                  state: "pre",
                  detail: "12/13 - 4:25 PM EST",
                  tv: "Fox",
                  season: "Regular Season"
                }
              ],
              live: null,
              error: null
            }
          ],
          error: null
        },
        {
          id: "mlb",
          name: "MLB",
          soccer: false,
          teams: [
            {
              id: "7",
              abbr: "KC",
              name: "Kansas City Royals",
              short: "Royals",
              color: "004687",
              record: "69-93",
              home: "41-40",
              road: "28-53",
              standing: {
                group: "AL Central",
                rank: 5,
                summary: "5th in AL Central",
                streak: "W1",
                diff: "-120",
                points: "",
                seed: "13",
                rows: [
                  {
                    rank: 1,
                    abbr: "CLE",
                    me: false,
                    record: "85-77",
                    extra: "-"
                  },
                  {
                    rank: 2,
                    abbr: "CHW",
                    me: false,
                    record: "84-78",
                    extra: "1"
                  },
                  {
                    rank: 3,
                    abbr: "MIN",
                    me: false,
                    record: "77-85",
                    extra: "8"
                  },
                  {
                    rank: 4,
                    abbr: "DET",
                    me: false,
                    record: "76-86",
                    extra: "9"
                  },
                  {
                    rank: 5,
                    abbr: "KC",
                    me: true,
                    record: "69-93",
                    extra: "16"
                  }
                ]
              },
              last: {
                id: "401817109",
                date: at(-979.08),
                timeValid: true,
                home: true,
                opp: "CLE",
                oppName: "Guardians",
                us: "3",
                them: "2",
                result: "W",
                completed: true,
                state: "post",
                detail: "Final",
                tv: "ESPN Unlmtd, MLB.TV",
                season: "Regular Season"
              },
              next: {
                id: "401917882",
                date: at(2486.76),
                timeValid: false,
                home: true,
                opp: "TEX",
                oppName: "Rangers",
                us: null,
                them: null,
                result: null,
                completed: false,
                state: "pre",
                detail: "TBD",
                tv: "",
                season: "Spring Training"
              },
              upcoming: [],
              live: null,
              error: null
            }
          ],
          error: null
        },
        {
          id: "nhl",
          name: "NHL",
          soccer: false,
          teams: [
            {
              id: "9",
              abbr: "DAL",
              name: "Dallas Stars",
              short: "Stars",
              color: "20864c",
              record: "9-5",
              home: "",
              road: "",
              standing: {
                group: "Central",
                rank: 3,
                summary: "3rd in Central",
                streak: "L1",
                diff: "+7",
                points: "20",
                seed: "5",
                rows: [
                  {
                    rank: 1,
                    abbr: "MIN",
                    me: false,
                    record: "12-3-3",
                    extra: "27 pts"
                  },
                  {
                    rank: 2,
                    abbr: "UTA",
                    me: false,
                    record: "10-6-1",
                    extra: "21 pts"
                  },
                  {
                    rank: 3,
                    abbr: "DAL",
                    me: true,
                    record: "9-5-2",
                    extra: "20 pts"
                  },
                  {
                    rank: 4,
                    abbr: "COL",
                    me: false,
                    record: "9-6-2",
                    extra: "20 pts"
                  },
                  {
                    rank: 5,
                    abbr: "NSH",
                    me: false,
                    record: "7-4-5",
                    extra: "19 pts"
                  },
                  {
                    rank: 6,
                    abbr: "STL",
                    me: false,
                    record: "7-7-2",
                    extra: "16 pts"
                  },
                  {
                    rank: 7,
                    abbr: "WPG",
                    me: false,
                    record: "6-8-3",
                    extra: "15 pts"
                  },
                  {
                    rank: 8,
                    abbr: "CHI",
                    me: false,
                    record: "4-12-1",
                    extra: "9 pts"
                  }
                ]
              },
              last: {
                id: "401892655",
                date: at(-38.24),
                timeValid: true,
                home: false,
                opp: "CBJ",
                oppName: "Blue Jackets",
                us: "1",
                them: "2",
                result: "L",
                completed: true,
                state: "post",
                detail: "Final/SO",
                tv: "ESPN+, CBJNHL",
                season: "Regular Season"
              },
              next: {
                id: "401892669",
                date: at(10.76),
                timeValid: true,
                home: true,
                opp: "SJ",
                oppName: "Sharks",
                us: null,
                them: null,
                result: null,
                completed: false,
                state: "pre",
                detail: "11/7 - 8:00 PM EST",
                tv: "ESPN+, NBC Sports BA",
                season: "Regular Season"
              },
              upcoming: [
                {
                  id: "401892703",
                  date: at(130.76),
                  timeValid: true,
                  home: true,
                  opp: "WPG",
                  oppName: "Jets",
                  us: null,
                  them: null,
                  result: null,
                  completed: false,
                  state: "pre",
                  detail: "11/12 - 8:00 PM EST",
                  tv: "ESPN+, KDFI",
                  season: "Regular Season"
                },
                {
                  id: "401892717",
                  date: at(178.76),
                  timeValid: true,
                  home: true,
                  opp: "BUF",
                  oppName: "Sabres",
                  us: null,
                  them: null,
                  result: null,
                  completed: false,
                  state: "pre",
                  detail: "11/14 - 8:00 PM EST",
                  tv: "ESPN+, MSGB",
                  season: "Regular Season"
                },
                {
                  id: "401892722",
                  date: at(202.76),
                  timeValid: true,
                  home: true,
                  opp: "FLA",
                  oppName: "Panthers",
                  us: null,
                  them: null,
                  result: null,
                  completed: false,
                  state: "pre",
                  detail: "11/15 - 8:00 PM EST",
                  tv: "NHL Net, Scripps Sports",
                  season: "Regular Season"
                },
                {
                  id: "401892737",
                  date: at(252.76),
                  timeValid: true,
                  home: false,
                  opp: "VGK",
                  oppName: "Golden Knights",
                  us: null,
                  them: null,
                  result: null,
                  completed: false,
                  state: "pre",
                  detail: "11/17 - 10:00 PM EST",
                  tv: "TNT, truTV",
                  season: "Regular Season"
                },
                {
                  id: "401892753",
                  date: at(300.76),
                  timeValid: true,
                  home: false,
                  opp: "VGK",
                  oppName: "Golden Knights",
                  us: null,
                  them: null,
                  result: null,
                  completed: false,
                  state: "pre",
                  detail: "11/19 - 10:00 PM EST",
                  tv: "Disney+, ESPN+",
                  season: "Regular Season"
                }
              ],
              live: null,
              error: null
            }
          ],
          error: null
        },
        {
          id: "mls",
          name: "MLS",
          soccer: true,
          teams: [
            {
              id: "186",
              abbr: "SKC",
              name: "Sporting Kansas City",
              short: "Kansas City",
              color: "a7c6ed",
              record: "6-5-22",
              home: "",
              road: "",
              standing: {
                group: "Western Conf.",
                rank: 15,
                summary: "15th in Western Conf.",
                streak: "",
                diff: "-42",
                points: "23",
                seed: "",
                rows: [
                  {
                    rank: 1,
                    abbr: "VAN",
                    me: false,
                    record: "18-7-8",
                    extra: "61 pts"
                  },
                  {
                    rank: 2,
                    abbr: "DAL",
                    me: false,
                    record: "15-10-8",
                    extra: "55 pts"
                  },
                  {
                    rank: 3,
                    abbr: "SJ",
                    me: false,
                    record: "14-10-9",
                    extra: "52 pts"
                  },
                  {
                    rank: 4,
                    abbr: "STL",
                    me: false,
                    record: "14-9-10",
                    extra: "51 pts"
                  },
                  {
                    rank: 5,
                    abbr: "HOU",
                    me: false,
                    record: "14-9-10",
                    extra: "51 pts"
                  },
                  {
                    rank: 6,
                    abbr: "LAFC",
                    me: false,
                    record: "12-11-10",
                    extra: "47 pts"
                  },
                  {
                    rank: 7,
                    abbr: "LA",
                    me: false,
                    record: "11-11-11",
                    extra: "44 pts"
                  },
                  {
                    rank: 8,
                    abbr: "POR",
                    me: false,
                    record: "12-7-14",
                    extra: "43 pts"
                  },
                  {
                    rank: 9,
                    abbr: "COL",
                    me: false,
                    record: "12-7-14",
                    extra: "43 pts"
                  },
                  {
                    rank: 10,
                    abbr: "SEA",
                    me: false,
                    record: "11-10-12",
                    extra: "43 pts"
                  },
                  {
                    rank: 11,
                    abbr: "RSL",
                    me: false,
                    record: "12-6-15",
                    extra: "42 pts"
                  },
                  {
                    rank: 12,
                    abbr: "MIN",
                    me: false,
                    record: "10-11-12",
                    extra: "41 pts"
                  },
                  {
                    rank: 13,
                    abbr: "SD",
                    me: false,
                    record: "9-11-13",
                    extra: "38 pts"
                  },
                  {
                    rank: 14,
                    abbr: "ATX",
                    me: false,
                    record: "8-10-15",
                    extra: "34 pts"
                  },
                  {
                    rank: 15,
                    abbr: "SKC",
                    me: true,
                    record: "6-5-22",
                    extra: "23 pts"
                  }
                ]
              },
              last: {
                id: "761928",
                date: at(-163.24),
                timeValid: true,
                home: true,
                opp: "DAL",
                oppName: "Dallas",
                us: "1",
                them: "1",
                result: "D",
                completed: true,
                state: "post",
                detail: "FT",
                tv: "Apple TV",
                season: "Regular Season"
              },
              next: {
                id: "761947",
                date: at(9.76),
                timeValid: true,
                home: false,
                opp: "SD",
                oppName: "San Diego",
                us: null,
                them: null,
                result: null,
                completed: false,
                state: "pre",
                detail: "11/7 - 7:00 PM EST",
                tv: "Apple TV",
                season: "Regular Season"
              },
              upcoming: [],
              live: null,
              error: null
            }
          ],
          error: null
        },
        {
          id: "nwsl",
          name: "NWSL",
          soccer: true,
          teams: [
            {
              id: "20907",
              abbr: "KC",
              name: "Kansas City Current",
              short: "Kansas City",
              color: "cf3339",
              record: "16-5-9",
              home: "",
              road: "",
              standing: {
                group: "NWSL",
                rank: 4,
                summary: "4th in NWSL",
                streak: "",
                diff: "+15",
                points: "53",
                seed: "",
                rows: [
                  {
                    rank: 1,
                    abbr: "GFC",
                    me: false,
                    record: "18-7-5",
                    extra: "61 pts"
                  },
                  {
                    rank: 2,
                    abbr: "SD",
                    me: false,
                    record: "18-4-8",
                    extra: "58 pts"
                  },
                  {
                    rank: 3,
                    abbr: "WAS",
                    me: false,
                    record: "17-4-9",
                    extra: "55 pts"
                  },
                  {
                    rank: 4,
                    abbr: "KC",
                    me: true,
                    record: "16-5-9",
                    extra: "53 pts"
                  },
                  {
                    rank: 5,
                    abbr: "LA",
                    me: false,
                    record: "15-7-8",
                    extra: "52 pts"
                  },
                  {
                    rank: 6,
                    abbr: "POR",
                    me: false,
                    record: "14-8-8",
                    extra: "50 pts"
                  },
                  {
                    rank: 7,
                    abbr: "UTA",
                    me: false,
                    record: "14-5-11",
                    extra: "47 pts"
                  },
                  {
                    rank: 8,
                    abbr: "SEA",
                    me: false,
                    record: "14-5-11",
                    extra: "47 pts"
                  },
                  {
                    rank: 9,
                    abbr: "NC",
                    me: false,
                    record: "14-3-13",
                    extra: "45 pts"
                  },
                  {
                    rank: 10,
                    abbr: "DEN",
                    me: false,
                    record: "11-8-11",
                    extra: "41 pts"
                  },
                  {
                    rank: 11,
                    abbr: "ORL",
                    me: false,
                    record: "11-3-16",
                    extra: "36 pts"
                  },
                  {
                    rank: 12,
                    abbr: "HOU",
                    me: false,
                    record: "9-6-15",
                    extra: "33 pts"
                  },
                  {
                    rank: 13,
                    abbr: "BOS",
                    me: false,
                    record: "9-6-15",
                    extra: "33 pts"
                  },
                  {
                    rank: 14,
                    abbr: "BAY",
                    me: false,
                    record: "7-6-17",
                    extra: "27 pts"
                  },
                  {
                    rank: 15,
                    abbr: "LOU",
                    me: false,
                    record: "7-3-20",
                    extra: "24 pts"
                  },
                  {
                    rank: 16,
                    abbr: "CHI",
                    me: false,
                    record: "5-2-23",
                    extra: "17 pts"
                  }
                ]
              },
              last: {
                id: "401854036",
                date: at(-136.24),
                timeValid: true,
                home: false,
                opp: "LOU",
                oppName: "Louisville",
                us: "2",
                them: "0",
                result: "W",
                completed: true,
                state: "post",
                detail: "FT",
                tv: "ESPN+",
                season: "Regular Season"
              },
              next: {
                id: "401932976",
                date: at(2.76),
                timeValid: true,
                home: true,
                opp: "LA",
                oppName: "Angel City",
                us: null,
                them: null,
                result: null,
                completed: false,
                state: "pre",
                detail: "11/7 - 12:00 PM EST",
                tv: "CBS",
                season: "Playoffs - Quarterfinals"
              },
              upcoming: [],
              live: {
                id: "401932976",
                date: at(-1.2),
                timeValid: true,
                home: true,
                opp: "LA",
                oppName: "Angel City",
                us: "2",
                them: "1",
                result: null,
                completed: false,
                state: "in",
                detail: "67'",
                tv: "CBS",
                season: "Playoffs - Quarterfinals",
                situation: ""
              },
              error: null
            }
          ],
          error: null
        }
      ],
      updated: now,
      error: null,
    }
  }

  get data() {
    return { widgetId: "sports", payload: this._payload }
  }
}
