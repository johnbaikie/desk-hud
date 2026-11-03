const Service = require('../../backend/services/Service.js')
const ical = require('node-ical')

const DAY = 24*60*60*1000

// Reads a published Outlook calendar (ICS link) and emits events in the same
// shape as CalendarService, so the widget can reuse the calendar UI.
class OutlookService extends Service {

  constructor(config, io, webApp) {
    super(config, io, webApp, 'outlook')
    this._loop = null
    this._last = null
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
    try {
      this._last = await this.fetchAll()
      this.emit(this._last)
    } catch (err) {
      // never log the URL: it is a secret link to the calendar
      this.logger.error('Outlook calendar fetch failed: ' + err.message)
      this.emit({ error: 'Could not load the Outlook calendar' })
    }
  }

  async fetchAll() {
    const url = this.config.getProp('outlook.icsUrl').replace(/^webcal:/i, 'https:')
    const response = await fetch(url)
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

module.exports = OutlookService
