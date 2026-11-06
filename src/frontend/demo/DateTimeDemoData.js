export default class DateTimeDemoData {
  constructor() {

    this.config = {
      // no location: the map puts home at the browser's time zone city
      location: null,
      timezones: [
        {
          id: "europe/warsaw",
          name: "Kraków"
        },
        {
          id: "america/new_york",
          name: "New York"
        },
        {
          id: "america/los_angeles",
          name: "Los Angeles"
        },
        {
          id: "asia/tokyo",
          name: "Tokyo"
        }
      ]
    }
  }


}