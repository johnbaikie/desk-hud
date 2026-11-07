// Demo payload in the shape WeatherService sends (NWS data mapped to
// OpenWeatherMap-style icon codes), with one active watch.
export default class WeatherDemoData {
  constructor() {
    const hour = 60*60*1000
    const now = Date.now()
    const thisHour = Math.floor(now / hour) * hour
    const temps = [72, 74, 75, 75, 73, 70, 68, 66, 64, 63, 62, 61, 61, 60, 60, 61, 63, 66, 69, 72, 74, 76, 77, 77, 76]
    const pops = [10, 10, 20, 40, 70, 70, 60, 40, 20, 20, 10, 10, 0, 0, 0, 0, 0, 0, 0, 10, 10, 10, 20, 20, 20]
    const icon = (i) => {
      const h = new Date(thisHour + i*hour).getHours()
      const dn = h >= 7 && h < 19 ? 'd' : 'n'
      if(pops[i] >= 60) return '11' + dn
      if(pops[i] >= 40) return '09' + dn
      return (pops[i] >= 20 ? '04' : '02') + dn
    }
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const days = [
      [78, 61, '11d', 70, 'Showers And Thunderstorms'],
      [74, 58, '03d', 20, 'Partly Sunny'],
      [65, 52, '10d', 80, 'Rain Likely'],
      [70, 55, '11d', 60, 'Chance Thunderstorms'],
      [72, 57, '01d', 10, 'Sunny'],
      [75, 59, '02d', 0, 'Mostly Sunny'],
    ]
    this._data = {
      widgetId: 'weather',
      payload: {
        units: 'imperial',
        location: 'Chicago',
        current: { station: 'KMDW', at: now - 20*60*1000, temp: 72, feelsLike: 75, description: 'Partly Cloudy',
          icon: icon(0), wind: 12, windDir: 'S', humidity: 64 },
        range: { low: 60, high: 77 },
        rainTime: thisHour + 4*hour,
        hourly: temps.map((t, i) => ({ t: thisHour + i*hour, temp: t, icon: icon(i), pop: pops[i] })),
        daily: days.map(([high, low, ic, pop, short], i) => ({
          t: now + i*24*hour,
          name: i === 0 ? 'Today' : weekday[new Date(now + i*24*hour).getDay()],
          high, low, icon: ic, pop, short,
        })),
        alerts: [{
          id: 'demo-watch',
          event: 'Severe Thunderstorm Watch',
          severity: 'Moderate',
          urgency: 'Future',
          headline: 'Severe Thunderstorm Watch issued until 9:00 PM',
          area: 'Cook, IL; DuPage, IL; Lake, IL',
          onset: now,
          ends: thisHour + 6*hour,
          description: 'The National Weather Service has issued Severe Thunderstorm Watch 612 in effect until 9 PM CDT this evening for the following areas: in Illinois this watch includes 3 counties, in northeast Illinois Cook, DuPage, Lake. Damaging winds to 70 mph and hail up to the size of quarters are possible with the strongest storms.',
          instruction: 'Be prepared to move to a place of safety if threatening weather approaches. Stay tuned to local media and NOAA Weather Radio for later statements and possible warnings.',
          isWarning: false,
        }],
        alertsOk: true,
        updatedAt: now,
        error: null,
      }
    }
  }

  get data() {
    return this._data
  }
}
