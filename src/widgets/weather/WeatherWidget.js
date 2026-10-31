import Widget from '../../frontend/Widget.js'
import ScaleCircle from '../../frontend/circles/ScaleCircle.js'
import ArchText from '../../frontend/components/ArchText.js'
import TextField from '../../frontend/components/TextField.js'
import ForecastScreen from './ForecastScreen.js'

const icons = {
  '01d': '',    '01n': '',
  '02d': '',    '02n': '',
  '03d': '',    '03n': '',
  '04d': '',    '04n': '',
  '09d': '',    '09n': '',
  '10d': '',    '10n': '',
  '11d': '',    '11n': '',
  '13d': '',    '13n': '',
  '50d': '',    '50n': '',
}

export default class WeatherWidget extends Widget {
  constructor() {
    super('weather', "Weather")
    this.initState({
      currentTemperature: null,
      currentTemperatureMin: null,
      currentTemperatureMax: null,
      currentIcon: null,
      currentDescription: null,
      rainTime: null,
      forecast: null,
      units: 'metric',
    })

    // one dial per unit system; render() shows the one matching state.units
    this._tempScales = {
      metric: new ScaleCircle(-10, 30, '°c', 5, Math.PI*0.8),
      imperial: new ScaleCircle(10, 90, '°f', 5, Math.PI*0.8),
    }
    for(const scale of Object.values(this._tempScales)) {
      scale.rotation = Math.PI*0.3 + Math.PI/2
      this.addChild(scale)
    }

    this._currentTempLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 16,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'center',
    })
    this.addChild(this._currentTempLabel)

    this._currentDescriotionLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 16,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 1,
      align: 'center',
    })
    this.addChild(this._currentDescriotionLabel)

    this._currentIcon = new TextField('', {
      fontFamily: 'weathericons-regular-webfont',
      fontSize: 60,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'center',
    })
    this._currentIcon.progress = 1
    this.addChild(this._currentIcon)

    this._rainLabel = new ArchText()
    this._rainLabel.text = ''
    this._rainLabel.color = 0xffffff
    this._rainLabel.positionOffset = -Math.PI*0.45
    this.addChild(this._rainLabel)

    // main screen
    this.main.title = "3 Days Forecast"
    const page = this.main.getPage(0)
   
    this._forecastScreen = new ForecastScreen()
    page.addChild(this._forecastScreen)
  }
  
  msg2state(msg) {
    const currentJsonData = msg.current
    const forecastJsonData = msg.forecast
    const newState = {}
    newState.units = msg.units === 'imperial' ? 'imperial' : 'metric'
    newState.currentTemperature = currentJsonData.main.temp
    newState.currentIcon = currentJsonData.weather[0].icon
    newState.currentDescription = currentJsonData.weather[0].description

    const now = (new Date().getTime())/1000
    const temperature24 = forecastJsonData.list
      .filter(d => d.dt >= now && d.dt <= now + 24*60*60)
      .map(d => ({
        min: d.main.temp_min,
        max: d.main.temp_max,
      }))
      .reduce((range, val) => {
        range.min = Math.min(val.min, range.min)
        range.max = Math.max(val.max, range.max)
        return range
      }, {
        min: currentJsonData.main.temp,
        max: currentJsonData.main.temp
      })
      newState.currentTemperatureMin = temperature24.min
    newState.currentTemperatureMax = temperature24.max

    let rain = forecastJsonData.list.filter(d => d.rain)
    newState.rainTime = (rain && rain.length > 0) ? rain[0].dt*1000 : null

    newState.forecast = {
      startTime: forecastJsonData.list[0].dt*1000,
      icons: forecastJsonData.list.map(r => r.weather ? r.weather[0].icon : undefined),
      pop: forecastJsonData.list.map(r => r.rain ? r.pop : 0),
      rain: forecastJsonData.list.map(r => r.rain ? r.rain['3h'] : 0),
      temp: forecastJsonData.list.map(r => r.main.temp),
    }
    return newState
  }

  render(renderer) {
    super.render(renderer)

    this._currentTempLabel.progress = this.progress*this.dataLoadProgress
    const unitLabel = this.state.units === 'imperial' ? '°f' : '°c'
    this._currentTempLabel.text = this.state.currentTemperature === null ? '' : Math.round(this.state.currentTemperature) + unitLabel
    this._currentTempLabel.y = 40*this.size
    this._currentTempLabel.style.fontSize = this.size * 8 + 7

    this._currentIcon.alpha = this.progress*this.dataLoadProgress
    this._currentIcon.text = this.state.currentIcon === null ? '' : icons[this.state.currentIcon]
    this._currentIcon.y = -29*this.size
    this._currentIcon.style.fontSize = this.size * 60

    this._currentDescriotionLabel.progress = this.progress*this.dataLoadProgress
    this._currentDescriotionLabel.text = this.state.currentDescription === null ? '' : this.state.currentDescription.substring(0, 17)
    this._currentDescriotionLabel.y = 15*this.size
    this._currentDescriotionLabel.visible = (this.size === 1)
    this._currentDescriotionLabel.style.fontSize = this.size * 12

    const [scaleMin, scaleMax] = this.state.units === 'imperial' ? [10, 90] : [-10, 30]
    const clampTemp = (t) => Math.max(scaleMin, Math.min(scaleMax, t))
    for(const [units, scale] of Object.entries(this._tempScales)) {
      scale.size = this.size
      scale.progress = this.progress*this.dataLoadProgress
      scale.visible = (this.size === 1) && units === this.state.units
    }
    const tempScale = this._tempScales[this.state.units]
    if(this.state.currentTemperature !== null) {
      tempScale.value = clampTemp(this.state.currentTemperature)
    }
    if(this.state.currentTemperatureMin !== null) {
      tempScale.valueMin = clampTemp(this.state.currentTemperatureMin)
    }
    if(this.state.currentTemperatureMax !== null) {
      tempScale.valueMax = clampTemp(this.state.currentTemperatureMax)
    }

    if(this.state.rainTime) {
      const now = (new Date().getTime())
      const rainTimeLeft = Math.round(Math.max(0, this.state.rainTime - now)/1000)
      let rainClock = ''
      rainClock += Math.floor(rainTimeLeft/(60*60)).toString().padStart(2, '0') + ':'
      rainClock += (Math.floor(rainTimeLeft/60) % 60).toString().padStart(2, '0') + ':'
      rainClock += (rainTimeLeft % 60).toString().padStart(2, '0')
      this._rainLabel.text = rainTimeLeft ? 'rain in ' + rainClock : ''
    } else {
      this._rainLabel.text = ''
    }

    this._rainLabel.visible = (this.size === 1)
    this._rainLabel.progress = this.progress*this.dataLoadProgress
    this._rainLabel.size = this.size
    this._rainLabel.radius = 110*this.size
    this._rainLabel.fontSize = 11*this.size
    
    this._forecastScreen.progress = this.main.progress * this.dataLoadProgress
    if(this.state.forecast) {
      this._forecastScreen.startTime = this.state.forecast.startTime
      this._forecastScreen.icons = this.state.forecast.icons
      this._forecastScreen.pop = this.state.forecast.pop
      this._forecastScreen.rain = this.state.forecast.rain
      this._forecastScreen.unitLabel = unitLabel
      this._forecastScreen.temp = this.state.forecast.temp
    }

  }
}