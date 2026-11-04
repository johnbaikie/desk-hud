const Service = require('../../backend/services/Service.js')
const ical = require('node-ical')

const DAY = 24*60*60*1000
// The published feed is large (1.4 MB, 6-7 s over the Pi's Wi-Fi) and a
// fetch occasionally drops. Retry a few times, and keep showing the last
// good calendar until it is this old before showing an error.
const FETCH_ATTEMPTS = 3
const RETRY_DELAY = 20*1000
const FETCH_TIMEOUT = 60*1000
const STALE_AFTER = 60*60*1000

// Reads a published Outlook calendar (ICS link) and emits events in the same
// shape as CalendarService, so the widget can reuse the calendar UI.
class OutlookService extends Service {

  constructor(config, io, webApp) {
    super(config, io, webApp, 'outlook')
    this._loop = null
    this._last = null
    this._lastOkAt = 0
    this._updating = false
  }

  async start() {
    if(this._loop) {
      clearInterval(this._loop)
    }
    this._loop = setInterval(() => this.update(), 1000*60*5)
    this.update()
  }

  async welcomeClient(socket) {
    if(this._last) {
      this.emit(this._last, socket)
    }
  }

  async update() {
    if(this._updating) return // a slow fetch with retries can outlast the interval
    this._updating = true
    try {
      this._last = await this.fetchWithRetry()
      this._lastOkAt = Date.now()
      this.emit(this._last)
    } catch (err) {
      if(this._last && Date.now() - this._lastOkAt < STALE_AFTER) {
        const age = Math.round((Date.now() - this._lastOkAt)/60000)
        this.logger.error(`Outlook calendar fetch failed, keeping data from ${age} min ago: ${describe(err)}`)
      } else {
        this.logger.error('Outlook calendar fetch failed: ' + describe(err))
        this.emit({ error: 'Could not load the Outlook calendar' })
      }
    } finally {
      this._updating = false
    }
  }

  async fetchWithRetry() {
    for(let attempt = 1; ; attempt++) {
      try {
        return await this.fetchAll()
      } catch (err) {
        if(attempt >= FETCH_ATTEMPTS) throw err
        this.logger.log(`Outlook calendar fetch attempt ${attempt} failed (${describe(err)}), retrying`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      }
    }
  }

  async fetchAll() {
    const url = this.config.getProp('outlook.icsUrl').replace(/^webcal:/i, 'https:')
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
    if(!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = ical.sync.parseICS(await response.text())

    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    const from = midnight
    const to = new Date(midnight.getTime() + 8*DAY)

    const allEvents = []
    for(const item of Object.values(data)) {
      if(item.type !== 'VEVENT' || item.status === 'CANCELLED') continue
      // overrides of a recurring series are applied through its master event
      if(item.recurrenceid && !item.rrule) continue
      let instances
      try {
        instances = ical.expandRecurringEvent(item, { from, to, expandOngoing: true })
      } catch (err) {
        this.logger.error(`Skipping event "${item.summary}": ${err.message}`)
        continue
      }
      for(const inst of instances) {
        const ev = inst.event || item
        if(ev.status === 'CANCELLED') continue
        let start = inst.start.getTime()
        let end = inst.end ? inst.end.getTime() : start
        if(inst.isFullDay) {
          // all-day dates as local midnight
          const s = inst.start, e = inst.end || inst.start
          start = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime()
          end = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime()
          if(end <= start) end = start + DAY
        }
        allEvents.push({
          id: `${item.uid}-${start}`,
          summary: typeof inst.summary === 'object' ? inst.summary.val : (inst.summary || '(no title)'),
          start,
          end,
          allDay: inst.isFullDay || (end - start) > 23*60*60*1000,
        })
      }
    }
    return {
      allEvents: allEvents.sort((a, b) => a.start - b.start),
      error: null,
    }
  }

}

// error text for the log; Node's fetch hides the network cause ("fetch
// failed") in err.cause. Never include the URL: it is a secret link.
function describe(err) {
  const cause = err && err.cause
  const detail = cause && (cause.code || cause.message)
  return (err && err.message || String(err)) + (detail ? ` (${detail})` : '')
}

module.exports = OutlookService
