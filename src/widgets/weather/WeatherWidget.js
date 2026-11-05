import Widget from '../../frontend/Widget.js'
import ScaleCircle from '../../frontend/circles/ScaleCircle.js'
import ArchText from '../../frontend/components/ArchText.js'
import TextField from '../../frontend/components/TextField.js'
import { ACCENT } from '../../frontend/theme.js'
import { ICONS, WEATHER_FONT } from './weatherIcons.js'
import WeatherNowScreen from './WeatherNowScreen.js'
import WeatherDaysScreen from './WeatherDaysScreen.js'
import WeatherAlertsScreen from './WeatherAlertsScreen.js'

const TAB_NOW = 0
const TAB_DAYS = 1
const TAB_ALERTS = 2

export default class WeatherWidget extends Widget {
  constructor() {
    super('weather', "Weather")
    this.initState({
      units: 'metric',
      location: '',
      current: null,
      range: null,
      rainTime: null,
      hourly: [],
      daily: [],
      alerts: [],
      alertsOk: true,
    })
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    // alert ids already seen, so only new warnings wake the screen
    this._seenAlerts = new Set()

    // one dial per unit system; render() shows the one matching state.units
    this._tempScales = {
      metric: new ScaleCircle(-10, 30, '°c', 5, Math.PI*0.8),
      imperial: new ScaleCircle(10, 90, '°f', 5, Math.PI*0.8),
    }
    for(const scale of Object.values(this._tempScales)) {
      scale.rotation = Math.PI*0.3 + Math.PI/2
      this.addChild(scale)
    }

    // pulsing ring while a severe or extreme alert is active
    this._alertRing = new PIXI.Graphics()
    this._alertRing.lineStyle({ width: 4, color: this._accent })
    this._alertRing.drawCircle(0, 0, 96)
    this._alertRing.visible = false
    this.addChild(this._alertRing)

    this._currentTempLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 16,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'center',
    })
    this.addChild(this._currentTempLabel)

    this._currentDescriptionLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 16,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 1,
      align: 'center',
    })
    this.addChild(this._currentDescriptionLabel)

    this._currentIcon = new TextField('', {
      fontFamily: WEATHER_FONT,
      fontSize: 60,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'center',
    })
    this._currentIcon.progress = 1
    this.addChild(this._currentIcon)

    // "rain in hh:mm:ss", or the most severe alert
    this._arcLabel = new ArchText()
    this._arcLabel.text = ''
    this._arcLabel.color = 0xffffff
    this._arcLabel.positionOffset = -Math.PI*0.45
    this.addChild(this._arcLabel)

    // main screen: NOW, DAYS and (while any are active) ALERTS tabs
    this.main.title = 'Weather'
    const tabs = [['Now', WeatherNowScreen], ['Days', WeatherDaysScreen], ['Alerts', WeatherAlertsScreen]]
    this._screens = tabs.map(([name, Screen], i) => {
      const tab = this.main.getTabButton(i)
      tab.text = name
      tab.visible = i !== TAB_ALERTS
      const screen = new Screen()
      this.main.getPage(i).addChild(screen)
      return screen
    })
    this._screens[TAB_NOW].on('showAlerts', () => this.main.activateTab(TAB_ALERTS))
  }

  msg2state(msg) {
    if(msg.error) return { error: msg.error }
    if(!msg.current || !Number.isFinite(msg.current.temp)) return { error: 'No weather data' }
    return {
      units: msg.units === 'imperial' ? 'imperial' : 'metric',
      location: msg.location || '',
      current: msg.current,
      range: msg.range || null,
      rainTime: msg.rainTime || null,
      hourly: Array.isArray(msg.hourly) ? msg.hourly : [],
      daily: Array.isArray(msg.daily) ? msg.daily : [],
      alerts: Array.isArray(msg.alerts) ? msg.alerts : [],
      alertsOk: msg.alertsOk !== false,
      error: null,
    }
  }

  updateState(obj) {
    super.updateState(obj)
    const s = this.state
    if(!s.current) return

    // text changes only when data arrives (each change re-renders a texture)
    const deg = s.units === 'imperial' ? '°f' : '°c'
    this._currentTempLabel.text = `${s.current.temp}${deg}`
    this._currentIcon.text = ICONS[s.current.icon] || ''
    this._currentDescriptionLabel.text = (s.current.description || '').substring(0, 17)

    this.main.title = s.location ? `Weather: ${s.location}` : 'Weather'
    const updated = new Date(s.current.at || Date.now())
    this.main.statusLeftText = `observed ${String(updated.getHours()).padStart(2, '0')}:${String(updated.getMinutes()).padStart(2, '0')}`
    this.main.statusRightText = s.alerts.length ? `${s.alerts.length} alert${s.alerts.length > 1 ? 's' : ''}` : 'no alerts'

    this._screens[TAB_NOW].data = s
    this._screens[TAB_DAYS].data = s
    this._screens[TAB_ALERTS].alerts = s.alerts

    const alertsTab = this.main.getTabButton(TAB_ALERTS)
    alertsTab.visible = s.alerts.length > 0
    alertsTab.text = s.alerts.length > 1 ? `Alerts ${s.alerts.length}` : 'Alerts'
    if(!s.alerts.length && this.main.getPage(TAB_ALERTS).parent) {
      this.main.activateTab(TAB_NOW)
    }

    this._handleNewWarnings(s.alerts)
  }

  // a new warning (not a watch or advisory) wakes the screen, brings this
  // widget to the front and opens the ALERTS tab
  _handleNewWarnings(alerts) {
    const fresh = alerts.filter(a => !this._seenAlerts.has(a.id))
    alerts.forEach(a => this._seenAlerts.add(a.id))
    const warning = fresh.find(a => a.isWarning)
    if(!warning) return
    this.emit('wake')
    if(this.index !== 0) this.emit('activate') // activating the front widget would swap it away
    this._screens[TAB_ALERTS].show(alerts.indexOf(warning))
    this.main.activateTab(TAB_ALERTS)
  }

  _arcText() {
    const s = this.state
    if(s.alerts.length) {
      // the arc has room for ~20 characters
      const short = s.alerts[0].event
        .replace(/Severe /i, 'Svr ')
        .replace(/Thunderstorm/i, 'T-Storm')
        .replace(/Winter /i, 'Wntr ')
        .replace(/Advisory/i, 'Adv.')
      return '! ' + short
    }
    if(!s.rainTime) return ''
    const left = Math.round((s.rainTime - Date.now())/1000)
    if(left <= 0) return 'rain likely now'
    const clock = [Math.floor(left/3600), Math.floor(left/60) % 60, left % 60]
      .map(n => String(n).padStart(2, '0')).join(':')
    return 'rain in ' + clock
  }

  render(renderer) {
    super.render(renderer)
    const p = this.progress*this.dataLoadProgress
    const s = this.state

    this._currentTempLabel.progress = p
    this._currentTempLabel.y = 40*this.size
    this._currentTempLabel.style.fontSize = this.size * 8 + 7

    this._currentIcon.alpha = p
    this._currentIcon.y = -29*this.size
    this._currentIcon.style.fontSize = this.size * 60

    this._currentDescriptionLabel.progress = p
    this._currentDescriptionLabel.y = 15*this.size
    this._currentDescriptionLabel.visible = (this.size === 1)
    this._currentDescriptionLabel.style.fontSize = this.size * 12

    const [scaleMin, scaleMax] = s.units === 'imperial' ? [10, 90] : [-10, 30]
    const clampTemp = (t) => Math.max(scaleMin, Math.min(scaleMax, t))
    for(const [units, scale] of Object.entries(this._tempScales)) {
      scale.size = this.size
      scale.progress = p
      scale.visible = (this.size === 1) && units === s.units
    }
    const tempScale = this._tempScales[s.units]
    if(s.current) tempScale.value = clampTemp(s.current.temp)
    if(s.range) {
      tempScale.valueMin = clampTemp(s.range.low)
      tempScale.valueMax = clampTemp(s.range.high)
    }

    const severe = s.alerts.some(a => a.severity === 'Severe' || a.severity === 'Extreme')
    this._alertRing.visible = severe
    if(severe) {
      this._alertRing.scale.set(this.size)
      this._alertRing.alpha = p * (0.5 + 0.5*Math.sin(performance.now()*0.004))
    }

    this._arcLabel.text = this._arcText()
    // alert names are long: start just after the title and run clockwise
    // instead of centring (which spills back into the title)
    this._arcLabel.alignOffset = s.alerts.length ? 0 : 0.5
    this._arcLabel.positionOffset = s.alerts.length ? -Math.PI*0.38 : -Math.PI*0.45
    // small circles have no room for the rain countdown, but do show alerts
    this._arcLabel.visible = this.size === 1 || s.alerts.length > 0
    this._arcLabel.progress = p
    this._arcLabel.size = this.size
    this._arcLabel.radius = 110*this.size
    this._arcLabel.fontSize = Math.max(7, 11*this.size)

    this._screens.forEach(screen => screen.progress = this.main.progress * this.dataLoadProgress)
  }
}
