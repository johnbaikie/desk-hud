export default class OutlookDemoData {
  constructor() {
    const now = Math.floor((new Date().getTime())/(1000*60*60))*1000*60*60
    const h = 60*60*1000
    const ev = (id, summary, start, end) => ({ id, summary, start: now + start*h, end: now + end*h, allDay: false })
    this._data = {
      widgetId: 'outlook',
      payload: {
        allEvents: [
          ev('o1', 'Sprint planning', -4, -3),
          ev('o2', '1:1 with manager', -1, -0.5),
          ev('o3', 'Architecture review', 1, 2),
          ev('o4', 'Customer call', 2.5, 3),
          ev('o5', 'Release retro', 4, 4.5),
          // later days, for swiping the main screen
          ev('o6', 'Quarterly business review', 24, 26),
          ev('o7', 'Security training', 27, 28),
          ev('o8', 'Roadmap workshop', 48, 50),
        ]
      }
    }
  }

  get data() {
    return this._data
  }
}
