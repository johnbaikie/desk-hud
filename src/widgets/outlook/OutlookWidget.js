import CalendarWidget from '../calendar/CalendarWidget.js'

// Work calendar from a published Outlook ICS link; same UI as the Google calendar.
export default class OutlookWidget extends CalendarWidget {
  constructor() {
    super('outlook', 'Outlook')
  }
}
