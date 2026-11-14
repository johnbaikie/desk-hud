import { json2satrec, propagate, gstime, eciToGeodetic, eciToEcf, ecfToLookAngles, degreesLat, degreesLong } from 'satellite.js'
import { subsolarPoint } from '../dateTime/sun.js'

// Positions from CelesTrak's orbital elements (OMM JSON), worked out in the
// browser with SGP4 (satellite.js).

const EARTH_RADIUS = 6371 // km
const RAD = Math.PI / 180

const records = new Map() // "id|epoch" -> satrec
export function satrec(omm) {
  const key = `${omm.NORAD_CAT_ID}|${omm.EPOCH}`
  if(!records.has(key)) {
    try {
      records.set(key, json2satrec(omm))
    } catch(err) {
      records.set(key, null)
    }
  }
  return records.get(key)
}

// {lat, lon, alt (km), speed (km/h), ecf} at a time, or null
export function position(rec, time) {
  if(!rec) return null
  const date = new Date(time)
  const pv = propagate(rec, date)
  if(!pv || !pv.position || typeof pv.position === 'boolean' || !Number.isFinite(pv.position.x)) return null
  const gmst = gstime(date)
  const geo = eciToGeodetic(pv.position, gmst)
  const v = pv.velocity
  return {
    lat: degreesLat(geo.latitude),
    lon: degreesLong(geo.longitude),
    alt: geo.height,
    speed: v ? Math.hypot(v.x, v.y, v.z) * 3600 : null,
    ecf: eciToEcf(pv.position, gmst),
  }
}

// whether a position is in Earth's shadow (a cylinder behind the Earth)
export function inShadow(pos, time) {
  const sun = subsolarPoint(time)
  const s = {
    x: Math.cos(sun.lat * RAD) * Math.cos(sun.lon * RAD),
    y: Math.cos(sun.lat * RAD) * Math.sin(sun.lon * RAD),
    z: Math.sin(sun.lat * RAD),
  }
  const r = pos.ecf
  const along = r.x*s.x + r.y*s.y + r.z*s.z
  if(along > 0) return false
  const across = Math.hypot(r.x - along*s.x, r.y - along*s.y, r.z - along*s.z)
  return across < EARTH_RADIUS
}

// the next time the object is more than minElevation degrees above the
// horizon at home within `hours`: {start, end, maxElevation} or null
export function nextPass(rec, home, from, hours=24, minElevation=10) {
  if(!rec || !home) return null
  const observer = { latitude: home.lat * RAD, longitude: home.lon * RAD, height: 0.3 }
  const step = 30*1000
  let pass = null
  for(let t = from; t < from + hours*3600*1000; t += step) {
    const p = position(rec, t)
    if(!p) return null
    const elevation = ecfToLookAngles(observer, p.ecf).elevation / RAD
    if(elevation >= minElevation) {
      if(!pass) pass = { start: t, end: t, maxElevation: elevation }
      pass.end = t
      pass.maxElevation = Math.max(pass.maxElevation, elevation)
    } else if(pass) {
      return pass
    }
  }
  return pass
}
