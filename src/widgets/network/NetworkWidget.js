import Widget from '../../frontend/Widget.js'
import TextField from '../../frontend/components/TextField.js'
import ProgressCircle from '../../frontend/circles/ProgressCircle.js'
import NetworkScreen from './NetworkScreen.js'
import { ACCENT } from '../../frontend/theme.js'

// Circle: internet ping in the middle, Wi-Fi signal as a 270° gauge, and the
// status underneath when it isn't OK. Main screen: NetworkScreen.
export default class NetworkWidget extends Widget {
  constructor() {
    super('network', 'Network')
    this.initState({
      now: null,
      chart: [],
      dropsToday: 0,
      lastDrop: null,
      speed: null,
      speedRunning: false,
    })

    this._signal = new ProgressCircle()
    this._signal.color = ACCENT
    this._signal.lineWidth = 2
    this._signal.rotation = Math.PI*0.75 // gauge from bottom-left round to bottom-right
    this.addChild(this._signal)

    this._pingLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 26,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeThickness: 1,
      align: 'center',
    })
    this.addChild(this._pingLabel)

    this._infoLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 11,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeThickness: 0.5,
      align: 'center',
    })
    this.addChild(this._infoLabel)

    this.main.title = 'Network Health'
    this._screen = new NetworkScreen()
    this.main.getPage(0).addChild(this._screen)
    this._screen.on('speedtest', () => this.sendMessage({ action: 'speedtest' }))
  }

  msg2state(msg) {
    if(msg.error) return { error: msg.error }
    if(!msg.now || !msg.now.internet) return { error: 'No network data' }
    return {
      now: msg.now,
      chart: Array.isArray(msg.chart) ? msg.chart : [],
      dropsToday: msg.dropsToday || 0,
      lastDrop: msg.lastDrop || null,
      historyHours: msg.historyHours || 0,
      speed: msg.speed || null,
      speedRunning: !!msg.speedRunning,
      error: null,
    }
  }

  updateState(obj) {
    super.updateState(obj)
    const n = this.state.now
    if(!n) return
    // text only changes when data arrives (each change re-renders a texture)
    const ok = n.status === 'ok'
    this._pingLabel.text = n.internet.ms !== null && n.status !== 'offline' && n.status !== 'no router'
      ? `${n.internet.ms} ms` : '--'
    this._infoLabel.text = !ok ? n.status
      : (n.wifi ? `wi-fi ${Math.round(100*n.wifi.quality)}%` : 'online')
    this._screen.data = this.state
    this.main.statusLeftText = n.status === 'ok' ? 'online' : n.status
    this.main.statusRightText = this.state.dropsToday ? `${this.state.dropsToday} dropouts` : 'no dropouts'
  }

  render(renderer) {
    const p = this.progress * this.dataLoadProgress
    const n = this.state.now

    this._signal.progress = p
    this._signal.size = this.size
    this._signal.value = n && n.wifi ? 0.75*n.wifi.quality : (n && n.status === 'ok' ? 0.75 : 0)

    this._pingLabel.progress = p
    this._pingLabel.style.fontSize = 14 + 12*this.size
    this._pingLabel.y = -8*this.size
    this._infoLabel.progress = p
    this._infoLabel.y = 26*this.size
    this._infoLabel.visible = this.size === 1 || (n && n.status !== 'ok')
    // a problem blinks gently on the circle
    this._infoLabel.alpha = n && n.status !== 'ok' ? 0.6 + 0.4*Math.sin(performance.now()*0.005) : 1

    this._screen.progress = this.main.progress * this.dataLoadProgress
    super.render(renderer)
  }
}
