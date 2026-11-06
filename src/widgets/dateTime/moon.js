// Low-precision Moon position and phase (about a degree: plenty for a dot
// map), from the main terms of the lunar theory.
const RAD = Math.PI / 180
const SYNODIC_MONTH = 29.530588853 // days

const norm360 = (a) => ((a % 360) + 360) % 360
const norm180 = (a) => ((((a % 360) + 540) % 360) - 180) // JS % keeps the sign of a

function daysSinceJ2000(time) {
  return time / 86400000 + 2440587.5 - 2451545.0
}

// ecliptic longitudes (deg) of the Moon and Sun
function longitudes(d) {
  const L = 218.316 + 13.176396 * d          // Moon's mean longitude
  const M = (134.963 + 13.064993 * d) * RAD  // Moon's mean anomaly
  const F = (93.272 + 13.229350 * d) * RAD   // argument of latitude
  const moonLon = L + 6.289 * Math.sin(M)
  const moonLat = 5.128 * Math.sin(F)
  const g = (357.529 + 0.98560028 * d) * RAD
  const q = 280.459 + 0.98564736 * d
  const sunLon = q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)
  return { moonLon, moonLat, sunLon }
}

// the point on Earth where the Moon is directly overhead
export function sublunarPoint(time = Date.now()) {
  const d = daysSinceJ2000(time)
  const { moonLon, moonLat } = longitudes(d)
  const e = 23.439 * RAD
  const l = moonLon * RAD, b = moonLat * RAD
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)) / RAD
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)) / RAD
  const gmst = 280.46061837 + 360.98564736629 * d // Greenwich sidereal time (deg)
  return { lat: dec, lon: norm180(ra - gmst) }
}

const NAMES = [
  [0.0339, 'new moon'],
  [0.216, 'waxing crescent'],
  [0.284, 'first quarter'],
  [0.466, 'waxing gibbous'],
  [0.534, 'full moon'],
  [0.716, 'waning gibbous'],
  [0.784, 'last quarter'],
  [0.966, 'waning crescent'],
  [1.01, 'new moon'],
]

// phase: 0 = new, 0.25 first quarter, 0.5 full, 0.75 last quarter
export function moonPhase(time = Date.now()) {
  const { moonLon, sunLon } = longitudes(daysSinceJ2000(time))
  const phase = norm360(moonLon - sunLon) / 360
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2
  const name = NAMES.find(([limit]) => phase < limit)[1]
  return {
    phase,
    illumination,
    name,
    daysToFull: ((0.5 - phase + 1) % 1) * SYNODIC_MONTH,
    daysToNew: ((1 - phase) % 1) * SYNODIC_MONTH,
  }
}

// Draws the Moon at `phase` as seen from the northern hemisphere (waxing lit
// on the right) into a PIXI.Graphics, centred on (x, y).
export function drawMoon(g, x, y, r, phase, litColor = 0xe8ecf6, darkColor = 0x2a3248) {
  g.beginFill(darkColor)
  g.drawCircle(x, y, r)
  g.endFill()
  const k = Math.cos(2 * Math.PI * phase) // terminator's x as a fraction of the limb's
  const waxing = phase < 0.5
  const steps = 24
  const pts = []
  // limb on the lit side, top to bottom
  for(let i = 0; i <= steps; i++) {
    const t = -Math.PI/2 + Math.PI * i / steps
    const s = Math.cos(t)
    pts.push(x + (waxing ? r * s : -r * s), y + r * Math.sin(t))
  }
  // terminator, bottom to top
  for(let i = steps; i >= 0; i--) {
    const t = -Math.PI/2 + Math.PI * i / steps
    const s = Math.cos(t)
    pts.push(x + (waxing ? r * k * s : -r * k * s), y + r * Math.sin(t))
  }
  g.beginFill(litColor)
  g.drawPolygon(pts)
  g.endFill()
}
