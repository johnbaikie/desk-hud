const Service = require('../../backend/services/Service.js')
const storage = require('node-persist')

// Daily, weekly and monthly horoscopes for the sign in `horoscope.sign`.
// - Daily: FreeAstroAPI (freeastroapi.com) when a key is set in
//   `horoscope.apiKey` (or the FREE_ASTRO_API_KEY environment variable): a
//   forecast with love/career/money/health scores, lucky colour, number and
//   time, and the Moon, for our own local date. Free plan: 80 requests a day,
//   1 a second; this makes about 10. The key stays on the server: it is only
//   sent in the x-api-key header, never to the browser or the logs.
//   The text comes from FreeHoroscopeAPI's daily (FreeAstroAPI's is a
//   template that barely changes), FreeAstroAPI's only when that fails.
//   Without a key, or while FreeAstroAPI fails, FreeHoroscopeAPI's daily alone.
// - Weekly and monthly: FreeHoroscopeAPI (freehoroscopeapi.com; no key).
//   Its terms ask for a visible "Powered by FreeHoroscopeAPI" credit, which
//   the widget shows.
// Each period keeps its last good reading (saved in node-persist), so a
// failing endpoint (weekly times out now and then) doesn't blank its tab.
// The dates are the provider's labels: its day can start before ours.

const USER_AGENT = 'desk-hud (https://github.com/johnbaikie/desk-hud)'
const API = 'https://freehoroscopeapi.com/api/v1/get-horoscope'
const ASTRO_API = 'https://api.freeastroapi.com/api/v2/horoscope/daily/sign'
const TICK = 15*60*1000
const REQUEST_TIMEOUT = 20*1000
const PERIODS = {
  daily: 3*60*60*1000, // and at local midnight
  weekly: 6*60*60*1000,
  monthly: 12*60*60*1000,
}
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']

class HoroscopeService extends Service {
  constructor(config, io, webApp) {
    super(config, io, webApp, 'horoscope')
    this._sign = null
    this._readings = {} // period -> {date, text, fetched}
    this._errors = {}   // period -> message, while it fails
    this._nextAt = {}   // period -> time of the next fetch
    this._timer = null
  }

  async start() {
    let sign = ''
    try {
      sign = String(this.config.getProp('horoscope.sign')).trim().toLowerCase()
    } catch(err) {
      sign = ''
    }
    if(!SIGNS.includes(sign)) {
      this.emit({ error: 'Set horoscope.sign to a zodiac sign' })
      return
    }
    this._sign = sign
    try {
      this._apiKey = String(this.config.getProp('horoscope.apiKey')).trim()
    } catch(err) {
      this._apiKey = String(process.env.FREE_ASTRO_API_KEY || '').trim()
    }
    try {
      const saved = await storage.getItem('horoscope.readings')
      if(saved && saved.sign === sign && saved.readings && typeof saved.readings === 'object') {
        for(const period of Object.keys(PERIODS)) {
          const r = saved.readings[period]
          if(r && typeof r.text === 'string' && r.text) this._readings[period] = r
        }
      }
    } catch(err) {
      this.logger.error('Saved horoscopes:', err.message || err)
    }
    this._tick() // not awaited: start() must resolve even if the API hangs
  }

  async welcomeClient(socket) {
    // nothing to send until the first fetch has finished (or a reading was saved)
    if(this._sign && (Object.keys(this._readings).length || Object.keys(this._errors).length)) {
      this.emit(this._payload(), socket)
    }
  }

  async onMessage() {}

  // the server's local date and time zone (the Pi's)
  _today() {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  // FreeAstroAPI's daily sign horoscope for our local date
  async _fetchAstro() {
    const date = this._today()
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'AUTO'
    const url = `${ASTRO_API}?sign=${this._sign}&date=${date}&tz_str=${encodeURIComponent(tz)}&lang=en`
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'x-api-key': this._apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    let json = null
    try { json = await response.json() } catch(err) { json = null }
    if(!response.ok) {
      const detail = json && (json.error && (json.error.message || json.error) || json.message || json.detail)
      throw new Error(`FreeAstroAPI: ${typeof detail === 'string' ? detail : 'HTTP ' + response.status}`)
    }
    const d = json && json.data
    const text = d && d.content && typeof d.content.text === 'string' ? d.content.text.trim() : ''
    if(!d || !text || String(d.sign || '').toLowerCase() !== this._sign) throw new Error('FreeAstroAPI: unexpected response')
    const scores = {}
    for(const k of ['overall', 'love', 'career', 'money', 'health']) {
      const v = d.scores && d.scores[k]
      if(Number.isFinite(v)) scores[k] = Math.max(0, Math.min(100, v))
    }
    // the lucky time window comes in UTC: send it as times
    const lucky = d.lucky || {}
    const w = lucky.time_window || {}
    const at = (hm) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '')
      const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.date || date)
      if(!m || !day || (w.tz && w.tz !== 'UTC')) return null
      return Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), Number(m[1]), Number(m[2]))
    }
    const astro = d.astro || {}
    return {
      source: 'freeastroapi',
      date: String(d.date || date),
      text,
      theme: d.content.theme || '',
      keywords: Array.isArray(d.content.keywords) ? d.content.keywords.filter(k => typeof k === 'string').slice(0, 5) : [],
      scores,
      lucky: {
        color: lucky.color && (lucky.color.label || lucky.color.key) || '',
        number: Number.isFinite(lucky.number) ? lucky.number : null,
        start: at(w.start),
        end: at(w.end),
      },
      moon: {
        sign: astro.moon_sign && (astro.moon_sign.label || astro.moon_sign.key) || '',
        phase: astro.moon_phase && (astro.moon_phase.label || astro.moon_phase.key) || '',
      },
      fetched: Date.now(),
    }
  }

  async _fetch(period) {
    if(period === 'daily' && this._apiKey) return this._fetchDaily()
    return this._fetchFree(period)
  }

  // TODAY with a key: FreeAstroAPI's scores, lucky things and Moon, with
  // FreeHoroscopeAPI's text (FreeAstroAPI's own text is a template that barely
  // changes from day to day). FreeHoroscopeAPI's day starts before ours, so a
  // reading dated after today (in the evening) doesn't replace today's.
  async _fetchDaily() {
    const today = this._today()
    const last = this._readings.daily
    let astro = null
    try {
      astro = await this._fetchAstro()
    } catch(err) {
      this.logger.error('Horoscope daily (FreeAstroAPI):', err.message || err)
      // keep today's FreeAstroAPI reading rather than replace it
      if(last && last.source === 'freeastroapi' && last.date === today) astro = last
    }
    let free = null
    try {
      free = await this._fetchFree('daily')
    } catch(err) {
      this.logger.error('Horoscope daily (FreeHoroscopeAPI):', err.message || err)
    }
    const lastFree = last && last.textSource === 'freehoroscopeapi' && last.textDate === today
      ? { date: last.textDate, text: last.text } : null
    if(free && free.date > today && lastFree) free = lastFree
    if(!free) free = lastFree
    if(!astro) {
      if(free) return { ...free, fetched: Date.now() }
      throw new Error('FreeAstroAPI and FreeHoroscopeAPI both failed')
    }
    // astroText: FreeAstroAPI's own text, for when FreeHoroscopeAPI has none for today
    const astroText = astro.astroText || astro.text
    return free
      ? { ...astro, astroText, text: free.text, textSource: 'freehoroscopeapi', textDate: free.date }
      : { ...astro, astroText, text: astroText, textSource: 'freeastroapi', textDate: astro.date }
  }

  // FreeHoroscopeAPI: daily, weekly or monthly
  async _fetchFree(period) {
    const response = await fetch(`${API}/${period}?sign=${this._sign}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    let json = null
    try { json = await response.json() } catch(err) { json = null }
    if(!response.ok) {
      throw new Error(json && json.error ? json.error : `HTTP ${response.status}`)
    }
    const d = json && json.data
    if(!d || typeof d.horoscope !== 'string' || !d.horoscope.trim()
      || String(d.sign || '').toLowerCase() !== this._sign || d.period !== period) {
      throw new Error('unexpected response')
    }
    return { date: String(d.date || ''), text: d.horoscope.trim(), fetched: Date.now() }
  }

  async _tick() {
    clearTimeout(this._timer)
    const now = Date.now()
    let changed = false
    for(const period of Object.keys(PERIODS)) {
      const stale = period === 'daily' && this._readings.daily && this._readings.daily.source === 'freeastroapi'
        && this._readings.daily.date !== this._today()
      if(!stale && this._nextAt[period] && now < this._nextAt[period]) continue
      try {
        this._readings[period] = await this._fetch(period)
        delete this._errors[period]
        this._nextAt[period] = now + PERIODS[period]
      } catch(err) {
        this.logger.error(`Horoscope ${period}:`, err.message || err)
        this._errors[period] = String(err.message || err)
        this._nextAt[period] = now + TICK
      }
      changed = true
    }
    if(changed) {
      try {
        await storage.setItem('horoscope.readings', { sign: this._sign, readings: this._readings })
      } catch(err) {
        this.logger.error('Saving horoscopes:', err.message || err)
      }
      this.emit(this._payload())
    }
    this._timer = setTimeout(() => this._tick(), TICK)
  }

  _payload() {
    const any = Object.keys(this._readings).length
    return {
      sign: this._sign,
      readings: this._readings,
      errors: this._errors,
      error: any ? null : (Object.values(this._errors)[0] || 'Loading horoscopes'),
    }
  }
}

module.exports = HoroscopeService
