const Service = require('../../backend/services/Service.js')
const fetch = require('node-fetch');

class WeatherService extends Service {

  constructor(config, io, webApp) {
    super(config, io, webApp, 'weather')
    this._loop = null
  }

  async start() {
    if(this._loop) {
      clearInterval(this._loop)
    }
    this._loop = setInterval(() => this.update(), 1000*60*15)
    this.update()
  }

  async welcomeClient(socket) {
    this.emit(await this.fetchAll(), socket)
  }

  async update() {
    this.emit(await this.fetchAll())
  }

  async fetchAll() {
    const apiKey = this.config.getProp('weather.apiKey')
    const lon = this.config.getProp('weather.lon')
    const lat = this.config.getProp('weather.lat')
    const units = this._getUnits()

    const current = await this._fetchCurrent(apiKey, lat, lon, units)
    const forecast = await this._fetchForecast(apiKey, lat, lon, units)

    return {current, forecast, units}
  }

  // optional key: older configs without it keep Celsius
  _getUnits() {
    try {
      return this.config.getProp('weather.units') === 'imperial' ? 'imperial' : 'metric'
    } catch(err) {
      return 'metric'
    }
  }

  async _fetchCurrent(apiKey, lat, lon, units) {
    const url = `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`
    const response = await fetch(url)
    const json = await response.json()
    return json
  }

  async _fetchForecast(apiKey, lat, lon, units) {
    const url = `http://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`
    const response = await fetch(url)
    const json = await response.json()
    return json
  }

}

module.exports = WeatherService