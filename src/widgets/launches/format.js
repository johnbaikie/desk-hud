// Formatting shared by the launches widget and its screens. Times are shown
// in the browser's (the Pi's) local time.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const pad2 = (n) => String(n).padStart(2, '0')
export const clock = (t) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }

// launch times LL2 knows to the second or minute; looser ones (HR, DAY,
// MON, QTR, ...) are shown as a date or "no earlier than"
export const exact = (l) => l.precision === 'SEC' || l.precision === 'MIN' || !l.precision

// "Fri 13 Nov 11:54", or without the time when it isn't known
export function when(l) {
  const d = new Date(l.net)
  const day = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
  if(exact(l)) return `${day} ${clock(l.net)}`
  if(l.precision === 'HR') return `${day} ~${clock(l.net)}`
  if(l.precision === 'DAY') return day
  return `NET ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// "T-05:12:44", "T-1D 05:12", "T+00:03:10"; rougher for loose times
export function countdown(l, now) {
  const ms = l.net - now
  const sign = ms >= 0 ? 'T-' : 'T+'
  const a = Math.abs(ms)
  const days = Math.floor(a / 86400000)
  const h = Math.floor(a / 3600000) % 24
  const m = Math.floor(a / 60000) % 60
  const s = Math.floor(a / 1000) % 60
  if(exact(l) || ms < 0) {
    return days ? `${sign}${days}D ${pad2(h)}:${pad2(m)}` : `${sign}${pad2(h)}:${pad2(m)}:${pad2(s)}`
  }
  if(l.precision === 'HR') return a < 48*3600000 ? `${sign}~${Math.round(a / 3600000)}H` : `${sign}~${Math.round(a / 86400000)}D`
  if(l.precision === 'DAY') return `${sign}~${Math.max(1, Math.round(a / 86400000))}D`
  return 'TBD'
}

// "Cape Canaveral SFS, FL, USA" -> "Cape Canaveral SFS"
export const site = (l) => (l.location || '').split(',')[0].trim()

// short rocket name for the circle: "Falcon 9 Block 5" -> "Falcon 9"
export const shortRocket = (l) => (l.rocket || '').replace(/\s+Block\s+\d+.*$/i, '').trim()

export const cut = (s, n) => !s ? '' : s.length > n ? s.slice(0, n - 2).trimEnd() + '..' : s

// statuses LL2 uses: Go, TBC, TBD, Hold, In Flight, Deployed (payload deployed), Success, Failure, Partial Failure
export const GOOD = ['Go', 'In Flight', 'Deployed', 'Success']
