// Low-precision solar position (accurate to well under a degree, plenty for
// a dot map), after the US Naval Observatory's approximation.
const RAD = Math.PI / 180

function solar(time) {
  const d = time / 86400000 + 2440587.5 - 2451545.0 // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD        // mean anomaly
  const q = 280.459 + 0.98564736 * d                // mean longitude (deg)
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD
  const e = (23.439 - 0.00000036 * d) * RAD         // obliquity
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / RAD
  const declination = Math.asin(Math.sin(e) * Math.sin(L)) / RAD
  // equation of time in hours: mean minus apparent solar time
  let eqDeg = ((q - ra) % 360 + 540) % 360 - 180
  return { declination, eqTime: eqDeg / 15 }
}

// the point on Earth where the sun is directly overhead
export function subsolarPoint(time = Date.now()) {
  const { declination, eqTime } = solar(time)
  const utcHours = (time % 86400000) / 3600000
  let lon = -15 * (utcHours - 12 + eqTime)
  lon = ((lon + 540) % 360) - 180
  return { lat: declination, lon }
}

// sine of the sun's elevation at (lat, lon) given the subsolar point
export function sunElevationSin(lat, lon, sun) {
  return Math.sin(lat * RAD) * Math.sin(sun.lat * RAD) +
    Math.cos(lat * RAD) * Math.cos(sun.lat * RAD) * Math.cos((lon - sun.lon) * RAD)
}

// latitude of the day/night line at a longitude
export function terminatorLat(lon, sun) {
  const tanDec = Math.tan(sun.lat * RAD)
  if(Math.abs(tanDec) < 1e-6) return null // equinox: the line runs pole to pole
  return Math.atan(-Math.cos((lon - sun.lon) * RAD) / tanDec) / RAD
}

// today's sunrise and sunset (ms) at a place, or null in polar day/night
export function sunTimes(lat, lon, time = Date.now()) {
  const day = new Date(time)
  day.setHours(12, 0, 0, 0) // local noon of the day being asked about
  const { declination, eqTime } = solar(day.getTime())
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(declination * RAD)) /
    (Math.cos(lat * RAD) * Math.cos(declination * RAD))
  if(cosH < -1 || cosH > 1) return null
  const hourAngle = Math.acos(cosH) / RAD / 15 // hours
  const utcMidnight = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
  const noonUtc = 12 - lon / 15 - eqTime
  return {
    sunrise: utcMidnight + (noonUtc - hourAngle) * 3600000,
    sunset: utcMidnight + (noonUtc + hourAngle) * 3600000,
  }
}
