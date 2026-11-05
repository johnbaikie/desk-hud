import { ACCENT } from '../../frontend/theme.js'
import TextField from '../../frontend/components/TextField'
import ScrollContainer from '../../frontend/components/ScrollContainer'

const style = (fontSize, extra={}) => ({
  fontFamily: 'ShareTechMono',
  fontSize,
  fill: '#ffffff',
  stroke: '#ffffff',
  strokeThickness: 0.5,
  align: 'left',
  ...extra,
})

const pad2 = (n) => String(n).padStart(2, '0')
const BODY = { x: -285, y: -50, width: 570, height: 118 }

function when(t) {
  const d = new Date(t)
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  if(d.toDateString() === new Date().toDateString()) return time
  return `${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()]} ${time}`
}

// ALERTS tab: one alert at a time (tap "next" to cycle), with its full
// description and instructions in a box you drag up and down to read.
export default class WeatherAlertsScreen extends PIXI.Container {
  constructor() {
    super()
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    this.progress = 0
    this._alerts = []
    this._index = 0
    this._shownId = null

    this._marker = new PIXI.Graphics()
    this.addChild(this._marker)

    this._event = new TextField('', style(18, { strokeThickness: 1 }))
    this._event.anchor.set(0, 0.5)
    this._event.x = -270
    this._event.y = -84
    this.addChild(this._event)

    this._meta = new TextField('', style(11))
    this._meta.anchor.set(0, 0.5)
    this._meta.x = -270
    this._meta.y = -64
    this._meta.alpha = 0.8
    this.addChild(this._meta)

    this._next = new TextField('', style(12, { align: 'right' }))
    this._next.anchor.set(1, 0.5)
    this._next.x = 282
    this._next.y = -84
    this._next.hitArea = new PIXI.Rectangle(-140, -18, 160, 36)
    this._next.interactive = true
    this._next.cursor = 'pointer'
    this._next.on('pointertap', () => this.show(this._index + 1))
    this.addChild(this._next)

    // below the frame on the left, clear of the tab buttons
    this._hint = new TextField('drag the text to read more', style(10))
    this._hint.anchor.set(0, 0.5)
    this._hint.x = -280
    this._hint.y = 76
    this._hint.alpha = 0.6
    this._hint.visible = false
    this.addChild(this._hint)

    this._scroll = new ScrollContainer(BODY.width, BODY.height)
    this._scroll.x = BODY.x
    this._scroll.y = BODY.y
    this.addChild(this._scroll)
    this._body = new TextField('', style(11, { wordWrap: true, wordWrapWidth: (BODY.width - 20) / 1.1, lineHeight: 15 }))
    this._body.anchor.set(0, 0)
    this._body.x = 4
    this._scroll.addChild(this._body)
  }

  set alerts(list) {
    if(list === this._alerts) return
    this._alerts = list || []
    // stay on the same alert when the list refreshes
    const i = this._alerts.findIndex(a => a.id === this._shownId)
    this.show(i >= 0 ? i : 0, i >= 0)
  }

  show(index, keepScroll=false) {
    const n = this._alerts.length
    this._index = n ? ((index % n) + n) % n : 0
    const a = this._alerts[this._index]
    this._shownId = a ? a.id : null

    this._marker.clear()
    if(!a) {
      this._event.text = 'no active alerts'
      this._meta.text = 'national weather service'
      this._next.text = ''
      this._body.text = ''
      this._hint.visible = false
      return
    }
    this._marker.beginFill(this._accent)
    this._marker.drawRect(-285, -94, 6, 40)
    this._marker.endFill()

    this._event.text = a.event
    const parts = [a.severity, a.ends ? 'until ' + when(a.ends) : '', a.area]
    const meta = parts.filter(Boolean).join(' · ')
    this._meta.text = meta.length > 78 ? meta.substring(0, 77) + '…' : meta
    this._next.text = n > 1 ? `${this._index + 1}/${n}  next >` : ''

    const body = [a.description, a.instruction ? 'what to do: ' + a.instruction : ''].filter(Boolean).join('\n\n')
    this._body.text = body || a.headline || ''
    // TextField sets its PIXI text while rendering, so measure the full text here
    const textHeight = PIXI.TextMetrics.measureText(this._body.text, this._body.style).height * this._body.scale.y
    this._scroll.contentRect.x = 0
    this._scroll.contentRect.y = 0
    this._scroll.contentRect.width = BODY.width
    this._scroll.contentRect.height = textHeight + 10
    this._hint.visible = textHeight + 10 > BODY.height
    if(!keepScroll) this._scroll.scrollTo(0, 0)
  }

  render(renderer) {
    this._event.progress = this.progress
    this._meta.progress = this.progress
    this._next.progress = this.progress
    this._body.progress = this.progress
    this._hint.progress = this.progress
    this._marker.alpha = this.progress
    this._scroll.visible = this.progress > 0.5
    super.render(renderer)
  }
}
