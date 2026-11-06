const GoogleService = require('../../backend/services/GoogleService.js')
const { google } = require('googleapis');

class CalendarService extends GoogleService {

  constructor(config, io, webApp) {
    super(config, io, webApp, 'calendar')
    this._loop = null

    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  async start() {
    if(this._loop) {
      clearInterval(this._loop)
    }
    this._loop = setInterval(() => this.update(), 1000*60*5)
    this.update()
  }

  async welcomeClient(socket) {
    try {
      this.emit(await this.fetchAll(), socket)
    } catch (err) {
      this.logger.error(err)
    }
  }

  async update() {
    try {
      this.emit(await this.fetchAll())
    } catch (err) {
      this.logger.error(err)
    }
  }

  async fetchAll() {
    try {
      const calIds = this.config.getProp('google.calendars')
      // local midnight (not Math.floor(now/day), which is UTC midnight and
      // skipped the rest of today after 6 PM in Chicago)
      // the calendar can show any day of this month and next (the DATE tab
      // links to them): load from the 1st of this month to the end of next
      const now = new Date()
      const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1)
      const params = {
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
      }
    
      const obj2timestamp = (obj) => {
        if(obj.dateTime) return new Date(obj.dateTime).getTime()
        if(obj.date) {
          // all-day events give a plain date; new Date('2026-11-03') would be
          // UTC midnight, i.e. the previous evening here
          const [y, m, d] = obj.date.split('-').map(Number)
          return new Date(y, m - 1, d).getTime()
        }
        return 0
      }
    
      const allEvents = []
      for(let calId of calIds) {
        const result = await this.calendar.events.list({...params, calendarId: calId})
        if(result.data.items.length) {

          const events = result.data.items.map(e => {
            const start = obj2timestamp(e.start)
            const end = obj2timestamp(e.end)
            return {
              id: e.id, 
              summary: e.summary,
              start,
              end,
              allDay: !!e.start.date || ((end - start) > 23*60*60*1000)
            }
          })
          allEvents.push(...events)
        }
      }
      return {
        allEvents: allEvents.sort((a, b) => a.start - b.start),
        error: null
      }
    } catch (error) {
      if (error.response && error.response.data && (error.response.data.error === 'invalid_grant' || error.response.data.error_description.includes('Token has been expired or revoked'))) {
        this.logger.error('Token has been expired or revoked.')
        this.logger.error(error)
        return {
          allEvents: [],
          error: 'token_expired'
        }
      } else if(error.response && error.response.data) {
        return {
          allEvents: [],
          error: error.response.data.error + ': ' + error.response.data.error_description
        }
      } else {
        throw error
      }
    }
  }

}

module.exports = CalendarService