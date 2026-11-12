import { ACCENT } from '../../frontend/theme.js'
import Widget from '../../frontend/Widget.js'
import TextField from '../../frontend/components/TextField.js'
import ProgressCircle from '../../frontend/circles/ProgressCircle.js'
import PrinterScreen, { duration } from './PrinterScreen.js'

// Bambu Lab printers (BambuService reads them over the LAN). The circle shows
// one printer: print progress as an arc, percent in the middle, time left
// underneath. The main screen shows the same printer in detail; swipe up/down
// for the others. Without a swipe for SELECT_TIMEOUT the widget picks the
// printer that is printing (the one finishing soonest).
const SELECT_TIMEOUT = 2*60*1000
const ACTIVE = ['printing', 'paused', 'preparing']
// the arc leaves a gap at the top for the title, as on Network, F1 and Sports
const ARC_START = 0.85 // rad from 12 o'clock
const ARC_SPAN = (2*Math.PI - 2*ARC_START) / (2*Math.PI)

export default class BambuWidget extends Widget {
  constructor() {
    super('bambu', 'Printers')
    this._accent = ACCENT
    this.initState({ printers: [] })
    this._selected = 0
    this._selectedAt = 0
    this._seenStatus = {} // name -> status, to notice prints finishing

    this._arc = new ProgressCircle()
    this._arc.color = ACCENT
    this._arc.lineWidth = 3
    this._arc.rotation = ARC_START
    this.addChild(this._arc)

    const style = (fontSize, stroke) => ({
      fontFamily: 'ShareTechMono',
      fontSize,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeThickness: stroke,
      align: 'center',
    })
    this._bigLabel = new TextField('', style(26, 1))
    this.addChild(this._bigLabel)
    this._subLabel = new TextField('', style(12, 0.5))
    this.addChild(this._subLabel)
    this._nameLabel = new TextField('', style(10, 0))
    this.addChild(this._nameLabel)

    this.main.title = 'Bambu Lab Printers'
    this._screen = new PrinterScreen()
    this.main.getPage(0).addChild(this._screen)
    this._screen.on('swipe', (step) => this._select(this._selected + step, true))
  }

  msg2state(msg) {
    if(!msg || typeof msg !== 'object') return null
    if(msg.error) return { error: msg.error }
    const printers = (Array.isArray(msg.printers) ? msg.printers : [])
      .filter(p => p && typeof p.name === 'string' && typeof p.status === 'string')
    if(!printers.length) return { error: 'No printer data' }
    return { printers, error: null }
  }

  updateState(obj) {
    super.updateState(obj)
    const printers = this.state.printers || []
    if(!obj.printers) return

    // a print that finishes or fails while we watch brings the widget to the front
    let attention = false
    printers.forEach(p => {
      const before = this._seenStatus[p.name]
      if(before && ACTIVE.includes(before) && (p.status === 'finished' || p.status === 'failed')) {
        attention = true
      }
      this._seenStatus[p.name] = p.status
    })
    if(attention && this.index !== 0) this.emit('activate') // activating the front widget would swap it away

    if(Date.now() - this._selectedAt > SELECT_TIMEOUT) this._autoSelect()
    this._refresh()
  }

  _autoSelect() {
    const printers = this.state.printers || []
    let best = -1
    printers.forEach((p, i) => {
      if(!ACTIVE.includes(p.status)) return
      if(best < 0) { best = i; return }
      const a = printers[best].remainingMin, b = p.remainingMin
      if(Number.isFinite(b) && (!Number.isFinite(a) || b < a)) best = i
    })
    if(best >= 0) this._selected = best
    else if(this._selected >= printers.length) this._selected = 0
  }

  _select(index, byUser) {
    const count = (this.state.printers || []).length
    if(!count) return
    this._selected = ((index % count) + count) % count
    if(byUser) this._selectedAt = Date.now()
    this._refresh()
  }

  get _printer() {
    const printers = this.state.printers || []
    return printers[this._selected % Math.max(1, printers.length)] || null
  }

  // text only changes when data arrives (each change re-renders a texture)
  _refresh() {
    const p = this._printer
    const printers = this.state.printers || []
    this._screen.printer = p
    this._screen.index = this._selected
    this._screen.count = printers.length
    if(!p) return
    const active = ACTIVE.includes(p.status)
    if(active && Number.isFinite(p.percent)) {
      this._bigLabel.text = `${p.percent}%`
      this._subLabel.text = p.status === 'printing' && Number.isFinite(p.remainingMin)
        ? duration(p.remainingMin) : p.status
    } else {
      this._bigLabel.text = { finished: 'done', failed: 'failed', offline: 'off' }[p.status] || 'idle'
      this._subLabel.text = p.status === 'offline' ? '' : (p.file ? p.file.slice(0, 14) : '')
    }
    this._nameLabel.text = printers.length > 1 ? p.name.slice(0, 14) : ''
    const printing = printers.filter(x => ACTIVE.includes(x.status)).length
    this.main.statusLeftText = printers.length > 1 ? `${printing} of ${printers.length} printing` : p.status
    this.main.statusRightText = p.endTime ? `done ${new Date(p.endTime).toTimeString().slice(0, 5)}` : ''
  }

  render(renderer) {
    const p = this._printer
    const progress = this.progress * this.dataLoadProgress
    const active = p && ACTIVE.includes(p.status)

    this._arc.progress = progress
    this._arc.size = this.size
    this._arc.value = p && (active || p.status === 'finished') && Number.isFinite(p.percent) ? ARC_SPAN * p.percent/100 : 0

    this._bigLabel.progress = progress
    this._bigLabel.style.fontSize = 14 + 12*this.size
    this._bigLabel.y = -4*this.size
    this._subLabel.progress = progress
    this._subLabel.y = 26*this.size
    this._subLabel.visible = this.size === 1
    this._nameLabel.progress = progress
    this._nameLabel.y = -34*this.size
    this._nameLabel.visible = this.size === 1
    // paused or failed blinks gently on the circle
    this._bigLabel.alpha = p && (p.status === 'paused' || p.status === 'failed')
      ? 0.6 + 0.4*Math.sin(performance.now()*0.005) : 1

    this._screen.progress = this.main.progress * this.dataLoadProgress
    super.render(renderer)
  }
}
