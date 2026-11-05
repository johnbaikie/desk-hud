const Service = require('../../backend/services/Service.js')

// Weather from the US National Weather Service (api.weather.gov): current
// conditions from the nearest observation station, hourly and 7-day
// forecasts, and active alerts for the configured point. No API key; NWS asks
// for a User-Agent that identifies the application.

const USER_AGENT = 'desk-hud (https://github.com/johnbaikie/desk-hud)'
const API = 'https://api.weather.gov'
const TICK = 2*60*1000              // alerts are checked every tick
const FORECAST_EVERY = 10*60*1000   // observation + forecasts
const POINT_EVERY = 24*60*60*1000   // grid/station lookup rarely changes
const REQUEST_TIMEOUT = 20*1000
const STALE_OBSERVATION = 2*60*60*1000
const HOURLY_COUNT = 25
const RAIN_POP = 50                 // % chance that counts as "rain" on the circle

// NWS icon condition codes -> OpenWeatherMap-style codes, which the widget
// already has weather-font glyphs for
const ICON_CODES = {
  skc: '01', hot: '01', cold: '01',
  few: '02',
  sct: '03',
  bkn: '04', ovc: '04',
  rain_showers: '09', rain_showers_hi: '09',
  rain: '10', fzra: '10', rain_fzra: '10', sleet: '10', rain_sleet: '10',
  tsra: '11', tsra_sct: '11', tsra_hi: '11', tornado: '11', hurricane: '11', tropical_storm: '11',
  snow: '13', rain_snow: '13', snow_sleet: '13', snow_fzra: '13', blizzard: '13',
  fog: '50', haze: '50', smoke: '50', dust: '50',
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

// ".../icons/land/night/tsra_hi,40/rain,60?size=small" -> '11n'
function iconCode(url) {
  if(!url) return null
  const m = url.match(/\/icons\/land\/(day|night)\/([a-z_]+)/)
  if(!m) return null
  const base = ICON_CODES[m[2].replace(/^wind_/, '')] || '03'
  return base + (m[1] === 'day' ? 'd' : 'n')
}

const value = (q) => (q && Number.isFinite(q.value)) ? q.value : null

// NWS wraps alert text at ~70 columns; join the lines of each paragraph
function unwrap(text) {
  if(!text) return ''
  return text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(p => p && !/^[A-Z]{3}[A-Z0-9]{3}$/.test(p)) // leading product code, e.g. "FFWFFC"
    .join('\n\n')
}

function sameLocalDay(a, b) {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

class WeatherService extends Service {
  constructor(config, io, webApp) {
    super(config, io, webApp, 'weather')
    this._loop = null
    this._point = null
    this._pointAt = 0
    this._forecastAt = 0
    this._observation = null
    this._hourly = null
    this._daily = null
    this._alerts = null
    this._last = null
    this._ticking = false
  }

  async start() {
    if(this._loop) clearInterval(this._loop)
    this._loop = setInterval(() => this.tick(), TICK)
    this.tick()
  }

  async welcomeClient(socket) {
    if(this._last) this.emit(this._last, socket)
  }

  get _metric() {
    try {
      return this.config.getProp('weather.units') !== 'imperial'
    } catch(err) {
      return true // optional key: metric unless configured
    }
  }

  async _get(url) {
    let lastErr
    for(let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        })
        if(!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).pathname}`)
        return await response.json()
      } catch(err) {
        lastErr = err
        if(attempt < 2) await new Promise(r => setTimeout(r, 5000)) // NWS has brief 5xx hiccups
      }
    }
    const cause = lastErr.cause && (lastErr.cause.code || lastErr.cause.message)
    throw new Error(lastErr.message + (cause ? ` (${cause})` : ''))
  }

  async tick() {
    if(this._ticking) return
    this._ticking = true
    try {
      const now = Date.now()
      if(!this._point || now - this._pointAt > POINT_EVERY) {
        await this._step('location', () => this._fetchPoint())
      }
      if(this._point) {
        await this._step('alerts', () => this._fetchAlerts())
        if(now - this._forecastAt > FORECAST_EVERY) {
          this._forecastAt = now
          await this._step('observation', () => this._fetchObservation())
          await this._step('hourly forecast', () => this._fetchHourly())
          await this._step('daily forecast', () => this._fetchDaily())
        }
      }
      const payload = this._payload()
      if(payload) {
        this._last = payload
        this.emit(payload)
      } else if(!this._last) {
        this.emit({ error: 'Could not load the weather' })
      }
    } finally {
      this._ticking = false
    }
  }

  // each part fails on its own and keeps its last good data
  async _step(name, fn) {
    try {
      await fn()
    } catch(err) {
      this.logger.error(`Weather ${name} failed: ${err.message}`)
    }
  }

  async _fetchPoint() {
    const lat = Number(this.config.getProp('weather.lat')).toFixed(4)
    const lon = Number(this.config.getProp('weather.lon')).toFixed(4)
    const json = await this._get(`${API}/points/${lat},${lon}`)
    const p = json.properties
    if(!p || !p.forecast || !p.forecastHourly || !p.observationStations) {
      throw new Error('points response is missing forecast links')
    }
    const stations = await this._get(p.observationStations)
    const stationIds = (stations.features || []).map(f => f.properties.stationIdentifier).filter(Boolean)
    this._point = {
      lat, lon,
      city: p.relativeLocation && p.relativeLocation.properties ? p.relativeLocation.properties.city : '',
      forecast: p.forecast,
      forecastHourly: p.forecastHourly,
      stations: stationIds.slice(0, 3),
    }
    this._pointAt = Date.now()
  }

  async _fetchAlerts() {
    const { lat, lon } = this._point
    const json = await this._get(`${API}/alerts/active?point=${lat},${lon}`)
    if(!Array.isArray(json.features)) throw new Error('alerts response has no features')
    const rank = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 }
    this._alerts = json.features
      .map(f => f.properties)
      .filter(a => a && a.status === 'Actual' && a.messageType !== 'Cancel')
      .filter(a => !a.ends || new Date(a.ends).getTime() > Date.now())
      .map(a => ({
        id: a.id,
        event: a.event,
        severity: a.severity,
        urgency: a.urgency,
        headline: a.headline,
        area: a.areaDesc,
        onset: a.onset ? new Date(a.onset).getTime() : null,
        ends: (a.ends || a.expires) ? new Date(a.ends || a.expires).getTime() : null,
        description: unwrap(a.description),
        instruction: unwrap(a.instruction),
        // warnings (not watches/advisories) wake the screen
        isWarning: /warning/i.test(a.event) && (a.severity === 'Severe' || a.severity === 'Extreme'),
      }))
      .sort((a, b) => (rank[a.severity] ?? 4) - (rank[b.severity] ?? 4))
  }

  async _fetchObservation() {
    // the nearest station sometimes lags or misses values; try the next ones
    for(const id of this._point.stations) {
      const json = await this._get(`${API}/stations/${id}/observations/latest`)
      const o = json.properties
      const tempC = value(o && o.temperature)
      const at = o && o.timestamp ? new Date(o.timestamp).getTime() : 0
      if(tempC === null || Date.now() - at > STALE_OBSERVATION) continue
      const feelsC = value(o.heatIndex) ?? value(o.windChill) ?? tempC
      const windKmh = value(o.windSpeed)
      const windDeg = value(o.windDirection)
      const metric = this._metric
      this._observation = {
        station: id,
        at,
        temp: metric ? tempC : tempC * 9/5 + 32,
        feelsLike: metric ? feelsC : feelsC * 9/5 + 32,
        description: o.textDescription || '',
        icon: iconCode(o.icon),
        wind: windKmh === null ? null : Math.round(metric ? windKmh : windKmh * 0.621371),
        windDir: windDeg === null ? '' : COMPASS[Math.round(windDeg / 22.5) % 16],
        humidity: value(o.relativeHumidity) === null ? null : Math.round(value(o.relativeHumidity)),
      }
      return
    }
    throw new Error('no recent observation from ' + this._point.stations.join(', '))
  }

  async _fetchHourly() {
    const json = await this._get(this._point.forecastHourly + (this._metric ? '?units=si' : ''))
    const periods = json.properties && json.properties.periods
    if(!Array.isArray(periods) || !periods.length) throw new Error('hourly forecast has no periods')
    const now = Date.now()
    this._hourly = periods
      .map(p => ({
        t: new Date(p.startTime).getTime(),
        end: new Date(p.endTime).getTime(),
        temp: p.temperature,
        icon: iconCode(p.icon),
        pop: value(p.probabilityOfPrecipitation) ?? 0,
        short: p.shortForecast,
        wind: p.windSpeed,
        windDir: p.windDirection,
        humidity: value(p.relativeHumidity),
      }))
      .filter(p => p.end > now && Number.isFinite(p.temp))
  }

  async _fetchDaily() {
    const json = await this._get(this._point.forecast + (this._metric ? '?units=si' : ''))
    const periods = json.properties && json.properties.periods
    if(!Array.isArray(periods) || !periods.length) throw new Error('daily forecast has no periods')

    // pair day and night periods into one entry per local date
    const days = []
    for(const p of periods) {
      const t = new Date(p.startTime).getTime()
      let day = days.find(d => sameLocalDay(d.t, t))
      if(!day) {
        day = { t, name: null, high: null, low: null, icon: null, pop: 0, short: '' }
        days.push(day)
      }
      const pop = value(p.probabilityOfPrecipitation) ?? 0
      day.pop = Math.max(day.pop, pop)
      if(p.isDaytime) {
        day.high = p.temperature
        day.icon = iconCode(p.icon)
        day.short = p.shortForecast
      } else {
        day.low = p.temperature
        if(!day.icon) {
          day.icon = iconCode(p.icon)
          day.short = p.shortForecast
        }
      }
    }
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    days.forEach((d, i) => {
      const today = i === 0 && sameLocalDay(d.t, Date.now())
      d.name = today ? (d.high === null ? 'Tonight' : 'Today') : weekday[new Date(d.t).getDay()]
    })
    this._daily = days.filter(d => d.high !== null || d.low !== null)
  }

  _payload() {
    const hourly = this._hourly || []
    let current = this._observation
    if(!current && hourly.length) {
      // no usable observation: describe the current forecast hour instead
      const h = hourly[0]
      current = { station: null, at: h.t, temp: h.temp, feelsLike: h.temp, description: h.short, icon: h.icon,
        wind: parseInt(h.wind, 10) || null, windDir: h.windDir || '', humidity: h.humidity }
    }
    if(!current) return null

    const next24 = hourly.filter(h => h.t < Date.now() + 24*60*60*1000)
    const temps = next24.map(h => h.temp).concat([current.temp])
    const rain = hourly.find(h => h.pop >= RAIN_POP && h.t < Date.now() + 48*60*60*1000)

    return {
      units: this._metric ? 'metric' : 'imperial',
      location: this._point ? this._point.city : '',
      current: {
        ...current,
        temp: Math.round(current.temp),
        feelsLike: Math.round(current.feelsLike),
      },
      range: { low: Math.round(Math.min(...temps)), high: Math.round(Math.max(...temps)) },
      rainTime: rain ? rain.t : null,
      hourly: hourly.slice(0, HOURLY_COUNT).map(h => ({ t: h.t, temp: h.temp, icon: h.icon, pop: h.pop })),
      daily: (this._daily || []).slice(0, 7),
      alerts: this._alerts || [],
      alertsOk: this._alerts !== null,
      updatedAt: Date.now(),
      error: null,
    }
  }
}

module.exports = WeatherService
